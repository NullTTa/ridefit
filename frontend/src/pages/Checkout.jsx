import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ProductImage from '../components/ProductImage'
import { api } from '../lib/api'
import {
  ANONYMOUS,
  ORDER_TYPE_LABEL,
  TOSS_KEY_MESSAGE,
  formatDateTime,
  formatWon,
  loadToss,
  paymentRedirectUrls,
  tossErrorCode,
  tossKeyMode,
} from '../lib/toss'

const MAX_QUANTITY = 10

// 주문 확인 -> Toss 테스트 결제.
//  - 부품/오일: /checkout?partId=..&qty=..(&vehicleId=..)  - 가격은 서버 미리보기(/api/payments/quote/part) 값만 보여준다.
//  - 예약:      /checkout?reservationId=..                 - 예약 생성 때 서버가 확정한 금액.
// [결제하기] -> 서버가 DB 가격으로 금액을 다시 확정한 주문(/api/payments/checkout/...)을 만들고, 그 금액으로 결제창을 연다.
// 결제 성공/실패 후에는 Toss가 /payments/success 또는 /payments/fail 로 돌려보낸다(승인은 서버만 한다).
function Checkout() {
  const [searchParams, setSearchParams] = useSearchParams()
  const partId = searchParams.get('partId')
  const reservationId = searchParams.get('reservationId')
  const vehicleId = searchParams.get('vehicleId')
  const quantity = Math.min(Math.max(Number(searchParams.get('qty')) || 1, 1), MAX_QUANTITY)

  const [quote, setQuote] = useState(null)
  const [reservation, setReservation] = useState(null)
  const [vehicle, setVehicle] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [widgetReady, setWidgetReady] = useState(false)
  const widgetsRef = useRef(null)
  const keyMode = tossKeyMode()
  const amount = partId ? quote?.amount : reservation?.totalPrice

  useEffect(() => {
    setError(null)
    if (partId) {
      api
        .get(`/api/payments/quote/part?partId=${partId}&quantity=${quantity}`)
        .then(setQuote)
        .catch((err) => setError(err.message))
    } else if (reservationId) {
      api
        .get('/api/me/reservations')
        .then((list) => {
          const r = list.find((x) => String(x.id) === String(reservationId))
          if (!r) setError('예약 정보를 찾을 수 없어요.')
          else setReservation(r)
        })
        .catch((err) => setError(err.message))
    } else {
      setError('결제할 상품이나 예약을 선택해주세요.')
    }
  }, [partId, reservationId, quantity])

  useEffect(() => {
    if (!vehicleId) return
    api
      .get('/api/my-vehicles')
      .then((list) => setVehicle(list.find((v) => String(v.id) === String(vehicleId)) ?? null))
      .catch(() => setVehicle(null))
  }, [vehicleId])

  // 결제위젯 키(test_gck_)면 결제수단/약관 위젯을 이 화면에 그린다. 금액은 서버가 알려준 값으로만 설정한다.
  useEffect(() => {
    if (keyMode !== 'widget' || amount == null) return
    let cancelled = false
    ;(async () => {
      try {
        if (!widgetsRef.current) {
          const toss = await loadToss()
          widgetsRef.current = toss.widgets({ customerKey: ANONYMOUS })
          await widgetsRef.current.setAmount({ currency: 'KRW', value: amount })
          await Promise.all([
            widgetsRef.current.renderPaymentMethods({ selector: '#toss-payment-method', variantKey: 'DEFAULT' }),
            widgetsRef.current.renderAgreement({ selector: '#toss-agreement', variantKey: 'AGREEMENT' }),
          ])
        } else {
          await widgetsRef.current.setAmount({ currency: 'KRW', value: amount })
        }
        if (!cancelled) setWidgetReady(true)
      } catch (err) {
        if (!cancelled) setError(`결제 화면을 불러오지 못했어요. (${tossErrorCode(err)})`)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [keyMode, amount])

  const changeQuantity = (next) => {
    const params = new URLSearchParams(searchParams)
    params.set('qty', String(next))
    setSearchParams(params, { replace: true })
  }

  const pay = async () => {
    if (keyMode === 'missing' || keyMode === 'live') return
    setBusy(true)
    setError(null)
    setNotice(null)
    let order = null
    try {
      order = partId
        ? await api.post('/api/payments/checkout/parts', {
            items: [{ partId: Number(partId), quantity }],
            myVehicleId: vehicleId ? Number(vehicleId) : null,
          })
        : await api.post('/api/payments/checkout/reservation', { reservationId: Number(reservationId) })
      const request = {
        orderId: order.orderId,
        orderName: order.orderName,
        ...paymentRedirectUrls(),
      }
      if (keyMode === 'widget') {
        // 서버가 다시 계산한 금액으로 맞춘 뒤 결제(미리보기 이후 가격이 바뀌었어도 서버 금액이 기준).
        await widgetsRef.current.setAmount({ currency: 'KRW', value: order.amount })
        await widgetsRef.current.requestPayment(request)
      } else {
        const toss = await loadToss()
        await toss.payment({ customerKey: ANONYMOUS }).requestPayment({
          method: 'CARD',
          amount: { currency: 'KRW', value: order.amount },
          ...request,
        })
      }
      // 성공하면 Toss가 successUrl로 이동시키므로 여기까지 오지 않는다.
    } catch (err) {
      const code = tossErrorCode(err)
      if (order) {
        // 결제창을 닫았거나 결제창 단계에서 실패 - 서버에 기록(예약/주문은 확정되지 않는다).
        api.post('/api/payments/fail', { orderId: order.orderId, code, message: err.message }).catch(() => {})
      }
      if (code === 'USER_CANCEL' || code === 'PAY_PROCESS_CANCELED') setNotice('결제를 취소했어요. 다시 시도할 수 있어요.')
      else setError(err.message || '결제를 시작하지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  const disabledReason =
    keyMode === 'missing' || keyMode === 'live'
      ? TOSS_KEY_MESSAGE[keyMode]
      : reservation && reservation.status !== 'REQUESTED'
        ? reservation.status === 'CONFIRMED'
          ? '이미 결제가 완료된 예약이에요.'
          : '취소된 예약은 결제할 수 없어요.'
        : reservation && (reservation.items.length === 0 || reservation.totalPrice == null)
          ? '서비스 정보나 가격이 없는 예약은 결제할 수 없어요.'
          : null
  const canPay = amount != null && !disabledReason && !busy && (keyMode !== 'widget' || widgetReady)

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-bold text-ridefit-text">주문 확인</h1>
      <p className="mt-1 text-sm text-ridefit-text-secondary">결제 금액은 RIDEFIT 판매 가격(서버 기준)으로 계산돼요. 외부 판매처 가격과는 별개예요.</p>

      {error && <p className="mt-4 rounded-lg border border-ridefit-danger-border bg-ridefit-danger-bg px-3 py-2 text-sm text-ridefit-danger" data-testid="checkout-error">{error}</p>}
      {notice && <p className="mt-4 rounded-lg border border-ridefit-border bg-ridefit-card px-3 py-2 text-sm text-ridefit-text" data-testid="checkout-notice">{notice}</p>}

      {quote && (
        <section className="mt-6 flex gap-4 rounded-xl border border-ridefit-border bg-ridefit-card p-4" data-testid="checkout-part">
          <div className="w-28 shrink-0 overflow-hidden rounded-lg">
            <ProductImage src={quote.imageUrl} alt={quote.name} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-xs text-ridefit-primary">{ORDER_TYPE_LABEL[quote.orderType]} · {quote.category}</p>
            <p className="font-semibold text-ridefit-text">{quote.name}</p>
            {vehicle && <p className="text-xs text-ridefit-text-secondary">장착 차량: {vehicle.nickname || vehicle.modelYearLabel}</p>}
            <p className="text-sm text-ridefit-text-secondary">RIDEFIT 판매 가격 {formatWon(quote.unitPrice)}</p>
            <label className="mt-1 flex items-center gap-2 text-sm text-ridefit-text">
              수량
              <select
                value={quantity}
                onChange={(e) => changeQuantity(Number(e.target.value))}
                className="rounded-md border border-ridefit-border bg-ridefit-bg px-2 py-1"
                data-testid="checkout-qty"
              >
                {Array.from({ length: MAX_QUANTITY }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}

      {reservation && (
        <section className="mt-6 flex flex-col gap-1 rounded-xl border border-ridefit-border bg-ridefit-card p-4 text-sm" data-testid="checkout-reservation">
          <p className="text-xs text-ridefit-primary">{ORDER_TYPE_LABEL.RESERVATION} · RF-{String(reservation.id).padStart(5, '0')}</p>
          <p className="font-semibold text-ridefit-text">{reservation.shopName}</p>
          <p className="text-ridefit-text-secondary">
            {reservation.items.map((i) => i.serviceName + (i.oilTypeLabel ? `(${i.oilTypeLabel})` : '')).join(', ') || '서비스 정보 없음'}
          </p>
          <p className="text-ridefit-text-secondary">방문 예정일 {formatDateTime(reservation.preferredAt)}</p>
        </section>
      )}

      {amount != null && (
        <div className="mt-4 flex items-baseline justify-between rounded-xl border border-ridefit-border bg-ridefit-card px-4 py-3">
          <span className="text-sm text-ridefit-text-secondary">총 결제 금액</span>
          <span className="text-xl font-bold text-ridefit-text" data-testid="checkout-amount">{formatWon(amount)}</span>
        </div>
      )}

      {keyMode === 'widget' && (
        <div className="mt-4 overflow-hidden rounded-xl bg-white">
          <div id="toss-payment-method" />
          <div id="toss-agreement" />
        </div>
      )}

      {disabledReason && <p className="mt-4 text-sm text-ridefit-warning" data-testid="checkout-disabled">{disabledReason}</p>}

      <button
        type="button"
        onClick={pay}
        disabled={!canPay}
        className="mt-5 w-full rounded-xl bg-ridefit-primary px-4 py-3.5 text-base font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="checkout-pay"
      >
        {busy ? '결제창을 여는 중...' : amount != null ? `${formatWon(amount)} 결제하기` : '결제하기'}
      </button>
      <p className="mt-2 text-center text-[11px] text-ridefit-text-secondary">Toss Payments 테스트 결제예요. 실제로 돈이 빠져나가지 않아요.</p>
      <p className="mt-4 text-center text-xs">
        <Link to="/payments" className="text-ridefit-primary hover:underline">내 결제 내역 보기</Link>
      </p>
    </div>
  )
}

export default Checkout
