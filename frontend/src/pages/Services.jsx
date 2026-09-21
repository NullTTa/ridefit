import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import KakaoServiceMap from '../components/KakaoServiceMap'
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

// 주변 정비·세차 서비스: Kakao Map으로 8개 매장을 역 기준 위치에 표시 + 기존 목록/필터. 매장은 개발용 샘플이며, 예약은 RIDEFIT 안에서만 동작하는 가상 예약이다.
function Services() {
  const [types, setTypes] = useState([])
  const [type, setType] = useState('')
  const [shops, setShops] = useState([])
  const [allShops, setAllShops] = useState([]) // 지도는 필터와 무관하게 8개 매장을 전부 보여준다.
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedShopId, setSelectedShopId] = useState(null)

  useEffect(() => {
    api.get('/api/services/types', { auth: false }).then(setTypes).catch(() => setTypes([]))
    api.get('/api/services/shops', { auth: false }).then(setAllShops).catch(() => setAllShops([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    api
      .get(`/api/services/shops${type ? `?type=${type}` : ''}`, { auth: false })
      .then(setShops)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [type])

  const selectedShop = useMemo(() => allShops.find((s) => s.id === selectedShopId) ?? null, [allShops, selectedShopId])

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="mb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-ridefit-primary">SERVICE · PROTOTYPE</p>
        <h1 className="mt-1 text-2xl font-bold text-ridefit-text">정비 · 세차 서비스</h1>
        <p className="mt-2 max-w-2xl text-sm text-ridefit-text-secondary">
          정비소, 오일 교환, 타이어, 세차장을 한곳에서 살펴보고 예약 과정을 미리 체험해보세요.
        </p>
      </div>

      <p className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
        ⚠️ 지금 보이는 매장은 개발용 <strong>샘플 데이터</strong>이고, 예약은 RIDEFIT 안에서만 동작하는 <strong>가상 예약</strong>이에요.
        실제 업체에 전달되거나 결제가 발생하지 않아요.
      </p>

      <div className="mb-10">
        <h2 className="mb-3 text-sm font-semibold text-ridefit-text-secondary">RIDEFIT 서비스 지도</h2>
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <KakaoServiceMap shops={allShops} selectedShopId={selectedShopId} onSelectShop={(shop) => setSelectedShopId(shop.id)} />

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 rounded-xl border border-ridefit-border bg-ridefit-card p-3">
              {allShops.map((shop) => (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => setSelectedShopId(shop.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    selectedShopId === shop.id
                      ? 'bg-ridefit-primary text-white'
                      : 'bg-ridefit-bg text-ridefit-text-secondary hover:bg-ridefit-border'
                  }`}
                >
                  📍 {shop.address?.replace(/^.*\s(\S+역)\s인근$/, '$1') ?? shop.region}
                </button>
              ))}
            </div>

            {selectedShop ? (
              <div className="flex flex-1 flex-col rounded-xl border border-ridefit-primary/40 bg-ridefit-card p-4">
                <span className="text-xs text-ridefit-text-secondary">
                  {TYPE_EMOJI[selectedShop.type]} {selectedShop.typeLabel}
                </span>
                <h3 className="mt-1 text-lg font-bold text-ridefit-text">{selectedShop.name}</h3>
                <p className="mt-1 text-sm text-ridefit-text-secondary">📍 {selectedShop.address}</p>
                <p className="mt-2 flex-1 text-xs text-ridefit-text-secondary">{selectedShop.menus.slice(0, 3).join(' · ')}</p>
                <Link
                  to={`/services/${selectedShop.id}`}
                  className="mt-3 self-start rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  상세보기 · 가상 예약
                </Link>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-ridefit-border bg-ridefit-card p-4 text-center text-sm text-ridefit-text-secondary">
                지도의 핀이나 역 이름을 눌러 매장 정보를 확인하세요.
              </div>
            )}
          </div>
        </div>
      </div>

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
      {error && <p className="text-red-600">에러: {error}</p>}
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
              {shop.sample && <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs text-yellow-700">샘플</span>}
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
    </div>
  )
}

export default Services
