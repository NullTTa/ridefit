import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { formatAppliesTo, GUIDE_TYPE_LABEL } from '../lib/guide'
import { api } from '../lib/api'

const TABS = [
  { type: 'PART', description: '핸들 댐퍼, 머플러, 브레이크처럼 차량에 다는 부품이 무엇이고 왜 쓰는지 알아봐요.' },
  { type: 'CONSUMABLE', description: '엔진오일, 냉각수, 요소수처럼 유지에 필요한 소모품을 종류와 교환 주기까지 알아봐요.' },
  { type: 'DIY', description: '직접 해볼 수 있는 정비를 준비물과 순서, 주의사항까지 정리했어요.' },
]

function GuideCard({ article }) {
  const carOnly = article.appliesTo === 'CAR'
  return (
    <Link
      to={`/guide/${article.slug}`}
      className="group flex h-full flex-col rounded-xl border border-ridefit-border bg-ridefit-card p-5 shadow-lg transition hover:-translate-y-1 hover:border-ridefit-primary/60"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-3xl" aria-hidden="true">
          {article.emoji ?? '📘'}
        </span>
        <div className="flex flex-wrap justify-end gap-1.5">
          {formatAppliesTo(article.appliesTo).map((label) => (
            <span
              key={label}
              className={`rounded-full border px-2 py-0.5 text-xs ${
                carOnly ? 'border-ridefit-warning-border bg-ridefit-warning-bg text-ridefit-warning' : 'border-ridefit-border text-ridefit-text-secondary'
              }`}
            >
              {label}
              {carOnly && ' 전용'}
            </span>
          ))}
        </div>
      </div>
      <h2 className="mt-3 text-lg font-bold text-ridefit-text group-hover:text-ridefit-primary">{article.title}</h2>
      <p className="mt-1 flex-1 text-sm text-ridefit-text-secondary">{article.summary}</p>

      {article.type === 'DIY' && (
        <p className="mt-3 flex flex-wrap gap-2 text-xs text-ridefit-text-secondary">
          <span className="rounded bg-ridefit-bg px-2 py-0.5">난이도 {article.difficulty}</span>
          <span className="rounded bg-ridefit-bg px-2 py-0.5">약 {article.estimatedMinutes}분</span>
          {article.professionalRecommended && <span className="rounded bg-ridefit-warning-bg px-2 py-0.5 text-ridefit-warning">전문가 점검 권장</span>}
        </p>
      )}
    </Link>
  )
}

// 정보 센터: 부품 정보 / 소모품 정보 / DIY 가이드. "부품 찾아보기"가 상품을 고르는 곳이라면 여기는 무엇인지 알아보는 곳이다.
function Guide() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.some((t) => t.type === searchParams.get('tab')) ? searchParams.get('tab') : 'PART'

  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .get('/api/guide/articles', { auth: false })
      .then(setArticles)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const visible = articles.filter((a) => a.type === tab)
  const activeTab = TABS.find((t) => t.type === tab)

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-ridefit-primary">RIDEFIT GUIDE</p>
        <h1 className="mt-1 text-2xl font-bold text-ridefit-text">부품 · 소모품 정보</h1>
        <p className="mt-2 max-w-2xl text-sm text-ridefit-text-secondary">
          사기 전에 알아보고, 달고 나서 관리하는 데 필요한 정보를 모았어요. 상품을 골라보고 싶다면{' '}
          <Link to="/parts" className="font-medium text-ridefit-primary hover:underline">
            부품 찾아보기
          </Link>
          로 이동하세요.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.type}
            type="button"
            role="tab"
            aria-selected={tab === t.type}
            onClick={() => setSearchParams({ tab: t.type })}
            className={`rounded-full px-5 py-2 text-sm font-medium transition ${
              tab === t.type ? 'bg-ridefit-primary text-white' : 'bg-ridefit-card text-ridefit-text-secondary hover:bg-ridefit-border'
            }`}
          >
            {GUIDE_TYPE_LABEL[t.type]}
          </button>
        ))}
      </div>
      <p className="mb-8 text-sm text-ridefit-text-secondary">{activeTab.description}</p>

      {tab === 'DIY' && (
        <p className="mb-6 rounded-lg border border-ridefit-warning-border bg-ridefit-warning-bg px-4 py-3 text-sm text-ridefit-warning">
          ⚠️ 브레이크·조향·서스펜션처럼 안전과 직결된 작업은 전문가 점검이 필요해요. 자신이 없는 작업은 정비소에 맡기세요.
        </p>
      )}

      {loading && <p className="text-ridefit-text-secondary">불러오는 중...</p>}
      {error && <p className="text-ridefit-danger">에러: {error}</p>}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((article) => (
          <GuideCard key={article.slug} article={article} />
        ))}
      </div>

      {tab === 'DIY' && (
        <div className="mt-10 flex flex-wrap items-center gap-3 rounded-xl border border-ridefit-border bg-ridefit-card p-5">
          <p className="flex-1 text-sm text-ridefit-text-secondary">직접 하기 어렵다면 주변 정비소를 둘러보고 가상 예약을 체험해볼 수 있어요.</p>
          <Link to="/services" className="rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110">
            정비 · 세차 서비스 보기
          </Link>
        </div>
      )}
    </div>
  )
}

export default Guide
