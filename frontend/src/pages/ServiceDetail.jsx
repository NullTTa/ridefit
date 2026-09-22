import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

const TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']
const ENGINE_OIL_SERVICE_NAME = '엔진오일 교환'

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

function formatWon(n) {
  return n == null ? '가격 정보 준비중' : `${n.toLocaleString()}원`
}

// 매장 상세 + 예약 신청 흐름: 서비스 여러 개 선택 -> (엔진오일이면) 오일 종류 선택 -> 날짜/시간 -> 예약 신청 -> 완료 화면.
function ServiceDetail() {
  const { shopId } = useParams()
  const { isAuthenticated } = useAuth()

  const [shop, setShop] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [oilTypes, setOilTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selectedNames, setSelectedNames] = useState([])
  const [oilType, setOilType] = useState('')
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
      .then((data) => setShop(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    setDate(tomorrow)
  }, [shopId, tomorrow])

  useEffect(() => {
    api.get('/api/services/engine-oil-types', { auth: false }).then(setOilTypes).catch(() => setOilTypes([]))
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    api.get('/api/my-vehicles').then(setVehicles).catch(() => setVehicles([]))
  }, [isAuthenticated])

  const services = shop?.services ?? shop?.menus.map((name) => ({ name, price: null, durationMinutes: null })) ?? []
  const needsOilType = selectedNames.includes(ENGINE_OIL_SERVICE_NAME)

  const toggleService = (name) => {
    setSelectedNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  }

  const selectedOilExtra = needsOilType && oilType ? oilTypes.find((o) => o.code === oilType)?.extraPrice ?? 0 : 0

  const { total, totalKnown } = useMemo(() => {
    let sum = 0
    let known = true
    selectedNames.forEach((name) => {
      const svc = services.find((s) => s.name === name)
      if (svc?.price == null) {
        known = false
        return
      }
      sum += svc.price
      if (name === ENGINE_OIL_SERVICE_NAME) sum += selectedOilExtra
    })
    return { total: sum, totalKnown: known }
  }, [selectedNames, services, selectedOilExtra])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (selectedNames.length === 0) {
      setFormError('서비스를 1개 이상 선택해주세요.')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const created = await api.post('/api/reservations', {
        shopId: shop.id,
        items: selectedNames.map((name) => ({
          serviceName: name,
          oilType: name === ENGINE_OIL_SERVICE_NAME && oilType ? oilType : null,
        })),
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
          <p className="mt-1 text-sm text-ridefit-success">방문 예정일에 맞춰 매장에서 서비스를 받아보세요.</p>

          <dl className="mt-6 grid grid-cols-[6rem_1fr] gap-y-3 text-left text-sm">
            <dt className="text-ridefit-text-secondary">매장</dt>
            <dd className="text-ridefit-text">{reservation.shopName}</dd>
            <dt className="self-start text-ridefit-text-secondary">선택 서비스</dt>
            <dd className="text-ridefit-text">
              <ul className="flex flex-col gap-1">
                {reservation.items.map((item, i) => (
                  <li key={i}>
                    {item.serviceName}
                    {item.oilTypeLabel && <span className="text-ridefit-text-secondary"> · {item.oilTypeLabel}</span>}
                    <span className="text-ridefit-text-secondary"> · {formatWon(item.price)}</span>
                  </li>
                ))}
              </ul>
            </dd>
            <dt className="text-ridefit-text-secondary">총 예상 금액</dt>
            <dd className="text-lg font-bold text-ridefit-primary">{formatWon(reservation.totalPrice)}</dd>
            <dt className="text-ridefit-text-secondary">방문 예정일</dt>
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
          예약 확정 여부는 매장 상황에 따라 달라질 수 있어요. 급한 정비가 필요하면 매장에 직접 문의해주세요.
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
        <h2 className="text-lg font-bold text-ridefit-text">예약 신청</h2>
        <p className="mt-1 text-sm text-ridefit-text-secondary">받고 싶은 서비스를 필요한 만큼 골라주세요.</p>

        {!isAuthenticated ? (
          <p className="mt-5 text-sm text-ridefit-text-secondary">
            예약은{' '}
            <Link to="/login" className="font-medium text-ridefit-primary hover:underline">
              로그인
            </Link>{' '}
            후 이용할 수 있어요.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-5">
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ridefit-text-secondary">1. 정비 서비스 선택 (여러 개 선택 가능)</legend>
              <div className="flex flex-col gap-2">
                {services.map((service) => {
                  const checked = selectedNames.includes(service.name)
                  return (
                    <label
                      key={service.name}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition ${
                        checked ? 'border-ridefit-primary bg-ridefit-primary/10' : 'border-ridefit-border bg-ridefit-bg hover:border-ridefit-primary/60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-ridefit-primary"
                        checked={checked}
                        onChange={() => toggleService(service.name)}
                      />
                      <span className="flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="font-medium text-ridefit-text">{service.name}</span>
                          <span className={checked ? 'font-semibold text-ridefit-primary' : 'text-ridefit-text-secondary'}>{formatWon(service.price)}</span>
                        </span>
                        {service.description && <span className="mt-0.5 block text-xs text-ridefit-text-secondary">{service.description}</span>}
                        {service.durationMinutes != null && <span className="block text-xs text-ridefit-text-secondary">약 {service.durationMinutes}분 소요</span>}
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            {needsOilType && (
              <fieldset className="rounded-lg border border-ridefit-border bg-ridefit-bg p-4">
                <legend className="mb-1 px-1 text-sm font-medium text-ridefit-text-secondary">엔진오일 종류 선택</legend>
                <p className="mb-3 text-xs text-ridefit-text-secondary">원하는 오일을 선택해주세요.</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {oilTypes.map((o) => (
                    <label
                      key={o.code}
                      className={`flex cursor-pointer flex-col gap-1 rounded-lg border px-3 py-3 transition ${
                        oilType === o.code ? 'border-ridefit-primary bg-ridefit-primary/10' : 'border-ridefit-border hover:border-ridefit-primary/60'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="oilType"
                          className="h-4 w-4 accent-ridefit-primary"
                          checked={oilType === o.code}
                          onChange={() => setOilType(o.code)}
                        />
                        <span className="font-medium text-ridefit-text">{o.label}</span>
                      </span>
                      <span className="text-xs text-ridefit-text-secondary">{o.description}</span>
                      <span className="text-xs font-semibold text-ridefit-primary">{o.extraPrice > 0 ? `+${o.extraPrice.toLocaleString()}원` : '기본 가격'}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-xs text-ridefit-text-secondary">※ 실제 오일 브랜드와 규격은 매장/차량에 따라 달라질 수 있어요.</p>
              </fieldset>
            )}

            {selectedNames.length > 0 && (
              <div className="rounded-lg border border-ridefit-border bg-ridefit-bg px-4 py-3">
                <p className="text-sm font-medium text-ridefit-text-secondary">선택 서비스</p>
                <ul className="mt-1 flex flex-col gap-0.5 text-sm text-ridefit-text">
                  {selectedNames.map((name) => (
                    <li key={name} className="flex items-center justify-between">
                      <span>
                        {name}
                        {name === ENGINE_OIL_SERVICE_NAME && oilType && (
                          <span className="text-ridefit-text-secondary"> · {oilTypes.find((o) => o.code === oilType)?.label}</span>
                        )}
                      </span>
                      <span className="text-ridefit-text-secondary">{formatWon(services.find((s) => s.name === name)?.price)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between border-t border-ridefit-border pt-2">
                  <span className="font-semibold text-ridefit-text">총 예상 금액</span>
                  <span className="text-lg font-bold text-ridefit-primary">{totalKnown ? `${total.toLocaleString()}원` : '가격 정보 준비중'}</span>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
                2. 방문 희망 날짜
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
              disabled={submitting || selectedNames.length === 0}
              className="rounded-lg bg-ridefit-primary px-4 py-2.5 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? '신청 중...' : selectedNames.length > 0 ? `예약 신청 · ${totalKnown ? `${total.toLocaleString()}원` : '가격 확인 필요'}` : '서비스를 선택해주세요'}
            </button>
            {formError && <p className="text-sm text-ridefit-danger">{formError}</p>}
          </form>
        )}
      </section>
    </div>
  )
}

export default ServiceDetail
