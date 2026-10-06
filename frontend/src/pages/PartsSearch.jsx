import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, ExternalLink, Heart, Star } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import FitVehiclePicker from '../components/FitVehiclePicker'
import { Ico } from '../components/Icon'
import PartBadges from '../components/PartBadges'
import SafeImage from '../components/SafeImage'
import SellerListings from '../components/SellerListings'
import Vehicle360Viewer from '../components/Vehicle360Viewer'
import VehicleFitStage from '../components/VehicleFitStage'
import VehicleYearBadge, { ModelImageNotice } from '../components/VehicleYearBadge'
import { displayImageUrl } from '../constants/productImages'
import { getVehicle360Frames, getVehicle360StartIndex } from '../constants/vehicle360'
import { getStageScale, getVehicleStageAspectRatio } from '../constants/vehicleFitPositions'
import { api } from '../lib/api'
import { formatFitmentYears } from '../lib/fitment'
import { loadPartCategorySlugs } from '../lib/guide'

const STATUS_STYLE = {
  호환가능: 'text-ridefit-success',
  브라켓필요: 'text-ridefit-warning',
  호환불가: 'text-ridefit-danger',
}

const PAGE_SIZE = 12

const formatDay = (iso) => (iso ? iso.slice(0, 10).replaceAll('-', '.') : null)
const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// 카드 안 가격 영역: "판매처 가격"(등록된 실제 판매처의 등록/확인 가격, 실시간 조회 아님, 최대 3곳) /
// "확인된 가격 중 최저"(가격 확인 판매처 2곳 이상일 때만) / "RIDEFIT 판매 가격"(RIDEFIT에서 실제 결제하는 가격 - 판매처 가격과 별개)를
// 섞지 않고 따로 보여준다. 결제 금액은 항상 RIDEFIT 판매 가격(서버 계산)이고, 외부 판매처 가격은 참고용이다.
// 상품 주소가 저장된 판매처만 외부 링크(새 탭)로 연결한다(주소를 만들지 않는다).
function PricePreview({ part, summary, detailTo }) {
  const registered = part.price != null ? (
    <p className="mt-1.5 text-xs text-ridefit-text-secondary" data-testid={`registered-price-${part.partId}`}>
      RIDEFIT 판매 가격 <span className="font-semibold text-ridefit-text">{part.price.toLocaleString()}원</span>
    </p>
  ) : null
  if (!summary) {
    return (
      <div className="mt-3">
        <p className="text-xs text-ridefit-text-secondary">판매처 가격 불러오는 중...</p>
        {registered}
      </div>
    )
  }
  if (summary.sellerCount === 0) {
    return (
      <div className="mt-3" data-testid={`price-preview-${part.partId}`}>
        <p className="rounded-lg border border-dashed border-ridefit-border px-3 py-2 text-xs text-ridefit-text-secondary">등록된 판매처 가격 없음</p>
        {registered}
      </div>
    )
  }
  return (
    <div className="mt-3" data-testid={`price-preview-${part.partId}`}>
      <div className="rounded-lg border border-ridefit-border bg-ridefit-bg/60 px-3 py-2.5">
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2 text-[11px] text-ridefit-text-secondary">
          <span className="font-semibold text-ridefit-text">외부 판매처 참고 가격</span>
          {summary.latestCheckedAt && <span>가격 확인일 {formatDay(summary.latestCheckedAt)} · 실시간 조회 아님</span>}
        </div>
        <ul className="flex flex-col gap-1">
          {summary.sellers.map((s, i) => {
            const host = s.productUrl ? hostOf(s.productUrl) : null
            const row = (
              <>
                <span className="min-w-0 truncate">{s.sellerName}</span>
                <span className="shrink-0 font-semibold text-ridefit-text">
                  {s.price != null ? `${s.price.toLocaleString()}원` : '가격 확인 필요'}
                  {s.productUrl && <Ico as={ExternalLink} className="ml-1 text-ridefit-text-secondary" />}
                </span>
              </>
            )
            return (
              <li key={i} className="text-sm text-ridefit-text-secondary">
                {s.productUrl ? (
                  <a
                    href={s.productUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={`${host ?? '판매처'} 상품 페이지로 이동(외부 사이트, 새 탭)`}
                    className="flex items-center justify-between gap-2 rounded hover:text-ridefit-primary"
                  >
                    {row}
                  </a>
                ) : (
                  <span className="flex items-center justify-between gap-2">{row}</span>
                )}
              </li>
            )
          })}
        </ul>
        {(summary.lowestPrice != null || summary.moreSellers > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 border-t border-ridefit-border pt-1.5 text-xs">
            {summary.lowestPrice != null ? (
              <span className="font-semibold text-ridefit-primary">확인된 가격 중 최저 {summary.lowestPrice.toLocaleString()}원</span>
            ) : (
              <span />
            )}
            {summary.moreSellers > 0 && (
              <Link to={detailTo} className="text-ridefit-primary hover:underline">
                + {summary.moreSellers}개 판매처
              </Link>
            )}
          </div>
        )}
      </div>
      {registered}
    </div>
  )
}

// 예전 서버처럼 /api/parts/listings-summary 가 없을 때: 판매처가 있는 부품만 /api/parts/{id}/listings 로 같은 요약을 만든다.
const summarizeListings = (partId, listings) => {
  const real = listings
    .filter((l) => !l.sample)
    .sort((a, b) => (a.price == null) - (b.price == null) || (a.price ?? 0) - (b.price ?? 0))
  const priced = real.filter((l) => l.price != null)
  const validUrl = (u) => {
    try {
      const x = new URL(u)
      return x.protocol === 'http:' || x.protocol === 'https:' ? u : null
    } catch {
      return null
    }
  }
  const checked = real.map((l) => l.checkedAt).filter(Boolean).sort()
  const top = real.slice(0, 3)
  return {
    partId,
    sellerCount: real.length,
    pricedCount: priced.length,
    lowestPrice: priced.length >= 2 ? priced[0].price : null,
    latestCheckedAt: checked.length ? checked[checked.length - 1] : null,
    sellers: top.map((l) => ({ sellerName: l.sellerName, price: l.price, productUrl: validUrl(l.sourceUrl), checkedAt: l.checkedAt })),
    moreSellers: Math.max(0, real.length - top.length),
  }
}

// "부품 찾아보기": 내 차량 이미지를 중심에 두고, 부품을 켜고 끄면서 조합을 맞춰보는 커스터마이징 화면.
// 상품을 나열해서 파는 화면이 아니라 FitRoom과 같은 "장착 시뮬레이션" 언어를 그대로 쓴다.
function PartsSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [vehicles, setVehicles] = useState([])
  const [vehiclesLoading, setVehiclesLoading] = useState(true)
  const [parts, setParts] = useState([])
  // 이 차량에 "호환불가"로 확인된 부품(목록에서는 빼고 개수/이름만 안내)
  const [incompatibleParts, setIncompatibleParts] = useState([])
  // partId -> 등록된 판매처 가격 요약(/api/parts/listings-summary). 실시간 조회가 아닌 등록/확인 가격.
  const [listingSummaries, setListingSummaries] = useState({})
  const [categories, setCategories] = useState([])
  const [category, setCategory] = useState(null)
  // 부품명/카테고리 검색어(현재 차량의 호환 부품 안에서만 거른다).
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [viewMode, setViewMode] = useState('fit') // 'fit' | '360' - 차량 전체 보기(360)와 부품 장착(2D)은 서로 다른 화면이다.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
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

  // 저장(즐겨찾기)은 "지금 고른 차량"에 저장된다 - 차량을 바꾸면 그 차량에 저장한 부품 표시로 바뀐다.
  useEffect(() => {
    if (!vehicleId) return
    setFavoritePartIds(new Set())
    api
      .get(`/api/me/favorites?myVehicleId=${vehicleId}`)
      .then((data) => setFavoritePartIds(new Set(data.map((f) => f.partId))))
      .catch(() => {})
  }, [vehicleId])

  // 지금 차량에 검색/카테고리 결과가 없을 때 "내 다른 차량에는 호환 부품이 있다"를 실제 호환 데이터로만 알려준다.
  const [otherVehicleSummary, setOtherVehicleSummary] = useState(null)
  useEffect(() => {
    api
      .get('/api/my-vehicles/compatible-summary')
      .then(setOtherVehicleSummary)
      .catch(() => setOtherVehicleSummary([]))
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
    ;(isFavorite
      ? api.del(`/api/me/favorites/${partId}?myVehicleId=${vehicleId}`)
      : api.post('/api/me/favorites', { partId, myVehicleId: Number(vehicleId) })
    ).catch(() => {
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
    // 카테고리와 무관하게 호환 부품 전체를 받아두고 목록만 클라이언트에서 거른다.
    // 서버에서 카테고리별로 다시 받으면 다른 카테고리에서 장착해둔 부품이 selectedParts에서 사라진다.
    api
      .get(`/api/my-vehicles/${vehicleId}/compatible-parts`)
      .then((data) => {
        // 목록에는 장착 가능한(호환가능/브라켓필요) 부품만. 호환불가로 확인된 부품은 숨기지 않고 따로 알려준다.
        const fit = data.filter((p) => p.status === '호환가능' || p.status === '브라켓필요')
        setParts(fit)
        setIncompatibleParts(data.filter((p) => !fit.includes(p)))
        setCategories([...new Set(fit.map((p) => p.category))])
        setListingSummaries({})
        if (fit.length > 0) {
          api
            .get(`/api/parts/listings-summary?partIds=${fit.map((p) => p.partId).join(',')}`, { auth: false })
            .then((rows) => setListingSummaries(Object.fromEntries(rows.map((r) => [r.partId, r]))))
            .catch(async () => {
              // 판매처가 있는 부품(stats.sellerCount > 0)만 개별 조회, 나머지는 "판매처 없음"
              const entries = await Promise.all(
                fit.map(async (p) => {
                  if (!(p.stats?.sellerCount > 0)) return [p.partId, summarizeListings(p.partId, [])]
                  try {
                    const listings = await api.get(`/api/parts/${p.partId}/listings`, { auth: false })
                    return [p.partId, summarizeListings(p.partId, listings)]
                  } catch {
                    return [p.partId, null]
                  }
                }),
              )
              setListingSummaries(Object.fromEntries(entries.filter(([, v]) => v)))
            })
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [vehicleId])

  const vehicle = vehicles.find((v) => String(v.id) === String(vehicleId)) ?? null
  const vehicle360Frames = getVehicle360Frames(vehicle)

  const handleVehicleChange = (id) => {
    if (category && !(otherVehicleSummary ?? []).find((v) => String(v.myVehicleId) === String(id))?.parts.some((p) => p.category === category)) {
      setCategory(null)
    }
    setSelectedPartIds([])
    setConflicts(null)
    setVisibleCount(PAGE_SIZE)
    setViewMode('fit')
    setSearchParams({ vehicleId: id })
  }

  const handleCategoryChange = (cat) => {
    setCategory(cat)
    setVisibleCount(PAGE_SIZE)
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
  const filteredParts = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return parts.filter(
      (p) =>
        (!category || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)),
    )
  }, [parts, category, keyword])
  const visibleParts = filteredParts.slice(0, visibleCount)
  const vehicleName = vehicle ? vehicle.nickname || vehicle.modelYearLabel : '내 차량'
  const otherMatches = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q && !category) return []
    return (otherVehicleSummary ?? [])
      .filter((v) => String(v.myVehicleId) !== String(vehicleId))
      .map((v) => ({
        ...v,
        count: v.parts.filter(
          (p) => (!category || p.category === category) && (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)),
        ).length,
      }))
      .filter((v) => v.count > 0)
  }, [otherVehicleSummary, vehicleId, keyword, category])
  const hasMoreParts = filteredParts.length > visibleParts.length
  const activeConflictPairs = (conflicts ?? []).filter(
    (c) => selectedPartIds.includes(c.partAId) && selectedPartIds.includes(c.partBId),
  )
  const conflictPartIds = new Set(activeConflictPairs.flatMap((c) => [c.partAId, c.partBId]))

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
            <span className="text-sm font-semibold text-ridefit-text">부품을 찾는 차량</span>
            <select
              aria-label="부품을 찾는 차량"
              data-testid="parts-vehicle-select"
              value={vehicleId ?? ''}
              onChange={(e) => handleVehicleChange(e.target.value)}
              className="rounded-lg border border-ridefit-border bg-ridefit-card px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nickname || v.modelYearLabel}
                </option>
              ))}
            </select>
            <Link to="/garage" className="text-sm font-medium text-ridefit-primary hover:underline">
              내 차고에서 관리하기 <Ico as={ArrowRight} />
            </Link>
          </div>

          {/* 위: 선택 차량 + 위치 미리보기 / 아래: 검색·카테고리 + 부품 카드 그리드 */}
          <div className="flex min-w-0 flex-col gap-8">
            {/* 현재 차량 + 선택한 부품 위치 미리보기 */}
            <div className="mx-auto w-full min-w-0 max-w-3xl" data-testid="parts-vehicle-stage">
              <div className="relative overflow-hidden rounded-xl border border-ridefit-border bg-ridefit-card p-6">
                {vehicle360Frames && (
                  <div className="mb-4 flex justify-center gap-2" role="group" aria-label="차량 보기 방식">
                    <button
                      type="button"
                      onClick={() => setViewMode('fit')}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        viewMode === 'fit' ? 'bg-ridefit-primary text-white' : 'bg-ridefit-bg text-ridefit-text-secondary hover:bg-ridefit-bg-alt'
                      }`}
                    >
                      부품 장착
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('360')}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        viewMode === '360' ? 'bg-ridefit-primary text-white' : 'bg-ridefit-bg text-ridefit-text-secondary hover:bg-ridefit-bg-alt'
                      }`}
                    >
                      360° 보기
                    </button>
                  </div>
                )}

                <div className="relative isolate mx-auto w-full max-w-2xl">
                <VehicleYearBadge vehicle={vehicle} />
                {viewMode === '360' && vehicle360Frames ? (
                  // "부품 장착" 무대(VehicleFitStage)와 같은 종횡비를 써서, 두 보기 모드를 오갈 때
                  // 차량이 갑자기 커지거나 작아 보이지 않게 한다(둘 다 실제 사진 비율 기준).
                  <Vehicle360Viewer
                    frames={vehicle360Frames}
                    alt={vehicle?.nickname || vehicle?.modelYearLabel}
                    className="mx-auto w-full max-w-2xl"
                    style={{ aspectRatio: getVehicleStageAspectRatio(vehicle) }}
                    fillScale={getStageScale(vehicle)}
                    startIndex={getVehicle360StartIndex(vehicle?.modelImageUrl)}
                    normalizeTo={vehicle?.modelImageUrl}
                  />
                ) : (
                  <VehicleFitStage vehicle={vehicle} parts={selectedParts} conflictPartIds={conflictPartIds} />
                )}
                </div>
                <ModelImageNotice vehicle={vehicle} className="mt-2" />

                <p className="mt-4 text-center text-sm font-medium text-ridefit-text">
                  {vehicle ? vehicle.nickname || vehicle.modelYearLabel : '차량 선택'}
                </p>
                {viewMode === 'fit' && selectedParts.length === 0 && (
                  <p className="mt-1 text-center text-xs text-ridefit-text-secondary">
                    아래 목록에서 [위치 미리보기]를 누르면 차량 위에 표시돼요.
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
                        <li key={c.id} className="rounded-lg border border-ridefit-danger-border bg-ridefit-danger-bg px-3 py-2 text-xs text-ridefit-danger">
                          {c.partAName} + {c.partBName}: {c.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* 검색 + 카테고리 필터 + 부품 목록 */}
            <div className="min-w-0">
              <input
                type="search"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value)
                  setVisibleCount(PAGE_SIZE)
                }}
                placeholder={`${vehicle?.vehicleModelName ?? '내 차량'} 호환 부품 검색 (예: 머플러, 윈드스크린)`}
                aria-label="호환 부품 검색"
                className="mb-3 w-full rounded-lg border border-ridefit-border bg-ridefit-card px-3 py-2 text-sm text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
              />
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleCategoryChange(null)}
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
                    onClick={() => handleCategoryChange(cat)}
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
              {error && <p className="text-ridefit-danger">에러: {error}</p>}

              {!loading && !error && visibleParts.length === 0 && (
                <div className="rounded-xl border border-dashed border-ridefit-border bg-ridefit-card px-4 py-5 text-sm" data-testid="parts-empty">
                  <p className="text-ridefit-text">
                    {keyword.trim() || category
                      ? `현재 선택한 ${vehicleName}에는 확인된 호환 ${keyword.trim() || category} 부품이 없습니다.`
                      : `아직 ${vehicleName}에 대해 호환이 확인된 부품이 없어요.`}
                  </p>
                  {otherMatches.length > 0 && (
                    <div className="mt-3" data-testid="parts-other-vehicles">
                      <p className="text-xs text-ridefit-text-secondary">내 다른 차량에는 호환이 확인된 부품이 있어요.</p>
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {otherMatches.map((m) => (
                          <li key={m.myVehicleId} className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-xs text-ridefit-text">
                              {m.label} · {m.count}개
                            </span>
                            <button
                              type="button"
                              onClick={() => handleVehicleChange(String(m.myVehicleId))}
                              className="shrink-0 rounded-full border border-ridefit-primary px-2.5 py-0.5 text-xs font-medium text-ridefit-primary transition hover:bg-ridefit-primary/10"
                            >
                              이 차량으로 보기
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {!loading && !error && incompatibleParts.length > 0 && (
                <p className="mb-3 rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2 text-xs text-ridefit-text-secondary" data-testid="parts-incompatible-note">
                  {vehicleName}에는 맞지 않는 것으로 확인된 부품 {incompatibleParts.length}개는 목록에서 뺐어요:{' '}
                  {incompatibleParts.map((p) => (
                    <Link key={p.partId} to={`/parts/${p.partId}?vehicleId=${vehicleId}`} className="mr-2 text-ridefit-text hover:underline">
                      {p.name}
                    </Link>
                  ))}
                </p>
              )}

              {!loading && !error && visibleParts.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="parts-grid">
                  {visibleParts.map((part) => {
                    const isActive = selectedPartIds.includes(part.partId)
                    return (
                      <div
                        key={part.partId}
                        className={`flex min-w-0 flex-col rounded-xl border p-4 transition ${
                          isActive ? 'border-ridefit-primary bg-ridefit-primary/5' : 'border-ridefit-border bg-ridefit-card'
                        }`}
                        data-testid={`parts-card-${part.partId}`}
                      >
                        {/* 1) 상품명 + 호환 + 이미지 */}
                        <div className="flex gap-3">
                          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-ridefit-border bg-white">
                            <SafeImage
                              src={displayImageUrl(part.imageUrl)}
                              alt={part.name}
                              className="h-full w-full object-contain p-1.5"
                              fallbackText="이미지 준비 중"
                              fallbackClassName="h-full w-full !bg-white text-[10px] !text-slate-400"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link
                              to={`/parts/${part.partId}?vehicleId=${vehicleId}`}
                              className="line-clamp-2 text-[15px] font-semibold leading-snug text-ridefit-text hover:underline"
                              title={part.name}
                            >
                              {part.name}
                            </Link>
                            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                              <span className={`font-semibold ${STATUS_STYLE[part.status] ?? 'text-ridefit-text-secondary'}`}>
                                {vehicle?.vehicleModelName ?? '내 차량'} {part.status}
                              </span>
                              <span className="text-ridefit-text-secondary">{part.category}</span>
                              {part.stats?.ratingCount > 0 && (
                                <span className="text-ridefit-text-secondary">
                                  <Ico as={Star} className="text-ridefit-warning" filled /> {part.stats.avgRating.toFixed(1)} ({part.stats.ratingCount})
                                </span>
                              )}
                            </p>
                            {/* 이 차종에서 이 부품이 장착 가능한 연식(compatibility 기준). 상세는 부품 상세의 "호환 차량". */}
                            {formatFitmentYears(part.sameModelFitments) && (
                              <p className="mt-0.5 truncate text-[11px] text-ridefit-text-secondary" data-testid={`fit-years-${part.partId}`}>
                                적용 연식: {formatFitmentYears(part.sameModelFitments)}
                              </p>
                            )}
                            {part.stats?.badges?.length > 0 && (
                              <div className="mt-1">
                                <PartBadges badges={part.stats.badges} />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 2) 가격: 외부 판매처 참고 가격 / 확인된 최저 / RIDEFIT 판매 가격을 구분해서 */}
                        <PricePreview
                          part={part}
                          summary={listingSummaries[part.partId]}
                          detailTo={`/parts/${part.partId}?vehicleId=${vehicleId}`}
                        />

                        {/* 3) 행동: 위치 미리보기(이 화면) / 저장(이 차량) / 상세 / 부품 입혀보기(FitRoom) - 카드 높이가 달라도 아래에 맞춘다 */}
                        <div className="mt-auto flex min-w-0 flex-wrap items-center gap-2 pt-3">
                          <button
                            type="button"
                            onClick={() => togglePartSelection(part.partId)}
                            aria-pressed={isActive}
                            data-testid={`parts-preview-${part.partId}`}
                            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                              isActive
                                ? 'border border-ridefit-primary bg-ridefit-primary/15 text-ridefit-primary'
                                : 'bg-ridefit-primary text-white hover:brightness-110'
                            }`}
                          >
                            {isActive ? <><Ico as={Check} className="mr-1" />위치 미리보기 중</> : '위치 미리보기'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => toggleFavorite(e, part.partId)}
                            aria-label="즐겨찾기"
                            aria-pressed={favoritePartIds.has(part.partId)}
                            title={`${vehicleName}에 ${favoritePartIds.has(part.partId) ? '저장됨 (눌러서 해제)' : '저장'}`}
                            data-testid={`parts-save-${part.partId}`}
                            className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                              favoritePartIds.has(part.partId)
                                ? 'border-ridefit-warning/60 bg-ridefit-warning/10 text-ridefit-warning'
                                : 'border-ridefit-border text-ridefit-text-secondary hover:border-ridefit-warning hover:text-ridefit-warning'
                            }`}
                          >
                            <Ico as={Heart} className="mr-1" filled={favoritePartIds.has(part.partId)} />{favoritePartIds.has(part.partId) ? '저장됨' : '저장하기'}
                          </button>
                          <Link
                            to={`/parts/${part.partId}?vehicleId=${vehicleId}`}
                            className="rounded-lg border border-ridefit-border px-3 py-2 text-xs font-medium text-ridefit-text-secondary transition hover:border-ridefit-primary hover:text-ridefit-primary"
                          >
                            상세보기
                          </Link>
                          <FitVehiclePicker
                            partId={part.partId}
                            vehicles={vehicles}
                            currentVehicleId={vehicleId}
                            className="min-w-0"
                            buttonClassName="rounded-lg bg-ridefit-primary/10 px-3 py-2 text-xs font-semibold text-ridefit-primary transition hover:bg-ridefit-primary/20 disabled:opacity-50"
                          />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setExpandedPartId((prev) => (prev === part.partId ? null : part.partId))}
                            className="text-[11px] font-medium text-ridefit-text-secondary hover:text-ridefit-primary hover:underline"
                          >
                            {expandedPartId === part.partId ? '판매처 상세 닫기' : '판매처 상세 · 판매처 추가'}
                          </button>
                          {part.installVideoUrl && (
                            <a href={part.installVideoUrl} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-ridefit-text-secondary hover:text-ridefit-primary hover:underline">
                              설치 영상 <Ico as={ExternalLink} />
                            </a>
                          )}
                        </div>
                        {expandedPartId === part.partId && (
                          <div className="mt-2">
                            <SellerListings partId={part.partId} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {hasMoreParts && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                      className="col-span-full rounded-lg border border-ridefit-border py-2 text-sm font-medium text-ridefit-text-secondary transition hover:border-ridefit-primary hover:text-ridefit-primary"
                    >
                      더보기 ({filteredParts.length - visibleParts.length}개 더 있음)
                    </button>
                  )}
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
