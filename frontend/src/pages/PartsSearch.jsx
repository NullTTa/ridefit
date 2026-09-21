import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PartBadges from '../components/PartBadges'
import SellerListings from '../components/SellerListings'
import { VEHICLE_PLACEHOLDER_IMAGE } from '../constants/images'
import { CATEGORY_POSITION, DEFAULT_POSITION } from '../constants/vehicleFitPositions'
import { api } from '../lib/api'
import { loadPartCategorySlugs } from '../lib/guide'

const STATUS_STYLE = {
  호환가능: 'text-ridefit-success',
  브라켓필요: 'text-ridefit-warning',
  호환불가: 'text-ridefit-danger',
}

// "부품 찾아보기": 내 차량 이미지를 중심에 두고, 부품을 켜고 끄면서 조합을 맞춰보는 커스터마이징 화면.
// 상품을 나열해서 파는 화면이 아니라 FitRoom과 같은 "장착 시뮬레이션" 언어를 그대로 쓴다.
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
  const [categorySlugs, setCategorySlugs] = useState({})

  useEffect(() => {
    loadPartCategorySlugs().then(setCategorySlugs)
  }, [])

  useEffect(() => {
    api
      .get('/api/me/favorites')
      .then((data) => setFavoritePartIds(new Set(data.map((f) => f.partId))))
      .catch(() => {})
  }, [])

  const toggleFavorite = (e, partId) => {
    e.preventDefault()
    e.stopPropagation()
    const isFavorite = favoritePartIds.has(partId)
    setFavoritePartIds((prev) => {
      const next = new Set(prev)
      isFavorite ? next.delete(partId) : next.add(partId)
      return next
    })
    ;(isFavorite ? api.del(`/api/me/favorites/${partId}`) : api.post('/api/me/favorites', { partId })).catch(() => {
      setFavoritePartIds((prev) => {
        const next = new Set(prev)
        isFavorite ? next.add(partId) : next.delete(partId)
        return next
      })
    })
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

  const vehicle = vehicles.find((v) => String(v.id) === String(vehicleId)) ?? null

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

  const selectedParts = useMemo(
    () => parts.filter((p) => selectedPartIds.includes(p.partId)),
    [parts, selectedPartIds],
  )
  const activeConflictPairs = (conflicts ?? []).filter(
    (c) => selectedPartIds.includes(c.partAId) && selectedPartIds.includes(c.partBId),
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="mb-1 text-2xl font-bold text-ridefit-text">부품 찾아보기</h1>
      <p className="mb-6 text-sm text-ridefit-text-secondary">
        내 차량 기준으로 이미 호환이 확인된 부품만 켜고 끄면서 조합을 맞춰볼 수 있어요.{' '}
        <Link to="/guide" className="font-medium text-ridefit-primary hover:underline">
          부품 · 소모품 정보
        </Link>
        {category && categorySlugs[category] && (
          <>
            {' '}
            ·{' '}
            <Link to={`/guide/${categorySlugs[category]}`} className="font-medium text-ridefit-primary hover:underline">
              {category}이(가) 뭔가요?
            </Link>
          </>
        )}
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
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <select
              value={vehicleId ?? ''}
              onChange={(e) => handleVehicleChange(e.target.value)}
              className="rounded-lg border border-ridefit-border bg-white px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nickname || v.modelYearLabel}
                </option>
              ))}
            </select>
            <Link to="/garage" className="text-sm font-medium text-ridefit-primary hover:underline">
              내 차고에서 관리하기 →
            </Link>
          </div>

          <div className="grid min-w-0 gap-8 lg:grid-cols-[1.1fr_1fr]">
            {/* 현재 차량 + 선택한 부품 위치 미리보기 */}
            <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
              <div className="relative overflow-hidden rounded-xl border border-ridefit-border bg-ridefit-card p-6">
                <div className="relative mx-auto aspect-[4/3] w-full max-w-lg">
                  <img
                    src={vehicle?.photoUrl || vehicle?.modelImageUrl || VEHICLE_PLACEHOLDER_IMAGE}
                    alt={vehicle?.modelYearLabel ?? '차량'}
                    className="h-full w-full object-contain"
                  />
                  {selectedParts.map((part) => {
                    const pos = CATEGORY_POSITION[part.category] ?? DEFAULT_POSITION
                    const hasConflict = activeConflictPairs.some(
                      (c) => c.partAId === part.partId || c.partBId === part.partId,
                    )
                    return (
                      <div
                        key={part.partId}
                        className="absolute -translate-x-1/2 -translate-y-1/2 animate-fadeIn"
                        style={{ top: pos.top, left: pos.left }}
                        title={part.name}
                      >
                        <span
                          className={`block rounded-full border px-2 py-1 text-xs font-semibold shadow-lg backdrop-blur ${
                            hasConflict
                              ? 'border-red-300 bg-red-50 text-red-700'
                              : 'border-ridefit-primary bg-white/90 text-ridefit-primary'
                          }`}
                        >
                          {part.category}
                          {hasConflict ? ' · 충돌' : ''}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-4 text-center text-sm font-medium text-ridefit-text">
                  {vehicle ? vehicle.nickname || vehicle.modelYearLabel : '차량 선택'}
                </p>
                {selectedParts.length === 0 && (
                  <p className="mt-1 text-center text-xs text-ridefit-text-secondary">
                    오른쪽에서 부품을 장착하면 이 위치에 표시돼요.
                  </p>
                )}
              </div>

              {selectedParts.length > 0 && (
                <div className="mt-4 rounded-xl border border-ridefit-border bg-ridefit-card p-4">
                  <p className="mb-1 text-sm font-semibold text-ridefit-text">
                    장착 중 ({selectedParts.length}개) · 합계{' '}
                    {selectedParts.reduce((sum, p) => sum + p.price, 0).toLocaleString()}원
                  </p>
                  <p className="text-xs text-ridefit-text-secondary">{selectedParts.map((p) => p.name).join(', ')}</p>
                  {selectedPartIds.length >= 2 && (
                    <button
                      type="button"
                      onClick={handleCheckConflicts}
                      disabled={checkingConflicts}
                      className="mt-3 rounded-lg bg-ridefit-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                    >
                      {checkingConflicts ? '확인 중...' : '동시 장착 충돌 확인'}
                    </button>
                  )}
                  {conflicts && conflicts.length === 0 && (
                    <p className="mt-2 text-xs text-ridefit-success">선택한 부품 사이에 알려진 충돌이 없어요.</p>
                  )}
                  {activeConflictPairs.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1">
                      {activeConflictPairs.map((c) => (
                        <li key={c.id} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          {c.partAName} + {c.partBName}: {c.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* 카테고리 필터 + 부품 목록 */}
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCategory(null)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    category === null
                      ? 'bg-ridefit-primary text-white'
                      : 'bg-ridefit-card text-ridefit-text-secondary hover:bg-ridefit-bg-alt'
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
                        : 'bg-ridefit-card text-ridefit-text-secondary hover:bg-ridefit-bg-alt'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {loading && <p className="text-ridefit-text-secondary">불러오는 중...</p>}
              {error && <p className="text-red-600">에러: {error}</p>}

              {!loading && !error && parts.length === 0 && (
                <p className="text-ridefit-text-secondary">아직 이 차량에 대해 호환이 확인된 부품이 없어요.</p>
              )}

              {!loading && !error && parts.length > 0 && (
                <div className="flex flex-col gap-3">
                  {parts.map((part) => {
                    const isActive = selectedPartIds.includes(part.partId)
                    return (
                      <div
                        key={part.partId}
                        className={`rounded-xl border p-3 transition ${
                          isActive ? 'border-ridefit-primary bg-ridefit-primary/5' : 'border-ridefit-border bg-ridefit-card'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {part.imageUrl ? (
                            <img
                              src={part.imageUrl}
                              alt={part.name}
                              className="h-16 w-16 shrink-0 rounded-lg border border-ridefit-border bg-white object-contain p-1"
                            />
                          ) : (
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-ridefit-border bg-ridefit-bg-alt text-[10px] text-ridefit-text-secondary">
                              이미지 준비중
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                to={`/parts/${part.partId}?vehicleId=${vehicleId}`}
                                className="truncate text-sm font-semibold text-ridefit-text hover:underline"
                              >
                                {part.name}
                              </Link>
                              <button
                                type="button"
                                onClick={(e) => toggleFavorite(e, part.partId)}
                                aria-label="즐겨찾기"
                                className={`shrink-0 text-lg leading-none ${
                                  favoritePartIds.has(part.partId) ? 'text-ridefit-warning' : 'text-ridefit-text-secondary/40 hover:text-ridefit-warning'
                                }`}
                              >
                                {favoritePartIds.has(part.partId) ? '★' : '☆'}
                              </button>
                            </div>
                            <p className={`text-xs font-medium ${STATUS_STYLE[part.status] ?? 'text-ridefit-text-secondary'}`}>
                              {part.category} · {part.status}
                            </p>
                            {part.stats?.badges?.length > 0 && (
                              <div className="mt-1">
                                <PartBadges badges={part.stats.badges} />
                              </div>
                            )}
                            <p className="mt-1 text-sm font-semibold text-ridefit-text">
                              {part.price.toLocaleString()}원
                              {part.stats?.lowestPrice != null && part.stats.lowestPrice < part.price && (
                                <span className="ml-2 text-xs font-normal text-ridefit-primary">
                                  최저가 {part.stats.lowestPrice.toLocaleString()}원
                                </span>
                              )}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => togglePartSelection(part.partId)}
                            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                              isActive
                                ? 'bg-ridefit-text text-white hover:brightness-125'
                                : 'bg-ridefit-primary text-white hover:brightness-110'
                            }`}
                          >
                            {isActive ? '장착 해제' : '장착'}
                          </button>
                        </div>

                        <div className="mt-2 flex items-center gap-3 pl-[76px]">
                          <button
                            type="button"
                            onClick={() => setExpandedPartId((prev) => (prev === part.partId ? null : part.partId))}
                            className="text-xs font-medium text-ridefit-primary hover:underline"
                          >
                            {expandedPartId === part.partId ? '판매처 비교 닫기' : '판매처 비교'}
                          </button>
                          {part.installVideoUrl && (
                            <a
                              href={part.installVideoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-ridefit-primary hover:underline"
                            >
                              설치 영상
                            </a>
                          )}
                        </div>
                        {expandedPartId === part.partId && (
                          <div className="mt-2 pl-[76px]">
                            <SellerListings partId={part.partId} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default PartsSearch
