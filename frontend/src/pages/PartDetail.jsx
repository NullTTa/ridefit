import { useEffect, useState } from 'react'
import { ArrowRight, Check, CircleHelp, Heart, ShoppingCart, Star, TriangleAlert, Wrench } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import FitVehiclePicker from '../components/FitVehiclePicker'
import { Ico } from '../components/Icon'
import PartBadges from '../components/PartBadges'
import SafeImage from '../components/SafeImage'
import SellerListings from '../components/SellerListings'
import YoutubeEmbed from '../components/YoutubeEmbed'
import { api } from '../lib/api'
import { josa } from '../lib/korean'
import { formatFitment, groupFitmentsByModel } from '../lib/fitment'
import { fitRoomPath } from '../lib/fitRoom'
import { loadPartCategorySlugs } from '../lib/guide'

const FEEDBACK_LABEL = { MATCHED: '맞았어요', NOT_MATCHED: '안 맞았어요' }

// 부품 구분(part_type) 화면 라벨. DB 값은 OEM/AFTERMARKET/UNIVERSAL, 없으면 "정보 없음".
const PART_TYPE_LABEL = { OEM: '순정', AFTERMARKET: '애프터마켓', UNIVERSAL: '범용' }

const FITMENT_STATUS_STYLE = {
  호환가능: 'border-ridefit-success-border bg-ridefit-success-bg text-ridefit-success',
  브라켓필요: 'border-ridefit-warning-border bg-ridefit-warning-bg text-ridefit-warning',
  호환불가: 'border-ridefit-danger-border bg-ridefit-danger-bg text-ridefit-danger',
}

function formatDate(iso) {
  if (!iso) return ''
  return iso.slice(0, 10)
}

// 부품 하나의 모든 정보(인기상품 배지 + 후기 + 호환성 + 가격비교 + 장착해보기 + 설치영상)를
// 한 화면으로 모아서 보여준다. 배지/평점/조회수처럼 실제 데이터가 없는 항목은 표시하지 않는다.
function PartDetail() {
  const { partId } = useParams()
  const [searchParams] = useSearchParams()
  const vehicleId = searchParams.get('vehicleId')

  const [part, setPart] = useState(null)
  const [reviews, setReviews] = useState([])
  const [checkResult, setCheckResult] = useState(null)
  // 이 부품이 호환 등록된 차량(차종/연식/세대 코드) - compatibility 그대로
  const [fitments, setFitments] = useState([])
  // ?vehicleId= 로 들어온 내 차량(호환 차량 목록에서 "내 차량" 표시, 호환 안내 문구에 사용)
  const [myVehicle, setMyVehicle] = useState(null)
  const [categorySlugs, setCategorySlugs] = useState({})
  // 응답이 어느 부품/차량 조합의 것인지 저장한다 - 조합이 바뀌면 새 응답이 올 때까지 '불러오는 중'.
  const loadKey = `${partId}:${vehicleId ?? ''}`
  const [loadedKey, setLoadedKey] = useState(null)
  const [loadError, setError] = useState(null)
  const loading = loadedKey !== loadKey
  const error = loading ? null : loadError
  // 이 차량(?vehicleId)에 저장했는지 - 내 차고 "이 차량에 저장한 부품"과 같은 데이터(차량별 즐겨찾기). null = 확인 중/차량 없음
  const [savedState, setSavedState] = useState({ key: null, value: null })
  const saved = vehicleId && savedState.key === loadKey ? savedState.value : null
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadPartCategorySlugs().then(setCategorySlugs)
  }, [])

  useEffect(() => {
    let cancelled = false
    const query = vehicleId ? `?myVehicleId=${vehicleId}` : ''
    Promise.all([
      api.get(`/api/parts/${partId}${query}`),
      api.get(`/api/parts/${partId}/reviews`, { auth: false }),
      vehicleId ? api.get(`/api/parts/${partId}/check?myVehicleId=${vehicleId}`) : Promise.resolve(null),
      // 호환 차량 목록/내 차량 정보는 부가 정보라 실패해도 상세 화면은 그대로 보여준다.
      api.get(`/api/parts/${partId}/compatibilities`, { auth: false }).catch(() => []),
      vehicleId
        ? api.get('/api/my-vehicles').then((list) => list.find((v) => String(v.id) === String(vehicleId)) ?? null).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([partData, reviewData, checkData, fitmentData, vehicleData]) => {
        if (cancelled) return
        setPart(partData)
        setReviews(reviewData)
        setCheckResult(checkData)
        setFitments(fitmentData)
        setMyVehicle(vehicleData)
        setError(null)
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoadedKey(`${partId}:${vehicleId ?? ''}`))
    return () => {
      cancelled = true
    }
  }, [partId, vehicleId])

  useEffect(() => {
    if (!vehicleId) return
    let alive = true
    const key = `${partId}:${vehicleId}`
    api
      .get(`/api/me/favorites?myVehicleId=${vehicleId}`)
      .then((list) => alive && setSavedState({ key, value: list.some((f) => String(f.partId) === String(partId)) }))
      .catch(() => alive && setSavedState({ key, value: null }))
    return () => {
      alive = false
    }
  }, [partId, vehicleId])

  // 저장 = 나중에 보려고 이 차량에 모아두기(장착/구매와 별개). 기존 즐겨찾기 API를 그대로 쓴다.
  const toggleSave = async () => {
    setSaving(true)
    try {
      if (saved) await api.del(`/api/me/favorites/${partId}?myVehicleId=${vehicleId}`)
      else await api.post('/api/me/favorites', { partId: Number(partId), myVehicleId: Number(vehicleId) })
      setSavedState({ key: loadKey, value: !saved })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="mx-auto max-w-3xl px-4 py-16 text-ridefit-text-secondary">불러오는 중...</p>
  if (error) return <p className="mx-auto max-w-3xl px-4 py-16 text-ridefit-danger">에러: {error}</p>
  if (!part) return null

  const stats = part.stats
  const totalFeedback = stats.positiveFeedbackCount + stats.negativeFeedbackCount

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <SafeImage
            src={part.imageUrl}
            alt={part.name}
            className="aspect-square w-full rounded-xl border border-ridefit-border bg-white object-contain p-4"
            fallbackClassName="h-48 w-full rounded-xl border border-ridefit-border bg-ridefit-card text-sm"
            fallbackText="이미지 없음"
          />
        </div>

        <div className="flex flex-col gap-2">
          <PartBadges badges={stats.badges} />
          <p className="text-xs font-medium text-ridefit-primary">
            {part.category}
            {categorySlugs[part.category] && (
              <Link to={`/guide/${categorySlugs[part.category]}`} className="ml-2 text-ridefit-text-secondary hover:text-ridefit-primary hover:underline">
                {josa(part.category, '이', '가')} 뭔가요? <Ico as={ArrowRight} />
              </Link>
            )}
          </p>
          <h1 className="text-xl font-bold text-ridefit-text">{part.name}</h1>

          {/* 부품 메타데이터: 근거가 확인된 부품에만 값이 있다(추정해서 채우지 않음). */}
          <dl className="grid grid-cols-3 gap-2 rounded-lg border border-ridefit-border bg-ridefit-card px-3 py-2 text-xs" data-testid="part-meta">
            {[
              ['브랜드', part.brand],
              ['품번', part.partNumber],
              ['구분', PART_TYPE_LABEL[part.partType]],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-ridefit-text-secondary">{label}</dt>
                <dd className={`truncate font-medium ${value ? 'text-ridefit-text' : 'text-ridefit-text-secondary/70'}`} title={value ?? undefined}>
                  {value ?? '정보 없음'}
                </dd>
              </div>
            ))}
          </dl>

          {/* 외부 평점과 RIDEFIT 평점은 출처를 표시해 분리하고, 절대 하나의 점수로 합치지 않는다. */}
          {(stats.externalRating != null || stats.reviewCount > 0) && (
            <div className="flex flex-col gap-1 text-sm text-ridefit-text-secondary">
              {stats.externalRating != null && (
                <p>
                  <span className="font-semibold text-ridefit-text"><Ico as={Star} className="mr-0.5 text-ridefit-warning" filled />{stats.externalRating.toFixed(1)}</span>{' '}
                  {stats.externalRatingSource ?? '외부'}
                  {stats.externalRatingCount != null && ` · ${stats.externalRatingCount.toLocaleString()}개 리뷰`}
                </p>
              )}
              {stats.reviewCount > 0 && (
                <p>
                  {stats.avgRating != null && (
                    <span className="font-semibold text-ridefit-text"><Ico as={Star} className="mr-0.5 text-ridefit-warning" filled />{stats.avgRating.toFixed(1)}</span>
                  )}
                  {stats.avgRating != null && ' '}
                  RIDEFIT · 후기 {stats.reviewCount}개
                </p>
              )}
            </div>
          )}

          {/* RIDEFIT 판매 가격 = RIDEFIT에서 실제로 결제하는 가격(서버가 결제 금액 계산에 쓰는 값).
              외부 판매처 가격은 참고용이라 결제 금액으로 쓰지 않는다 - 둘을 다른 줄/다른 이름으로 구분한다. */}
          <div data-testid="part-price">
            <p className="text-[11px] font-medium text-ridefit-text-secondary">RIDEFIT 판매 가격</p>
            {/* 가격을 확인하지 못한 부품은 가격을 만들지 않는다(구매 버튼도 숨김). */}
            {part.price != null ? (
              <p className="text-2xl font-bold text-ridefit-text">{part.price.toLocaleString()}원</p>
            ) : (
              <p className="text-base font-semibold text-ridefit-text-secondary" data-testid="part-price-unknown">가격 정보 없음 · 판매 준비 중</p>
            )}
          </div>
          {/* 예시 판매처/가격 미확인 판매처는 서버에서 제외된 값이다(PartPopularityService). */}
          {stats.lowestPrice != null && (
            <p className="text-xs text-ridefit-text-secondary" data-testid="part-seller-price-hint">
              외부 판매처 참고 가격 {stats.lowestPrice.toLocaleString()}원부터 · 실시간 조회 아님 · RIDEFIT 결제 금액 아님
            </p>
          )}

          {/* 외부 판매량은 확인 가능한 데이터가 있을 때만 표시 - 지금은 항상 없음(구조만 존재) */}
          {stats.externalSalesCount != null && (
            <p className="text-xs text-ridefit-text-secondary">실제 판매량: 판매 {stats.externalSalesCount.toLocaleString()}개</p>
          )}
          {(stats.viewCount > 0 || stats.fitSelectionCount > 0) && (
            <p className="text-xs text-ridefit-text-secondary">
              RIDEFIT에서 조회 {stats.viewCount}회 · 장착 시도 {stats.fitSelectionCount}회
            </p>
          )}

          {checkResult && (
            <div
              className={`mt-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                checkResult.proceedAllowed
                  ? 'border-ridefit-success-border bg-ridefit-success-bg text-ridefit-success'
                  : checkResult.status === '호환불가'
                    ? 'border-ridefit-danger-border bg-ridefit-danger-bg text-ridefit-danger'
                    : 'border-ridefit-border bg-ridefit-card text-ridefit-text-secondary'
              }`}
              data-testid="part-compat"
              data-status={checkResult.status}
            >
              {/* 판정은 기존 /check(CompatibilityCheckService = DB compatibility) 결과를 그대로 쓴다. 데이터가 없으면 "호환"이라고 하지 않는다. */}
              {checkResult.proceedAllowed ? (
                <>
                  <Ico as={Check} className="mr-1" />
                  장착 가능 · {myVehicle ? myVehicle.nickname || myVehicle.modelYearLabel : '내 차량'}
                  {checkResult.status === '브라켓필요' && ' (브라켓 필요)'}
                </>
              ) : checkResult.status === '호환불가' ? (
                <>
                  <Ico as={TriangleAlert} className="mr-1" />
                  현재 차량{myVehicle ? `(${myVehicle.nickname || myVehicle.modelYearLabel})` : ''}과 호환되지 않습니다.
                </>
              ) : (
                <>
                  <Ico as={CircleHelp} className="mr-1" />
                  현재 차량{myVehicle ? `(${myVehicle.nickname || myVehicle.modelYearLabel})` : ''}과의 호환 정보가 아직 없어요.
                </>
              )}
            </div>
          )}

          {/* RIDEFIT 핵심 기능: 내 차량 -> 이 부품 -> 장착 결과. 구매보다 먼저, 가장 크게 둔다. */}
          <div className="mt-2 flex flex-col gap-2">
            {/* 보고 있는 차량과 호환되면 그 차량의 FitRoom으로 바로, 아니면(차량 미지정/비호환) 내 차량 중에서 고른다. */}
            {vehicleId && checkResult?.proceedAllowed ? (
              <Link
                to={fitRoomPath(vehicleId, part.id)}
                className="flex flex-col items-center rounded-xl bg-ridefit-primary px-4 py-3 text-white shadow-lg shadow-ridefit-primary/25 transition hover:brightness-110"
                data-testid={`fit-try-${part.id}`}
              >
                <span className="text-base font-bold"><Ico as={Wrench} className="mr-1.5" />장착해보기</span>
                <span className="text-[11px] text-white/85">내 차량 → 이 부품 → 장착 결과 확인</span>
              </Link>
            ) : (
              <FitVehiclePicker partId={part.id} currentVehicleId={vehicleId} className="w-full" />
            )}
            {part.price != null && (
              <Link
                to={`/checkout?partId=${part.id}&qty=1${vehicleId ? `&vehicleId=${vehicleId}` : ''}`}
                className="rounded-lg border border-ridefit-border px-3 py-2 text-center text-sm font-semibold text-ridefit-text transition hover:border-ridefit-primary hover:text-ridefit-primary"
                data-testid="part-buy"
              >
                <Ico as={ShoppingCart} className="mr-1" />구매하기 · {part.price.toLocaleString()}원
              </Link>
            )}
            {vehicleId && saved !== null && (
              <button
                type="button"
                onClick={toggleSave}
                disabled={saving}
                aria-pressed={saved}
                title={saved ? '저장됨 - 눌러서 저장 해제' : '내 차고에 이 차량용으로 저장'}
                className={`rounded-lg border px-3 py-2 text-center text-sm font-semibold transition disabled:opacity-50 ${
                  saved
                    ? 'border-ridefit-warning/60 bg-ridefit-warning-bg text-ridefit-warning'
                    : 'border-ridefit-border text-ridefit-text hover:border-ridefit-warning hover:text-ridefit-warning'
                }`}
                data-testid="part-save"
              >
                <Ico as={Heart} className="mr-1" filled={saved} />
                {saved ? '저장됨' : '저장하기'}
                <span className="ml-1 text-xs font-normal opacity-80">· {myVehicle ? myVehicle.nickname || myVehicle.modelYearLabel : '이 차량'}</span>
              </button>
            )}
            {!vehicleId && (
              <Link
                to="/garage"
                className="rounded-lg border border-ridefit-border px-3 py-2 text-sm text-ridefit-text-secondary hover:border-ridefit-primary hover:text-ridefit-primary"
              >
                내 차고에서 호환 여부 확인하기
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 호환 차량: compatibility + model_year에 등록된 값만 보여준다(연식을 추측해 만들지 않음). */}
      <div className="mt-8 rounded-xl border border-ridefit-border bg-ridefit-card p-5 shadow-lg" data-testid="part-fitments">
        <h2 className="mb-3 text-sm font-semibold text-ridefit-text-secondary">호환 차량</h2>
        {fitments.length === 0 ? (
          <p className="text-sm text-ridefit-text-secondary">아직 등록된 호환 차량 정보가 없어요.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {groupFitmentsByModel(fitments).map((g) => (
              <div key={g.key}>
                <p className="mb-1.5 text-sm font-semibold text-ridefit-text">
                  {g.manufacturerName} {g.vehicleModelName}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {g.rows.map((f) => {
                    const isMine = myVehicle && f.modelYearId === myVehicle.modelYearId
                    return (
                      <li
                        key={f.modelYearId}
                        className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-sm ${
                          isMine ? 'border-ridefit-primary bg-ridefit-primary/10' : 'border-ridefit-border bg-ridefit-bg'
                        }`}
                      >
                        <span className="font-medium text-ridefit-text">{formatFitment(f)}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${FITMENT_STATUS_STYLE[f.status] ?? 'border-ridefit-border text-ridefit-text-secondary'}`}>
                          {f.status}
                        </span>
                        {isMine && <span className="text-[11px] font-semibold text-ridefit-primary">내 차량</span>}
                        {f.note && <span className="w-full text-xs text-ridefit-text-secondary">{f.note}</span>}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-ridefit-border bg-ridefit-card p-5 shadow-lg">
        <h2 className="mb-3 text-sm font-semibold text-ridefit-text-secondary">외부 판매처 참고 가격 (RIDEFIT 결제 금액 아님)</h2>
        <SellerListings partId={part.id} />
      </div>

      {part.installVideoUrl && (
        <div className="mt-6 rounded-xl border border-ridefit-border bg-ridefit-card p-5 shadow-lg">
          <h2 className="mb-3 text-sm font-semibold text-ridefit-text-secondary">설치 방법 영상</h2>
          <YoutubeEmbed url={part.installVideoUrl} title="설치 방법 영상" />
        </div>
      )}

      <div className="mt-6 rounded-xl border border-ridefit-border bg-ridefit-card p-5 shadow-lg">
        <h2 className="mb-3 text-sm font-semibold text-ridefit-text-secondary">
          RIDEFIT 관련 후기 {stats.reviewCount > 0 && `(${stats.reviewCount})`}
        </h2>
        {totalFeedback > 0 && (
          <p className="mb-3 text-xs text-ridefit-text-secondary">
            호환 여부 응답 {totalFeedback}건 중 맞았어요 {stats.positiveFeedbackCount}건 · 안 맞았어요{' '}
            {stats.negativeFeedbackCount}건
            {stats.photoReviewCount > 0 && ` · 사진 첨부 ${stats.photoReviewCount}건`}
          </p>
        )}

        {reviews.length === 0 && <p className="text-sm text-ridefit-text-secondary">아직 이 부품에 대한 후기가 없어요.</p>}

        <ul className="flex flex-col gap-2">
          {reviews.map((r) => (
            <li key={r.postId} className="rounded-lg border border-ridefit-border bg-ridefit-bg px-4 py-3">
              <Link to={`/community/${r.postId}`} className="font-medium text-ridefit-text hover:underline">
                {r.title}
              </Link>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ridefit-text-secondary">
                <span>{r.authorName}</span>
                <span>· {formatDate(r.createdAt)}</span>
                {r.rating != null && <span>· <Ico as={Star} className="text-ridefit-warning" filled /> {r.rating}</span>}
                {r.compatibleFeedback && <span>· {FEEDBACK_LABEL[r.compatibleFeedback] ?? r.compatibleFeedback}</span>}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default PartDetail
