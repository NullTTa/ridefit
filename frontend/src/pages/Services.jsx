import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

const TYPE_EMOJI = {
  REPAIR: '🔧',
  OIL: '🛢️',
  TIRE: '⚫',
  WASH: '🧽',
  SELF_WASH: '🚿',
  SELF_REPAIR: '🛠️',
  SPECIALTY: '🏍️',
}

// 주변 정비·세차 서비스 목록 (지도 연동 전 단계의 목록형). 매장은 개발용 샘플이며, 예약은 RIDEFIT 안에서만 동작하는 가상 예약이다.
function Services() {
  const [types, setTypes] = useState([])
  const [type, setType] = useState('')
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/api/services/types', { auth: false }).then(setTypes).catch(() => setTypes([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    api
      .get(`/api/services/shops${type ? `?type=${type}` : ''}`, { auth: false })
      .then(setShops)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [type])

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="mb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-ridefit-primary">SERVICE · PROTOTYPE</p>
        <h1 className="mt-1 text-2xl font-bold text-ridefit-text">정비 · 세차 서비스</h1>
        <p className="mt-2 max-w-2xl text-sm text-ridefit-text-secondary">
          정비소, 오일 교환, 타이어, 세차장을 한곳에서 살펴보고 예약 과정을 미리 체험해보세요.
        </p>
      </div>

      <p className="mb-6 rounded-lg border border-yellow-800/70 bg-yellow-950/40 px-4 py-3 text-sm text-yellow-300">
        ⚠️ 지금 보이는 매장은 개발용 <strong>샘플 데이터</strong>이고, 예약은 RIDEFIT 안에서만 동작하는 <strong>가상 예약</strong>이에요.
        실제 업체에 전달되거나 결제가 발생하지 않아요.
      </p>

      <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="서비스 종류 필터">
        <button
          type="button"
          onClick={() => setType('')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            type === '' ? 'bg-ridefit-primary text-white' : 'bg-ridefit-card text-ridefit-text-secondary hover:bg-ridefit-border'
          }`}
        >
          전체
        </button>
        {types.map((t) => (
          <button
            key={t.code}
            type="button"
            onClick={() => setType(t.code)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              type === t.code ? 'bg-ridefit-primary text-white' : 'bg-ridefit-card text-ridefit-text-secondary hover:bg-ridefit-border'
            }`}
          >
            {TYPE_EMOJI[t.code]} {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-ridefit-text-secondary">불러오는 중...</p>}
      {error && <p className="text-red-400">에러: {error}</p>}
      {!loading && shops.length === 0 && <p className="text-ridefit-text-secondary">등록된 매장이 없어요.</p>}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shops.map((shop) => (
          <Link
            key={shop.id}
            to={`/services/${shop.id}`}
            className="flex flex-col rounded-xl border border-ridefit-border bg-ridefit-card p-5 shadow-lg transition hover:-translate-y-1 hover:border-ridefit-primary/60"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-full border border-ridefit-border px-2.5 py-0.5 text-xs text-ridefit-text-secondary">
                {TYPE_EMOJI[shop.type]} {shop.typeLabel}
              </span>
              {shop.sample && <span className="rounded-full bg-yellow-950 px-2 py-0.5 text-xs text-yellow-300">샘플</span>}
            </div>
            <h2 className="mt-3 text-lg font-bold text-ridefit-text">{shop.name}</h2>
            <p className="mt-1 text-xs text-ridefit-text-secondary">{shop.region}</p>
            <p className="mt-2 flex-1 text-sm text-ridefit-text-secondary">{shop.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {shop.menus.slice(0, 3).map((menu) => (
                <span key={menu} className="rounded bg-ridefit-bg px-2 py-0.5 text-xs text-ridefit-text-secondary">
                  {menu}
                </span>
              ))}
              {shop.menus.length > 3 && <span className="text-xs text-ridefit-text-secondary">+{shop.menus.length - 3}</span>}
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-dashed border-ridefit-border bg-ridefit-card p-5 text-sm text-ridefit-text-secondary">
        🗺️ 지도에서 내 주변 매장을 찾는 기능은 이후 단계에서 연동할 예정이에요. (매장 데이터에 위도/경도 필드가 이미 준비되어 있어요.)
      </div>
    </div>
  )
}

export default Services
