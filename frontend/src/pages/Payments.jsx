import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PaymentReceipt from '../components/PaymentReceipt'
import { api } from '../lib/api'
import { ORDER_TYPE_LABEL, PAYMENT_STATUS_LABEL, formatDateTime, formatWon } from '../lib/toss'

// 내 결제 내역. 서버(/api/me/payments)가 로그인한 회원 본인 것만 돌려준다(결제창 직전 단계 READY는 제외).
function Payments() {
  const [payments, setPayments] = useState(null)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    api
      .get('/api/me/payments')
      .then(setPayments)
      .catch((err) => setError(err.message))
  }, [])

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-bold text-ridefit-text">내 결제</h1>
      <p className="mt-1 text-sm text-ridefit-text-secondary">부품 구매와 정비·세차 예약 결제 내역이에요. (Toss Payments 테스트 결제)</p>

      {error && <p className="mt-6 text-ridefit-danger">에러: {error}</p>}
      {payments === null && !error && <p className="mt-6 text-ridefit-text-secondary">불러오는 중...</p>}
      {payments?.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-ridefit-border bg-ridefit-card px-6 py-10 text-center" data-testid="payments-empty">
          <p className="text-sm text-ridefit-text">아직 결제 내역이 없어요.</p>
          <Link to="/parts" className="mt-2 inline-block text-sm font-medium text-ridefit-primary hover:underline">부품 찾아보기</Link>
        </div>
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {payments?.map((p) => (
          <li key={p.orderId} className="rounded-xl border border-ridefit-border bg-ridefit-card p-4" data-testid={`payment-${p.orderId}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-ridefit-primary">{ORDER_TYPE_LABEL[p.orderType] ?? p.orderType}</p>
                <p className="truncate font-semibold text-ridefit-text" title={p.orderName}>{p.orderName}</p>
                <p className="text-xs text-ridefit-text-secondary">{formatDateTime(p.paidAt ?? p.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-ridefit-text">{formatWon(p.amount)}</p>
                <p className="text-xs text-ridefit-text-secondary">{PAYMENT_STATUS_LABEL[p.status] ?? p.status}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpenId(openId === p.orderId ? null : p.orderId)}
              className="mt-2 text-xs font-medium text-ridefit-primary hover:underline"
              aria-expanded={openId === p.orderId}
            >
              {openId === p.orderId ? '상세 닫기' : '상세보기'}
            </button>
            {openId === p.orderId && (
              <div className="mt-3 border-t border-ridefit-border pt-3">
                <PaymentReceipt payment={p} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Payments
