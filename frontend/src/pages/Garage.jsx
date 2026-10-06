import { useEffect, useState } from 'react'
import { ArrowRight, Heart, Images } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Ico } from '../components/Icon'
import ProductImage from '../components/ProductImage'
import SafeImage from '../components/SafeImage'
import SimilarVehicles from '../components/SimilarVehicles'
import Vehicle360Viewer from '../components/Vehicle360Viewer'
import { VEHICLE_PLACEHOLDER_IMAGE } from '../constants/images'
import { getVehicle360Frames, getVehicle360StartIndex } from '../constants/vehicle360'
import { api } from '../lib/api'

const formatPrice = (price) => (price != null ? `${price.toLocaleString()}원` : '가격 정보 없음')
const formatDateTime = (value) =>
  new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

// 내 차고에서는 최근 결과 몇 개만 보여주고, 전체는 FitRoom의 "저장된 장착 모습"에서 본다.
const SAVED_FIT_PREVIEW = 4

// 내 차고 = "내가 등록한 차량" + "그 차량에 저장한 부품" + 아래쪽 "추천 상품".
// 저장한 부품은 차량별(favorite.my_vehicle_id)이다 - 다른 차량에 저장한 부품은 섞이지 않는다.
// 차량 구분이 생기기 전에 저장한 예전 즐겨찾기(차량 미지정)는 어느 차량인지 추측하지 않고 따로 보여준다.
// 이 차량의 호환 부품 전체 목록은 여기서 보여주지 않는다(내가 가진/저장한 부품으로 착각하게 되므로) -
// 호환 부품은 부품 입혀보기(/garage/:id/fit)와 부품 찾아보기에서 고른다.
function Garage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [favorites, setFavorites] = useState(null)
  const [unassigned, setUnassigned] = useState([])
  const [savingPartId, setSavingPartId] = useState(null)
  // 선택 차량 기준: 즐겨찾기 부품의 호환 여부 표시용 호환 부품 id(상태) / 추천 상품
  const [compatStatusById, setCompatStatusById] = useState(null)
  const [recommended, setRecommended] = useState(null)
  // 선택 차량으로 만든 저장된 장착 모습(FitRoom과 같은 /api/ai-fit/results - 조회만, 새로 생성하지 않는다)
  const [savedFits, setSavedFits] = useState(null)

  useEffect(() => {
    api
      .get('/api/my-vehicles')
      .then(setVehicles)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    api
      .get('/api/me/favorites?unassigned=true')
      .then(setUnassigned)
      .catch(() => setUnassigned([]))
  }, [])

  const selectedId = searchParams.get('v')
  const vehicle = vehicles.find((v) => String(v.id) === selectedId) ?? vehicles[0] ?? null

  useEffect(() => {
    if (!vehicle) return
    let alive = true
    setCompatStatusById(null)
    setRecommended(null)
    setFavorites(null)
    setSavedFits(null)
    api
      .get(`/api/ai-fit/results?myVehicleId=${vehicle.id}`)
      // 이 차량으로 만든 결과만(my_vehicle_id 일치). 차량 구분 전 예전 결과(null)는 같은 차종이어도 내 차고에는 넣지 않는다.
      .then((data) => alive && setSavedFits(data.filter((r) => r.myVehicleId === vehicle.id)))
      .catch(() => alive && setSavedFits([]))
    api
      .get(`/api/me/favorites?myVehicleId=${vehicle.id}`)
      .then((data) => alive && setFavorites(data))
      .catch(() => alive && setFavorites([]))
    api
      .get(`/api/my-vehicles/${vehicle.id}/compatible-parts`)
      .then((data) => alive && setCompatStatusById(new Map(data.map((p) => [p.partId, p.status]))))
      .catch(() => alive && setCompatStatusById(new Map()))
    api
      .get(`/api/my-vehicles/${vehicle.id}/recommended-parts?limit=8`)
      .then((data) => alive && setRecommended(data))
      .catch(() => alive && setRecommended([]))
    return () => {
      alive = false
    }
  }, [vehicle?.id])

  // 차량 미지정 저장 부품은 사용자가 직접 "이 차량에 저장"을 누를 때만 이 차량에 연결한다(자동 연결 없음).
  const saveToVehicle = async (partId) => {
    setSavingPartId(partId)
    try {
      await api.post('/api/me/favorites', { partId, myVehicleId: vehicle.id })
      setFavorites(await api.get(`/api/me/favorites?myVehicleId=${vehicle.id}`))
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingPartId(null)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('이 차량을 차고에서 삭제할까요?')) return
    setDeletingId(id)
    try {
      await api.del(`/api/my-vehicles/${id}`)
      setVehicles((prev) => prev.filter((v) => v.id !== id))
      if (String(id) === selectedId) setSearchParams({}, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const vehicleName = vehicle ? vehicle.nickname || vehicle.modelYearLabel : ''
  const frames = vehicle ? getVehicle360Frames(vehicle) : null

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ridefit-text">내 차고</h1>
        <Link
          to="/garage/new"
          className="rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
        >
          + 차량 등록
        </Link>
      </div>

      {loading && <p className="text-ridefit-text-secondary">불러오는 중...</p>}
      {error && <p className="text-ridefit-danger">에러: {error}</p>}

      {!loading && !error && vehicles.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-ridefit-border bg-ridefit-card px-6 py-16 text-center">
          <p className="text-ridefit-text-secondary">아직 등록된 차량이 없어요.</p>
          <Link
            to="/garage/new"
            className="rounded-lg bg-ridefit-primary px-4 py-2 font-semibold text-white transition hover:brightness-110"
          >
            첫 차량 등록하기
          </Link>
        </div>
      )}

      {!loading && vehicle && (
        <>
          {vehicles.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="내 차량 선택" data-testid="garage-vehicle-tabs">
              {vehicles.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSearchParams({ v: String(v.id) }, { replace: true })}
                  aria-pressed={v.id === vehicle.id}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    v.id === vehicle.id
                      ? 'border-ridefit-primary bg-ridefit-primary text-white'
                      : 'border-ridefit-border bg-ridefit-card text-ridefit-text-secondary hover:border-ridefit-primary'
                  }`}
                >
                  {v.nickname || v.modelYearLabel}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {/* 왼쪽: 내 차량 */}
            <section
              className="overflow-hidden rounded-xl border border-ridefit-border bg-ridefit-card shadow-lg"
              data-testid="garage-vehicle"
            >
              <Vehicle360Viewer
                key={vehicle.id}
                frames={frames ?? [vehicle.photoUrl || vehicle.modelImageUrl || VEHICLE_PLACEHOLDER_IMAGE]}
                startIndex={frames ? getVehicle360StartIndex(vehicle.modelImageUrl) : 0}
                alt={vehicleName}
                className="h-56 w-full p-3"
                showControls={false}
              />
              <div className="p-5">
                <p className="text-xs font-medium text-ridefit-primary">{vehicle.manufacturerName}</p>
                <p className="mt-1 text-xl font-semibold text-ridefit-text">{vehicleName}</p>
                {vehicle.nickname && <p className="text-sm text-ridefit-text-secondary">{vehicle.modelYearLabel}</p>}

                {/* 핵심 기능이라 가장 크게: 1) 부품 입혀보기 2) 차량 관리 */}
                <Link
                  to={`/garage/${vehicle.id}/fit`}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-ridefit-primary px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-ridefit-primary/25 transition hover:brightness-110"
                  data-testid="garage-fit-cta"
                >
                  부품 입혀보기
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
                <Link
                  to={`/garage/${vehicle.id}/edit`}
                  className="mt-2 block w-full rounded-lg border border-ridefit-border px-3 py-2.5 text-center text-sm font-semibold text-ridefit-text transition hover:border-ridefit-primary"
                >
                  차량 관리
                </Link>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <Link to={`/parts?vehicleId=${vehicle.id}`} className="font-medium text-ridefit-primary hover:underline">
                    부품 찾아보기
                  </Link>
                  <Link to={`/parts/import?vehicleId=${vehicle.id}`} className="font-medium text-ridefit-primary hover:underline">
                    부품 링크 확인
                  </Link>
                  <Link to={`/vehicles/${vehicle.vehicleModelId}`} className="font-medium text-ridefit-primary hover:underline">
                    차량 정보
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(vehicle.id)}
                    disabled={deletingId === vehicle.id}
                    className="ml-auto text-ridefit-text-secondary hover:text-ridefit-danger disabled:opacity-50"
                  >
                    {deletingId === vehicle.id ? '삭제 중...' : '차고에서 삭제'}
                  </button>
                </div>
              </div>
            </section>

            {/* 오른쪽: 내가 즐겨찾기한 부품만(호환 부품을 대신 채우지 않는다) */}
            <section
              className="flex flex-col rounded-xl border border-ridefit-border bg-ridefit-card p-5 shadow-lg"
              data-testid="garage-favorites"
            >
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-ridefit-text">
                  <Ico as={Heart} className="mr-1.5 text-ridefit-warning" filled />이 차량에 저장한 부품{favorites ? ` (${favorites.length})` : ''}
                </h2>
                <Link to={`/parts?vehicleId=${vehicle.id}`} className="text-xs font-medium text-ridefit-primary hover:underline">
                  부품 찾아보기 <Ico as={ArrowRight} />
                </Link>
              </div>

              <p className="-mt-1 mb-3 text-xs text-ridefit-text-secondary">
                {vehicleName}에 저장한 부품만 보여요. 다른 차량에 저장한 부품은 그 차량을 고르면 보여요.
              </p>
              {favorites === null && <p className="text-sm text-ridefit-text-secondary">불러오는 중...</p>}

              {favorites?.length === 0 && (
                <div
                  className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ridefit-border px-4 py-10 text-center"
                  data-testid="garage-favorites-empty"
                >
                  <p className="text-sm text-ridefit-text">아직 저장한 부품이 없어요.</p>
                  <p className="text-xs text-ridefit-text-secondary">마음에 드는 부품을 저장해보세요. 이 차량으로 부품 찾아보기에서 [저장]을 누르면 여기에 모여요.</p>
                </div>
              )}

              {favorites?.length > 0 && (
                <ul className="grid max-h-[26rem] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                  {favorites.map((f) => {
                    const status = compatStatusById?.get(f.partId)
                    return (
                      <li key={f.partId}>
                        <Link
                          to={`/parts/${f.partId}?vehicleId=${vehicle.id}`}
                          className="block overflow-hidden rounded-lg border border-ridefit-border bg-ridefit-bg transition hover:border-ridefit-primary"
                          data-testid={`garage-favorite-${f.partId}`}
                        >
                          <ProductImage src={f.imageUrl} alt={f.name} />
                          <div className="p-2">
                            <p className="line-clamp-2 text-xs font-medium text-ridefit-text" title={f.name}>
                              {f.name}
                            </p>
                            <p className="mt-0.5 text-[11px] text-ridefit-text-secondary">
                              {f.category} · {formatPrice(f.price)}
                            </p>
                            {compatStatusById && (
                              <p
                                className={`mt-0.5 text-[11px] font-medium ${
                                  status === '호환가능'
                                    ? 'text-ridefit-success'
                                    : status === '브라켓필요'
                                      ? 'text-ridefit-warning'
                                      : status === '호환불가'
                                        ? 'text-ridefit-danger'
                                        : 'text-ridefit-text-secondary'
                                }`}
                              >
                                {status ? `이 차량: ${status}` : '이 차량 호환 미확인'}
                              </p>
                            )}
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}

              {/* 차량 구분 없이 저장한 예전 즐겨찾기: 어느 차량인지 알 수 없어 자동으로 넣지 않는다 */}
              {unassigned.length > 0 && (
                <details className="mt-4 rounded-lg border border-dashed border-ridefit-border px-3 py-2" data-testid="garage-unassigned">
                  <summary className="cursor-pointer text-xs font-medium text-ridefit-text-secondary">
                    차량을 정하지 않고 저장한 부품 ({unassigned.length}) · 예전에 저장한 부품이에요
                  </summary>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {unassigned.map((f) => {
                      const already = favorites?.some((x) => x.partId === f.partId)
                      return (
                        <li key={f.partId} className="flex items-center justify-between gap-2 text-xs">
                          <Link to={`/parts/${f.partId}?vehicleId=${vehicle.id}`} className="min-w-0 truncate text-ridefit-text hover:underline">
                            {f.name}
                          </Link>
                          <button
                            type="button"
                            disabled={already || savingPartId === f.partId}
                            onClick={() => saveToVehicle(f.partId)}
                            className="shrink-0 rounded-full border border-ridefit-border px-2 py-0.5 text-ridefit-primary transition hover:border-ridefit-primary disabled:opacity-50"
                          >
                            {already ? '이 차량에 저장됨' : '이 차량에 저장'}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </details>
              )}
            </section>
          </div>

          {/* 저장된 장착 모습: 이 차량으로 [장착해보기]에서 만든 결과(최신순). 조회만 하고 새로 만들지 않는다. */}
          <section className="mt-5 rounded-xl border border-ridefit-border bg-ridefit-card p-5 shadow-lg" data-testid="garage-saved-fits">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-ridefit-text">
                <Ico as={Images} className="mr-1.5 text-ridefit-primary" />저장된 장착 모습{savedFits ? ` (${savedFits.length})` : ''}
              </h2>
              {savedFits?.length > 0 && (
                <Link to={`/garage/${vehicle.id}/fit`} className="text-xs font-medium text-ridefit-primary hover:underline">
                  {savedFits.length > SAVED_FIT_PREVIEW ? `FitRoom에서 전체 보기` : 'FitRoom 열기'} <Ico as={ArrowRight} />
                </Link>
              )}
            </div>
            <p className="-mt-1 mb-3 text-xs text-ridefit-text-secondary">
              이 차량({vehicleName})으로 장착해보기에서 만든 결과만 보여요. 장착 모습은 예시 이미지라 실제 호환 여부는 부품 정보에서 확인해주세요.
            </p>

            {savedFits === null && <p className="text-sm text-ridefit-text-secondary">불러오는 중...</p>}

            {savedFits?.length === 0 && (
              <div
                className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-ridefit-border px-4 py-8 text-center"
                data-testid="garage-saved-fits-empty"
              >
                <p className="text-sm text-ridefit-text">아직 저장된 장착 결과가 없어요.</p>
                <p className="text-xs text-ridefit-text-secondary">부품 입혀보기에서 [장착 모습 만들기]를 누르면 결과가 여기에도 모여요.</p>
                <Link to={`/garage/${vehicle.id}/fit`} className="text-sm font-medium text-ridefit-primary hover:underline">
                  장착해보기 <Ico as={ArrowRight} />
                </Link>
              </div>
            )}

            {savedFits?.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {savedFits.slice(0, SAVED_FIT_PREVIEW).map((r) => {
                  const title = r.partNames.join(' + ')
                  return (
                    <li key={r.id}>
                      <Link
                        to={`/garage/${vehicle.id}/fit?result=${r.id}`}
                        className="block h-full overflow-hidden rounded-lg border border-ridefit-border bg-ridefit-bg transition hover:border-ridefit-primary"
                        title={`${title} - FitRoom에서 크게 보기`}
                        data-testid={`garage-saved-fit-${r.id}`}
                      >
                        <SafeImage
                          src={r.imageUrl}
                          alt={`${title} 장착 모습`}
                          className="aspect-[4/3] w-full bg-black object-contain"
                          fallbackClassName="aspect-[4/3] w-full text-[10px]"
                          fallbackText="이미지 없음"
                        />
                        <div className="p-2">
                          <p className="line-clamp-2 text-xs font-medium text-ridefit-text">{title || '부품 정보 없음'}</p>
                          <p className="mt-0.5 text-[11px] text-ridefit-text-secondary">{formatDateTime(r.createdAt)} 저장</p>
                          <p className="mt-1 text-[11px] font-medium text-ridefit-primary">
                            FitRoom에서 보기 <Ico as={ArrowRight} />
                          </p>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* 아래: 추천 상품 - 이 차량에 장착 가능한 부품 중 실제 조회/장착해보기/후기/평점이 쌓인 것만 */}
          <section className="mt-12" data-testid="garage-recommended">
            <h2 className="text-lg font-semibold text-ridefit-text">추천 상품</h2>
            <p className="mb-4 mt-1 text-sm text-ridefit-text-secondary">
              {vehicleName}에 장착 가능한 부품 중 RIDEFIT에서 조회·장착해보기·후기가 많은 순이에요.
            </p>

            {recommended === null && <p className="text-sm text-ridefit-text-secondary">불러오는 중...</p>}

            {recommended?.length === 0 && (
              <div
                className="rounded-xl border border-dashed border-ridefit-border bg-ridefit-card px-6 py-10 text-center"
                data-testid="garage-recommended-empty"
              >
                <p className="text-sm text-ridefit-text">아직 추천할 근거(조회·장착해보기·후기)가 쌓인 부품이 없어요.</p>
                <Link
                  to={`/parts?vehicleId=${vehicle.id}`}
                  className="mt-2 inline-block text-sm font-medium text-ridefit-primary hover:underline"
                >
                  이 차량의 호환 부품 전체 보기 <Ico as={ArrowRight} />
                </Link>
              </div>
            )}

            {recommended?.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {recommended.map((p) => {
                  const s = p.stats
                  const reasons = [
                    s.viewCount > 0 && `조회 ${s.viewCount}`,
                    s.fitSelectionCount > 0 && `장착해보기 ${s.fitSelectionCount}`,
                    s.reviewCount > 0 && `후기 ${s.reviewCount}`,
                    s.avgRating != null && `평점 ${s.avgRating.toFixed(1)}`,
                  ].filter(Boolean)
                  return (
                    <li key={p.partId}>
                      <Link
                        to={`/parts/${p.partId}?vehicleId=${vehicle.id}`}
                        className="block h-full overflow-hidden rounded-xl border border-ridefit-border bg-ridefit-card transition hover:border-ridefit-primary"
                        data-testid={`garage-recommended-${p.partId}`}
                      >
                        <ProductImage src={p.imageUrl} alt={p.name} />
                        <div className="p-3">
                          <p className="text-[11px] text-ridefit-text-secondary">
                            {p.category} ·{' '}
                            <span className={p.status === '호환가능' ? 'text-ridefit-success' : 'text-ridefit-warning'}>{p.status}</span>
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-sm font-medium text-ridefit-text" title={p.name}>
                            {p.name}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-ridefit-text">{formatPrice(p.price)}</p>
                          {/* 등록된 실제 판매처 기준(실시간 아님). 판매처가 없으면 표시하지 않는다. */}
                          {s.sellerCount > 0 && (
                            <p className="text-[11px] text-ridefit-primary">
                              판매처 {s.sellerCount}곳{s.lowestPrice != null ? ` · 확인된 가격 ${s.lowestPrice.toLocaleString()}원부터` : ''}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-ridefit-text-secondary">{reasons.join(' · ')}</p>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <SimilarVehicles
            className="mt-16"
            ids={[...new Set(vehicles.map((v) => v.vehicleModelId))]}
            title="내 차량과 비슷한 차량"
            description="내 차고의 차량과 배기량, 차체 형태, 가격대, 라이딩 성향이 비슷한 차량이에요."
          />
        </>
      )}
    </div>
  )
}

export default Garage
