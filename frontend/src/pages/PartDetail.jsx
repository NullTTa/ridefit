import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import PartBadges from '../components/PartBadges'
import SellerListings from '../components/SellerListings'
import YoutubeEmbed from '../components/YoutubeEmbed'
import { api } from '../lib/api'

const FEEDBACK_LABEL = { MATCHED: '✅ 맞았어요', NOT_MATCHED: '❌ 안 맞았어요' }

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const query = vehicleId ? `?myVehicleId=${vehicleId}` : ''
    Promise.all([
      api.get(`/api/parts/${partId}${query}`),
      api.get(`/api/parts/${partId}/reviews`, { auth: false }),
      vehicleId ? api.get(`/api/parts/${partId}/check?myVehicleId=${vehicleId}`) : Promise.resolve(null),
    ])
      .then(([partData, reviewData, checkData]) => {
        setPart(partData)
        setReviews(reviewData)
        setCheckResult(checkData)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [partId, vehicleId])

  if (loading) return <p className="mx-auto max-w-3xl px-4 py-16 text-ridefit-text-secondary">불러오는 중...</p>
  if (error) return <p className="mx-auto max-w-3xl px-4 py-16 text-red-400">에러: {error}</p>
  if (!part) return null

  const stats = part.stats
  const totalFeedback = stats.positiveFeedbackCount + stats.negativeFeedbackCount

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          {part.imageUrl ? (
            <img src={part.imageUrl} alt={part.name} className="w-full rounded-xl border border-ridefit-border object-cover" />
          ) : (
            <div className="flex h-48 w-full items-center justify-center rounded-xl border border-ridefit-border bg-ridefit-card text-sm text-ridefit-text-secondary">
              이미지 없음
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <PartBadges badges={stats.badges} />
          <p className="text-xs font-medium text-ridefit-primary">{part.category}</p>
          <h1 className="text-xl font-bold text-ridefit-text">{part.name}</h1>

          {/* 외부 평점과 RIDEFIT 평점은 출처를 표시해 분리하고, 절대 하나의 점수로 합치지 않는다. */}
          {(stats.externalRating != null || stats.reviewCount > 0) && (
            <div className="flex flex-col gap-1 text-sm text-ridefit-text-secondary">
              {stats.externalRating != null && (
                <p>
                  <span className="font-semibold text-ridefit-text">★ {stats.externalRating.toFixed(1)}</span>{' '}
                  {stats.externalRatingSource ?? '외부'}
                  {stats.externalRatingCount != null && ` · ${stats.externalRatingCount.toLocaleString()}개 리뷰`}
                </p>
              )}
              {stats.reviewCount > 0 && (
                <p>
                  {stats.avgRating != null && (
                    <span className="font-semibold text-ridefit-text">★ {stats.avgRating.toFixed(1)}</span>
                  )}
                  {stats.avgRating != null && ' '}
                  RIDEFIT · 후기 {stats.reviewCount}개
                </p>
              )}
            </div>
          )}

          <p className="text-2xl font-bold text-ridefit-text">{part.price.toLocaleString()}원</p>
          {stats.lowestPrice != null && stats.lowestPrice < part.price && (
            <p className="text-sm text-ridefit-primary">등록된 판매처 중 최저가 {stats.lowestPrice.toLocaleString()}원</p>
          )}

          {/* 외부 판매량은 확인 가능한 데이터가 있을 때만 표시 - 지금은 항상 없음(구조만 존재) */}
          {stats.externalSalesCount != null && (
            <p className="text-xs text-ridefit-text-secondary">실제 판매량: 판매 {stats.externalSalesCount.toLocaleString()}개</p>
          )}
          {(stats.viewCount > 0 || stats.fitSelectionCount > 0) && (
            <p className="text-xs text-ridefit-text-secondary">
              RIDEFIT에서 조회 {stats.viewCount}회 · 장착해보기 {stats.fitSelectionCount}회
            </p>
          )}

          {checkResult && (
            <div
              className={`mt-2 rounded-lg border px-3 py-2 text-sm ${
                checkResult.proceedAllowed
                  ? 'border-green-800 bg-green-950 text-green-300'
                  : 'border-red-800 bg-red-950 text-red-300'
              }`}
            >
              {checkResult.proceedAllowed ? `✅ 내 차량과 호환됩니다 (${checkResult.status})` : '❌ 내 차량과 호환되지 않음'}
            </div>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            {vehicleId && checkResult?.proceedAllowed && (
              <Link
                to={`/garage/${vehicleId}/fit`}
                className="rounded-lg bg-ridefit-primary px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              >
                🛠️ 장착해보기
              </Link>
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

      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-ridefit-text-secondary">판매처 비교</h2>
        <SellerListings partId={part.id} />
      </div>

      {part.installVideoUrl && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-ridefit-text-secondary">설치 방법 영상</h2>
          <YoutubeEmbed url={part.installVideoUrl} title="설치 방법 영상" />
        </div>
      )}

      <div className="mt-8">
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
            <li key={r.postId} className="rounded-lg border border-ridefit-border bg-ridefit-card px-4 py-3">
              <Link to={`/community/${r.postId}`} className="font-medium text-ridefit-text hover:underline">
                {r.title}
              </Link>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ridefit-text-secondary">
                <span>{r.authorName}</span>
                <span>· {formatDate(r.createdAt)}</span>
                {r.rating != null && <span>· ★ {r.rating}</span>}
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
