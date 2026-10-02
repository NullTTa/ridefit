import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SafeImage from '../components/SafeImage'
import SimilarVehicles from '../components/SimilarVehicles'
import Vehicle360Viewer from '../components/Vehicle360Viewer'
import { VEHICLE_PLACEHOLDER_IMAGE } from '../constants/images'
import { getVehicle360Frames, getVehicle360StartIndex } from '../constants/vehicle360'
import { api } from '../lib/api'

const formatPrice = (price) => (price != null ? `${price.toLocaleString()}원` : '가격 정보 없음')

// 내 차고 = "내가 등록한 차량" + "내가 즐겨찾기한 부품" + 아래쪽 "추천 상품".
// 이 차량의 호환 부품 전체 목록은 여기서 보여주지 않는다(내가 가진/저장한 부품으로 착각하게 되므로) -
// 호환 부품은 부품 입혀보기(/garage/:id/fit)와 부품 찾아보기에서 고른다.
function Garage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [favorites, setFavorites] = useState(null)
  // 선택 차량 기준: 즐겨찾기 부품의 호환 여부 표시용 호환 부품 id(상태) / 추천 상품
  const [compatStatusById, setCompatStatusById] = useState(null)
  const [recommended, setRecommended] = useState(null)

  useEffect(() => {
    api
      .get('/api/my-vehicles')
      .then(setVehicles)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    api
      .get('/api/me/favorites')
      .then(setFavorites)
      .catch(() => setFavorites([]))
  }, [])

  const selectedId = searchParams.get('v')
  const vehicle = vehicles.find((v) => String(v.id) === selectedId) ?? vehicles[0] ?? null

  useEffect(() => {
    if (!vehicle) return
    let alive = true
    setCompatStatusById(null)
    setRecommended(null)
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
                <p className="text-xs font-medium text-ridefit-primary">🏍️ {vehicle.manufacturerName}</p>
                <p className="mt-1 text-xl font-semibold text-ridefit-text">{vehicleName}</p>
                {vehicle.nickname && <p className="text-sm text-ridefit-text-secondary">{vehicle.modelYearLabel}</p>}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    to={`/garage/${vehicle.id}/edit`}
                    className="rounded-lg border border-ridefit-border px-3 py-2 text-center text-sm font-semibold text-ridefit-text transition hover:border-ridefit-primary"
                  >
                    차량 관리
                  </Link>
                  <Link
                    to={`/garage/${vehicle.id}/fit`}
                    className="rounded-lg bg-ridefit-primary px-3 py-2 text-center text-sm font-semibold text-white transition hover:brightness-110"
                  >
                    부품 입혀보기
                  </Link>
                </div>

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
                  ⭐ 내가 저장한 부품{favorites ? ` (${favorites.length})` : ''}
                </h2>
                <Link to={`/parts?vehicleId=${vehicle.id}`} className="text-xs font-medium text-ridefit-primary hover:underline">
                  부품 찾아보기 →
                </Link>
              </div>

              {favorites === null && <p className="text-sm text-ridefit-text-secondary">불러오는 중...</p>}

              {favorites?.length === 0 && (
                <div
                  className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ridefit-border px-4 py-10 text-center"
                  data-testid="garage-favorites-empty"
                >
                  <p className="text-sm text-ridefit-text">아직 저장한 부품이 없어요.</p>
                  <p className="text-xs text-ridefit-text-secondary">마음에 드는 부품을 저장해보세요. 부품 찾아보기에서 ☆를 누르면 여기에 모여요.</p>
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
                          <SafeImage
                            src={f.imageUrl}
                            alt={f.name}
                            className="aspect-[4/3] w-full bg-white/5 object-contain"
                            fallbackClassName="aspect-[4/3] w-full text-[10px]"
                          />
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
            </section>
          </div>

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
                  이 차량의 호환 부품 전체 보기 →
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
                        <SafeImage
                          src={p.imageUrl}
                          alt={p.name}
                          className="aspect-[4/3] w-full bg-white/5 object-contain"
                          fallbackClassName="aspect-[4/3] w-full text-[10px]"
                        />
                        <div className="p-3">
                          <p className="text-[11px] text-ridefit-text-secondary">
                            {p.category} ·{' '}
                            <span className={p.status === '호환가능' ? 'text-ridefit-success' : 'text-ridefit-warning'}>{p.status}</span>
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-sm font-medium text-ridefit-text" title={p.name}>
                            {p.name}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-ridefit-text">{formatPrice(p.price)}</p>
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
