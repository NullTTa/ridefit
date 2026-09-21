import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import GuideBody from '../components/GuideBody'
import VehicleImage from '../components/VehicleImage'
import { api } from '../lib/api'
import { formatAppliesTo, GUIDE_TYPE_LABEL } from '../lib/guide'

// 정보 글 한 편. 부품 정보는 DB의 호환 데이터와 카탈로그 부품이 이어져서 "이 부품을 달 수 있는 차량"까지 보여준다.
function GuideArticle() {
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api
      .get(`/api/guide/articles/${slug}`, { auth: false })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    window.scrollTo(0, 0)
  }, [slug])

  if (loading) return <p className="mx-auto max-w-3xl px-4 py-16 text-ridefit-text-secondary">불러오는 중...</p>
  if (error) return <p className="mx-auto max-w-3xl px-4 py-16 text-red-600">에러: {error}</p>
  if (!data) return null

  const { article, body, compatibleVehicles, catalogParts, related } = data
  const carOnly = article.appliesTo === 'CAR'

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <nav className="mb-6 text-sm text-ridefit-text-secondary">
        <Link to="/guide" className="hover:text-ridefit-primary">
          정보
        </Link>
        <span className="mx-2">/</span>
        <Link to={`/guide?tab=${article.type}`} className="hover:text-ridefit-primary">
          {GUIDE_TYPE_LABEL[article.type]}
        </Link>
      </nav>

      <header className="mb-8">
        <div className="flex items-center gap-3">
          <span className="text-4xl" aria-hidden="true">
            {article.emoji ?? '📘'}
          </span>
          <h1 className="text-3xl font-bold text-ridefit-text">{article.title}</h1>
        </div>
        <p className="mt-3 text-ridefit-text-secondary">{article.summary}</p>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {formatAppliesTo(article.appliesTo).map((label) => (
            <span
              key={label}
              className={`rounded-full border px-2.5 py-1 ${
                carOnly ? 'border-yellow-200 bg-yellow-50 text-yellow-700' : 'border-ridefit-border text-ridefit-text-secondary'
              }`}
            >
              {label}
              {carOnly && ' 전용'}
            </span>
          ))}
          {article.type === 'DIY' && (
            <>
              <span className="rounded-full border border-ridefit-border px-2.5 py-1 text-ridefit-text-secondary">난이도 {article.difficulty}</span>
              <span className="rounded-full border border-ridefit-border px-2.5 py-1 text-ridefit-text-secondary">약 {article.estimatedMinutes}분</span>
            </>
          )}
        </div>

        {article.applicabilityNote && (
          <p
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              carOnly ? 'border-yellow-200 bg-yellow-50 text-yellow-800' : 'border-ridefit-primary/30 bg-ridefit-primary/10 text-ridefit-text-secondary'
            }`}
          >
            {carOnly ? '🚗 ' : 'ℹ️ '}
            {article.applicabilityNote}
          </p>
        )}
        {article.professionalRecommended && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            🛑 안전과 직결된 작업이에요. 이 가이드는 점검까지만 안내하며, 교체·분해는 전문가 점검을 권장해요.
          </p>
        )}
      </header>

      <GuideBody body={body} />

      {article.type === 'PART' && (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-bold text-ridefit-text">이 부품을 달 수 있는 차량</h2>
          {compatibleVehicles.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {compatibleVehicles.map(({ vehicle, partNames }) => (
                <Link
                  key={vehicle.id}
                  to={`/vehicles/${vehicle.id}`}
                  className="flex items-center gap-3 rounded-xl border border-ridefit-border bg-ridefit-card p-3 transition hover:border-ridefit-primary"
                >
                  <VehicleImage vehicle={vehicle} className="h-16 w-24 shrink-0 rounded-lg bg-ridefit-bg" />
                  <div className="min-w-0">
                    <p className="text-xs text-ridefit-primary">{vehicle.manufacturerName}</p>
                    <p className="truncate font-semibold text-ridefit-text">{vehicle.name}</p>
                    <p className="text-xs text-ridefit-text-secondary">호환 등록 부품 {partNames.length}개</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-ridefit-border bg-ridefit-card px-4 py-5 text-sm text-ridefit-text-secondary">
              아직 RIDEFIT에 등록된 호환 부품 데이터가 없어요. 이 부품은 차종별 전용 규격이 필요해서, 데이터가 준비되면 호환 차량이
              이곳에 표시됩니다.
            </p>
          )}

          {catalogParts.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 font-semibold text-ridefit-text">RIDEFIT에 등록된 {article.partCategory} 부품</h3>
              <ul className="flex flex-col gap-2">
                {catalogParts.map((part) => (
                  <li key={part.id}>
                    <Link
                      to={`/parts/${part.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-ridefit-border bg-ridefit-card px-4 py-3 text-sm transition hover:border-ridefit-primary"
                    >
                      <span className="text-ridefit-text">{part.name}</span>
                      <span className="shrink-0 text-ridefit-text-secondary">{part.price.toLocaleString()}원</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-bold text-ridefit-text">함께 보면 좋은 정보</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <Link
                key={r.slug}
                to={`/guide/${r.slug}`}
                className="rounded-xl border border-ridefit-border bg-ridefit-card p-4 transition hover:border-ridefit-primary"
              >
                <p className="text-xs text-ridefit-primary">{GUIDE_TYPE_LABEL[r.type]}</p>
                <p className="mt-1 font-semibold text-ridefit-text">
                  {r.emoji} {r.title}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10 flex flex-wrap items-center gap-3 rounded-xl border border-ridefit-border bg-ridefit-card p-5">
        <p className="flex-1 text-sm text-ridefit-text-secondary">궁금한 점이 남았나요? 다른 라이더에게 물어보거나 직접 해보기 어렵다면 정비소를 살펴보세요.</p>
        <Link
          to="/community?category=NEWBIE"
          className="rounded-lg border border-ridefit-border px-4 py-2 text-sm font-medium text-ridefit-text-secondary transition hover:border-ridefit-primary hover:text-ridefit-primary"
        >
          뉴비 질문공간
        </Link>
        {article.type === 'PART' && (
          <Link to="/parts" className="rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110">
            부품 찾아보기
          </Link>
        )}
        {article.type !== 'PART' && (
          <Link to="/services" className="rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110">
            정비 · 세차 서비스
          </Link>
        )}
      </section>
    </div>
  )
}

export default GuideArticle
