import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import LegacyReservationBadge from '../components/LegacyReservationBadge'
import { api } from '../lib/api'

// REQUESTED = 신청됨(결제 전), CONFIRMED = Toss 테스트 결제 승인으로 확정, CANCELED = 취소
const STATUS_LABEL = { REQUESTED: '예약 신청됨 · 결제 대기', CONFIRMED: '예약 확정 · 결제 완료', CANCELED: '취소됨' }

function formatDateTime(iso) {
  if (!iso) return ''
  return iso.slice(0, 16).replace('T', ' ')
}

// 내 예약 목록.
function Reservations() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    api
      .get('/api/me/reservations')
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const cancel = async (id) => {
    if (!window.confirm('이 예약을 취소할까요?')) return
    setBusyId(id)
    try {
      const updated = await api.post(`/api/reservations/${id}/cancel`)
      setItems((prev) => prev.map((r) => (r.id === id ? updated : r)))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-2xl font-bold text-ridefit-text">내 예약</h1>
      <p className="mt-1 mb-6 text-sm text-ridefit-text-secondary">신청한 정비·세차 예약을 확인하고 관리할 수 있어요.</p>

      {loading && <p className="text-ridefit-text-secondary">불러오는 중...</p>}
      {error && <p className="text-ridefit-danger">에러: {error}</p>}

      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-ridefit-border bg-ridefit-card px-6 py-14 text-center">
          <p className="text-ridefit-text-secondary">아직 예약 기록이 없어요.</p>
          <Link to="/services" className="rounded-lg bg-ridefit-primary px-4 py-2 font-semibold text-white transition hover:brightness-110">
            정비 · 세차 서비스 보러가기
          </Link>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((r) => (
          <li key={r.id} className="rounded-xl border border-ridefit-border bg-ridefit-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-ridefit-text">{r.shopName}</p>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  r.status === 'CANCELED'
                    ? 'bg-ridefit-bg text-ridefit-text-secondary'
                    : r.status === 'REQUESTED'
                      ? 'bg-ridefit-warning-bg text-ridefit-warning'
                      : 'bg-ridefit-success-bg text-ridefit-success'
                }`}
              >
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-ridefit-text-secondary">
              {/* 리팩터링 이전(서비스 1개만 담던 시절)에 만들어진 예약은 items가 비어있을 수 있다 -
                  빈칸으로 보이지 않게 안내 문구로 대신하고, 가격/서비스명은 지어내지 않는다. */}
              {r.items.length > 0 ? (
                <>
                  {r.items.map((item) => item.serviceName + (item.oilTypeLabel ? `(${item.oilTypeLabel})` : '')).join(', ')}
                  {r.totalPrice != null && ` · ${r.totalPrice.toLocaleString()}원`} ·{' '}
                </>
              ) : (
                <>
                  <LegacyReservationBadge />
                  서비스 정보 없음 ·{' '}
                </>
              )}
              {formatDateTime(r.preferredAt)}
              {r.vehicleLabel && ` · ${r.vehicleLabel}`}
            </p>
            {r.memo && <p className="mt-1 text-xs text-ridefit-text-secondary">요청: {r.memo}</p>}
            <div className="mt-3 flex items-center justify-between">
              <span className="font-mono text-xs text-ridefit-text-secondary">RF-{String(r.id).padStart(5, '0')}</span>
              {/* 결제 가능한 예약(서비스 항목 + 서버 확정 금액이 있는 신청 상태)만 결제 버튼. 결제가 끝나면 CONFIRMED가 된다. */}
              {r.status === 'REQUESTED' && r.items.length > 0 && r.totalPrice != null && (
                <Link
                  to={`/checkout?reservationId=${r.id}`}
                  className="ml-auto mr-3 rounded-lg bg-ridefit-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                  data-testid={`reservation-pay-${r.id}`}
                >
                  결제하기 · {r.totalPrice.toLocaleString()}원
                </Link>
              )}
              {r.status === 'REQUESTED' && (
                <button
                  type="button"
                  onClick={() => cancel(r.id)}
                  disabled={busyId === r.id}
                  className="text-xs text-ridefit-text-secondary hover:text-ridefit-danger disabled:opacity-50"
                >
                  {busyId === r.id ? '취소 중...' : '예약 취소'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Reservations
