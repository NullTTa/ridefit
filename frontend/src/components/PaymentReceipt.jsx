import { ORDER_TYPE_LABEL, PAYMENT_STATUS_LABEL, formatDateTime, formatWon } from '../lib/toss'

const STATUS_STYLE = {
  PAID: 'bg-ridefit-success-bg text-ridefit-success',
  FAILED: 'bg-ridefit-danger-bg text-ridefit-danger',
  CANCELED: 'bg-ridefit-bg text-ridefit-text-secondary',
  READY: 'bg-ridefit-warning-bg text-ridefit-warning',
}

// 결제 1건 상세(결제 완료 화면 / 내 결제 상세 공용). 값은 전부 서버(/api/payments/confirm, /api/me/payments/...) 응답 그대로다.
function PaymentReceipt({ payment, compact = false }) {
  const rows = [
    ['주문번호', <span key="o" className="font-mono text-xs">{payment.orderId}</span>],
    ['구분', ORDER_TYPE_LABEL[payment.orderType] ?? payment.orderType],
    ['상품/서비스', payment.orderName],
    ['결제금액', <span key="a" className="font-semibold text-ridefit-text">{formatWon(payment.amount)}</span>],
    ['결제수단', payment.method ?? '-'],
    ['결제일시', formatDateTime(payment.paidAt)],
  ]
  if (payment.reservation) {
    rows.push(['예약번호', `RF-${String(payment.reservation.reservationId).padStart(5, '0')}`])
    rows.push(['매장', payment.reservation.shopName])
    rows.push(['방문 예정일', formatDateTime(payment.reservation.preferredAt)])
    rows.push(['서비스', payment.reservation.services.join(', ')])
  }
  return (
    <div className="flex flex-col gap-3" data-testid="payment-receipt">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[payment.status] ?? ''}`} data-testid="payment-status">
          {PAYMENT_STATUS_LABEL[payment.status] ?? payment.status}
        </span>
        <span className="text-[11px] text-ridefit-text-secondary">Toss Payments 테스트 결제</span>
      </div>
      <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ridefit-text-secondary">{label}</dt>
            <dd className="min-w-0 break-words text-ridefit-text">{value}</dd>
          </div>
        ))}
      </dl>
      {!compact && payment.items?.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg border border-ridefit-border bg-ridefit-bg p-3 text-xs" data-testid="payment-items">
          {payment.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="min-w-0 text-ridefit-text">
                {item.name} <span className="text-ridefit-text-secondary">× {item.quantity}</span>
              </span>
              <span className="shrink-0 text-ridefit-text">{formatWon(item.lineAmount)}</span>
            </li>
          ))}
        </ul>
      )}
      {payment.failureMessage && payment.status !== 'PAID' && (
        <p className="text-xs text-ridefit-text-secondary">사유: {payment.failureMessage}</p>
      )}
    </div>
  )
}

export default PaymentReceipt
