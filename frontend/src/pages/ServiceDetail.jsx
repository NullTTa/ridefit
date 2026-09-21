import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

const TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']

const inputClass =
  'rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary'

function toDateInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatDateTime(iso) {
  if (!iso) return ''
  return iso.slice(0, 16).replace('T', ' ')
}

// 매장 상세 + 가상 예약 흐름: 서비스 선택 -> 날짜/시간 -> 예약 신청 -> RIDEFIT 내부 예약 완료 화면.
function ServiceDetail() {
  const { shopId } = useParams()
  const { isAuthenticated } = useAuth()

  const [shop, setShop] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [serviceName, setServiceName] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState(TIME_SLOTS[1])
  const [myVehicleId, setMyVehicleId] = useState('')
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [reservation, setReservation] = useState(null)

  const tomorrow = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return toDateInputValue(d)
  }, [])

  useEffect(() => {
    setLoading(true)
    api
      .get(`/api/services/shops/${shopId}`, { auth: false })
      .then((data) => {
        setShop(data)
        setServiceName(data.menus[0] ?? '')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    setDate(tomorrow)
  }, [shopId, tomorrow])

  useEffect(() => {
    if (!isAuthenticated) return
    api.get('/api/my-vehicles').then(setVehicles).catch(() => setVehicles([]))
  }, [isAuthenticated])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      const created = await api.post('/api/reservations', {
        shopId: shop.id,
        serviceName,
        preferredAt: `${date}T${time}:00`,
        myVehicleId: myVehicleId ? Number(myVehicleId) : null,
        memo,
      })
      setReservation(created)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="mx-auto max-w-3xl px-4 py-16 text-ridefit-text-secondary">불러오는 중...</p>
  if (error) return <p className="mx-auto max-w-3xl px-4 py-16 text-ridefit-danger">에러: {error}</p>
  if (!shop) return null

  // 예약 완료 화면
  if (reservation) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-ridefit-success-border bg-ridefit-success-bg px-6 py-10">
          <p className="text-4xl" aria-hidden="true">
            ✅
          </p>
          <h1 className="mt-3 text-2xl font-bold text-ridefit-text">예약 신청이 완료됐어요</h1>
          <p className="mt-1 text-sm text-ridefit-success">RIDEFIT 안에서만 동작하는 가상 예약이에요.</p>

          <dl className="mt-6 grid grid-cols-[6rem_1fr] gap-y-2 text-left text-sm">
            <dt className="text-ridefit-text-secondary">매장</dt>
            <dd className="text-ridefit-text">{reservation.shopName}</dd>
            <dt className="text-ridefit-text-secondary">서비스</dt>
            <dd className="text-ridefit-text">{reservation.serviceName}</dd>
            <dt className="text-ridefit-text-secondary">희망 일시</dt>
            <dd className="text-ridefit-text">{formatDateTime(reservation.preferredAt)}</dd>
            {reservation.vehicleLabel && (
              <>
                <dt className="text-ridefit-text-secondary">차량</dt>
                <dd className="text-ridefit-text">{reservation.vehicleLabel}</dd>
              </>
            )}
            {reservation.memo && (
              <>
                <dt className="text-ridefit-text-secondary">요청사항</dt>
                <dd className="text-ridefit-text">{reservation.memo}</dd>
              </>
            )}
            <dt className="text-ridefit-text-secondary">예약 번호</dt>
            <dd className="font-mono text-ridefit-text">RF-{String(reservation.id).padStart(5, '0')}</dd>
          </dl>
        </div>

        <p className="mt-4 text-xs text-ridefit-text-secondary">
          실제 업체에는 전달되지 않았고 결제도 발생하지 않았어요. 실제 방문이 필요하면 업체에 직접 문의해주세요.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/reservations" className="rounded-lg bg-ridefit-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">
            내 예약 보기
          </Link>
          <Link to="/services" className="rounded-lg border border-ridefit-border px-5 py-2.5 text-sm font-medium text-ridefit-text-secondary transition hover:border-ridefit-primary hover:text-ridefit-primary">
            다른 매장 보기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <nav className="mb-6 text-sm text-ridefit-text-secondary">
        <Link to="/services" className="hover:text-ridefit-primary">
          정비 · 세차 서비스
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ridefit-text">{shop.typeLabel}</span>
      </nav>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-ridefit-border px-2.5 py-0.5 text-xs text-ridefit-text-secondary">{shop.typeLabel}</span>
          {shop.sample && <span className="rounded-full bg-ridefit-warning-bg px-2 py-0.5 text-xs text-ridefit-warning">샘플 데이터</span>}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-ridefit-text">{shop.name}</h1>
        <p className="mt-1 text-sm text-ridefit-text-secondary">
          {shop.region} · {shop.address}
        </p>
        <p className="mt-3 text-ridefit-text-secondary">{shop.description}</p>
      </header>

      <section className="rounded-xl border border-ridefit-border bg-ridefit-card p-6 shadow-lg">
        <h2 className="text-lg font-bold text-ridefit-text">가상 예약 신청</h2>
        <p className="mt-1 text-sm text-ridefit-text-secondary">예약 흐름을 체험하는 프로토타입이에요. 실제 업체 예약이 아니에요.</p>

        {!isAuthenticated ? (
          <p className="mt-5 text-sm text-ridefit-text-secondary">
            예약 체험은{' '}
            <Link to="/login" className="font-medium text-ridefit-primary hover:underline">
              로그인
            </Link>{' '}
            후 이용할 수 있어요.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ridefit-text-secondary">1. 서비스 선택</legend>
              <div className="flex flex-wrap gap-2">
                {shop.menus.map((menu) => (
                  <button
                    key={menu}
                    type="button"
                    onClick={() => setServiceName(menu)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      serviceName === menu ? 'bg-ridefit-primary text-white' : 'bg-ridefit-bg text-ridefit-text-secondary hover:bg-ridefit-border'
                    }`}
                  >
                    {menu}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
                2. 희망 날짜
                <input type="date" required min={tomorrow} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
                희망 시간
                <select value={time} onChange={(e) => setTime(e.target.value)} className={inputClass}>
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
              차량 (선택)
              <select value={myVehicleId} onChange={(e) => setMyVehicleId(e.target.value)} className={inputClass}>
                <option value="">선택 안 함</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.modelYearLabel}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
              요청사항 (선택)
              <textarea rows={3} maxLength={200} value={memo} onChange={(e) => setMemo(e.target.value)} className={inputClass} />
            </label>

            <button
              type="submit"
              disabled={submitting || !serviceName}
              className="rounded-lg bg-ridefit-primary px-4 py-2.5 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? '신청 중...' : '예약 신청'}
            </button>
            {formError && <p className="text-sm text-ridefit-danger">{formError}</p>}
          </form>
        )}
      </section>
    </div>
  )
}

export default ServiceDetail
