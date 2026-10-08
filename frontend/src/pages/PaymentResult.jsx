import { useEffect, useRef, useState } from 'react'
import { CircleCheck, CircleX } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import PaymentReceipt from '../components/PaymentReceipt'
import { api } from '../lib/api'

// Toss 결제창이 돌려보내는 두 화면.
//  success: ?paymentKey&orderId&amount -> 서버 승인(/api/payments/confirm). 서버가 금액/주문/중복을 검증하고 Toss 승인 API를 부른다.
//  fail:    ?code&message&orderId      -> 서버에 실패/취소 기록(/api/payments/fail). 주문/예약은 확정되지 않는다.
// StrictMode(개발)에서 effect가 두 번 실행돼도 승인 요청은 한 번만 보낸다(ref).
export function PaymentSuccess() {
  const [searchParams] = useSearchParams()
  const [payment, setPayment] = useState(null)
  const [confirmError, setError] = useState(null)
  const sent = useRef(false)
  const paymentKey = searchParams.get('paymentKey')
  const orderId = searchParams.get('orderId')
  const amount = Number(searchParams.get('amount'))
  const paramsValid = !!paymentKey && !!orderId && Number.isFinite(amount)
  // 결제창이 돌려준 값이 빠졌으면 승인 요청 없이 바로 안내한다.
  const error = paramsValid ? confirmError : '결제 정보가 올바르지 않아요.'

  useEffect(() => {
    if (sent.current || !paramsValid) return
    sent.current = true
    api
      .post('/api/payments/confirm', { paymentKey, orderId, amount })
      .then(setPayment)
      .catch((err) => setError(err.message))
  }, [paramsValid, paymentKey, orderId, amount])

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      {!payment && !error && <p className="text-ridefit-text-secondary" data-testid="payment-confirming">결제를 확인하고 있어요...</p>}
      {error && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-ridefit-danger-border bg-ridefit-danger-bg p-6 text-center" data-testid="payment-confirm-error">
          <CircleX aria-hidden="true" className="h-10 w-10 text-ridefit-danger" />
          <p className="text-lg font-bold text-ridefit-text">결제를 완료하지 못했어요</p>
          <p className="text-sm text-ridefit-text">{error}</p>
          <p className="text-xs text-ridefit-text-secondary">주문이나 예약은 확정되지 않았어요.</p>
          <Link to="/payments" className="text-sm font-medium text-ridefit-primary hover:underline">내 결제 내역 보기</Link>
        </div>
      )}
      {payment && (
        <div className="flex flex-col gap-5" data-testid="payment-success">
          <div className="flex flex-col items-center gap-2 text-center">
            <CircleCheck aria-hidden="true" className="h-12 w-12 text-ridefit-success" />
            <h1 className="text-2xl font-bold text-ridefit-text">결제가 완료되었습니다.</h1>
            {payment.reservation && <p className="text-sm text-ridefit-success">예약이 확정되었어요.</p>}
          </div>
          <div className="rounded-xl border border-ridefit-border bg-ridefit-card p-5 shadow-lg">
            <PaymentReceipt payment={payment} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to="/payments" className="flex-1 rounded-lg bg-ridefit-primary px-4 py-2.5 text-center text-sm font-semibold text-white hover:brightness-110">
              내 결제 내역
            </Link>
            <Link
              to={payment.reservation ? '/reservations' : '/garage'}
              className="flex-1 rounded-lg border border-ridefit-border px-4 py-2.5 text-center text-sm font-semibold text-ridefit-text hover:border-ridefit-primary"
            >
              {payment.reservation ? '내 예약 보기' : '내 차고로'}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

const FAIL_MESSAGE = {
  PAY_PROCESS_CANCELED: '결제를 취소했어요.',
  USER_CANCEL: '결제를 취소했어요.',
  PAY_PROCESS_ABORTED: '결제가 중단되었어요. 다시 시도해주세요.',
  REJECT_CARD_COMPANY: '카드사에서 결제를 거절했어요. 다른 카드로 시도해주세요.',
}

export function PaymentFail() {
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code') || 'UNKNOWN'
  const message = searchParams.get('message')
  const orderId = searchParams.get('orderId')
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current || !orderId) return
    sent.current = true
    api.post('/api/payments/fail', { orderId, code, message }).catch(() => {})
  }, [orderId, code, message])

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-ridefit-border bg-ridefit-card p-6 text-center" data-testid="payment-fail">
        <CircleX aria-hidden="true" className="h-10 w-10 text-ridefit-danger" />
        <h1 className="text-lg font-bold text-ridefit-text">결제가 완료되지 않았어요</h1>
        <p className="text-sm text-ridefit-text">{FAIL_MESSAGE[code] ?? message ?? '결제에 실패했어요.'}</p>
        <p className="text-xs text-ridefit-text-secondary">주문이나 예약은 확정되지 않았어요. 돈은 빠져나가지 않았어요.</p>
        <div className="mt-2 flex gap-3 text-sm">
          <Link to="/payments" className="font-medium text-ridefit-primary hover:underline">내 결제 내역</Link>
          <Link to="/reservations" className="font-medium text-ridefit-primary hover:underline">내 예약</Link>
          <Link to="/parts" className="font-medium text-ridefit-primary hover:underline">부품 찾아보기</Link>
        </div>
      </div>
    </div>
  )
}
