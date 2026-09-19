import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SellerListings from '../components/SellerListings'
import { api } from '../lib/api'

const STATUS_STYLE = {
  호환가능: 'bg-green-950 text-green-300 border-green-800',
  브라켓필요: 'bg-yellow-950 text-yellow-300 border-yellow-800',
  호환불가: 'bg-red-950 text-red-300 border-red-800',
}
const DEFAULT_STATUS_STYLE = 'bg-ridefit-bg text-ridefit-text-secondary border-ridefit-border'

// "부품 찾아보기": 링크 없이도 내 등록 차량 기준으로 이미 호환이 확인된 부품을 카테고리별로 둘러보는 화면.
function PartsSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [vehicles, setVehicles] = useState([])
  const [vehiclesLoading, setVehiclesLoading] = useState(true)
  const [parts, setParts] = useState([])
  const [categories, setCategories] = useState([])
  const [category, setCategory] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [selectedPartIds, setSelectedPartIds] = useState([])
  const [conflicts, setConflicts] = useState(null)
  const [checkingConflicts, setCheckingConflicts] = useState(false)
  const [favoritePartIds, setFavoritePartIds] = useState(new Set())
  const [expandedPartId, setExpandedPartId] = useState(null)

  const vehicleId = searchParams.get('vehicleId')

  useEffect(() => {
    api
      .get('/api/me/favorites')
      .then((data) => setFavoritePartIds(new Set(data.map((f) => f.partId))))
      .catch(() => {})
  }, [])

  const toggleFavorite = async (e, partId) => {
    e.preventDefault()
    e.stopPropagation()
    const isFavorite = favoritePartIds.has(partId)
    setFavoritePartIds((prev) => {
      const next = new Set(prev)
      isFavorite ? next.delete(partId) : next.add(partId)
      return next
    })
    try {
      if (isFavorite) {
        await api.del(`/api/me/favorites/${partId}`)
      } else {
        await api.post('/api/me/favorites', { partId })
      }
    } catch {
      // 실패하면 별 표시를 원래 상태로 되돌린다.
      setFavoritePartIds((prev) => {
        const next = new Set(prev)
        isFavorite ? next.add(partId) : next.delete(partId)
        return next
      })
    }
  }

  useEffect(() => {
    api
      .get('/api/my-vehicles')
      .then((data) => {
        setVehicles(data)
        if (!vehicleId && data.length > 0) {
          setSearchParams({ vehicleId: String(data[0].id) }, { replace: true })
        }
      })
      .catch(() => setVehicles([]))
      .finally(() => setVehiclesLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!vehicleId) return
    setLoading(true)
    setError(null)
    const query = category ? `?category=${encodeURIComponent(category)}` : ''
    api
      .get(`/api/my-vehicles/${vehicleId}/compatible-parts${query}`)
      .then((data) => {
        setParts(data)
        if (!category) {
          setCategories([...new Set(data.map((p) => p.category))])
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [vehicleId, category])

  const handleVehicleChange = (id) => {
    setCategory(null)
    setSelectedPartIds([])
    setConflicts(null)
    setSearchParams({ vehicleId: id })
  }

  const togglePartSelection = (partId) => {
    setConflicts(null)
    setSelectedPartIds((prev) =>
      prev.includes(partId) ? prev.filter((id) => id !== partId) : [...prev, partId],
    )
  }

  const handleCheckConflicts = async () => {
    setCheckingConflicts(true)
    setError(null)
    try {
      const result = await api.post('/api/part-conflicts/check', { partIds: selectedPartIds })
      setConflicts(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setCheckingConflicts(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-ridefit-text">부품 찾아보기</h1>
      <p className="mb-6 text-sm text-ridefit-text-secondary">
        내가 등록한 차량 기준으로 이미 호환이 확인된 부품만 보여줘요.
      </p>

      {vehiclesLoading && <p className="text-ridefit-text-secondary">불러오는 중...</p>}

      {!vehiclesLoading && vehicles.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-ridefit-border bg-ridefit-card px-6 py-16 text-center">
          <p className="text-ridefit-text-secondary">먼저 내 차고에 차량을 등록해주세요.</p>
          <Link
            to="/garage/new"
            className="rounded-lg bg-ridefit-primary px-4 py-2 font-semibold text-white transition hover:brightness-110"
          >
            차량 등록하러 가기
          </Link>
        </div>
      )}

      {!vehiclesLoading && vehicles.length > 0 && (
        <>
          <select
            value={vehicleId ?? ''}
            onChange={(e) => handleVehicleChange(e.target.value)}
            className="mb-6 rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.modelYearLabel}
              </option>
            ))}
          </select>

          <div className="mb-8 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                category === null
                  ? 'bg-ridefit-primary text-white'
                  : 'bg-ridefit-card text-ridefit-text-secondary hover:bg-ridefit-border'
              }`}
            >
              전체
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  category === cat
                    ? 'bg-ridefit-primary text-white'
                    : 'bg-ridefit-card text-ridefit-text-secondary hover:bg-ridefit-border'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading && <p className="text-ridefit-text-secondary">불러오는 중...</p>}
          {error && <p className="text-red-400">에러: {error}</p>}

          {!loading && !error && parts.length === 0 && (
            <p className="text-ridefit-text-secondary">아직 이 차량에 대해 호환이 확인된 부품이 없어요.</p>
          )}

          {!loading && !error && parts.length > 0 && (
            <>
              <p className="mb-3 text-xs text-ridefit-text-secondary">
                여러 부품을 함께 장착할 계획이라면 체크 후 충돌 여부를 확인해보세요.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {parts.map((part) => (
                  <label
                    key={part.partId}
                    className={`block cursor-pointer rounded-xl border p-4 shadow-lg transition ${STATUS_STYLE[part.status] ?? DEFAULT_STATUS_STYLE} ${
                      selectedPartIds.includes(part.partId) ? 'ring-2 ring-ridefit-primary' : ''
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <input
                        type="checkbox"
                        checked={selectedPartIds.includes(part.partId)}
                        onChange={() => togglePartSelection(part.partId)}
                        className="h-4 w-4 accent-ridefit-primary"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => toggleFavorite(e, part.partId)}
                          aria-label="즐겨찾기"
                          className={`text-lg leading-none ${favoritePartIds.has(part.partId) ? 'text-yellow-400' : 'text-ridefit-text-secondary/50 hover:text-yellow-400'}`}
                        >
                          {favoritePartIds.has(part.partId) ? '★' : '☆'}
                        </button>
                        <span className="rounded-full bg-black/20 px-2 py-1 text-xs font-bold">{part.status}</span>
                      </div>
                    </div>
                    {part.imageUrl && (
                      <img src={part.imageUrl} alt={part.name} className="mb-3 h-28 w-full rounded-lg object-cover" />
                    )}
                    <p className="font-semibold">{part.name}</p>
                    <p className="mt-1 text-sm opacity-80">{part.category}</p>
                    <p className="mt-2 text-sm font-medium">{part.price.toLocaleString()}원</p>
                    {part.note && <p className="mt-2 text-xs opacity-70">{part.note}</p>}

                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setExpandedPartId((prev) => (prev === part.partId ? null : part.partId))
                        }}
                        className="text-xs font-medium text-ridefit-primary hover:underline"
                      >
                        {expandedPartId === part.partId ? '판매처 비교 닫기' : '판매처 비교'}
                      </button>
                      {part.installVideoUrl && (
                        <a
                          href={part.installVideoUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-medium text-ridefit-primary hover:underline"
                        >
                          설치 영상 ▶
                        </a>
                      )}
                    </div>

                    {expandedPartId === part.partId && <SellerListings partId={part.partId} />}
                  </label>
                ))}
              </div>

              {selectedPartIds.length >= 2 && (
                <div className="mt-6 rounded-xl border border-ridefit-border bg-ridefit-card p-4">
                  <button
                    type="button"
                    onClick={handleCheckConflicts}
                    disabled={checkingConflicts}
                    className="rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    {checkingConflicts ? '확인 중...' : `선택한 ${selectedPartIds.length}개 부품 충돌 확인`}
                  </button>

                  {conflicts && conflicts.length === 0 && (
                    <p className="mt-3 text-sm text-green-400">선택한 부품 사이에 알려진 충돌이 없어요.</p>
                  )}
                  {conflicts && conflicts.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2">
                      {conflicts.map((c) => (
                        <li key={c.id} className="rounded-lg border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
                          ⚠️ {c.partAName} + {c.partBName}: {c.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default PartsSearch
