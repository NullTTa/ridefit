import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

const SECTION_EMOJI = { VETERAN: '🏆', NEWBIE: '🌱', FREE: '💬' }
const BADGE_STYLE = {
  VETERAN: 'border-amber-800 bg-amber-950 text-amber-300',
  NEWBIE: 'border-green-200 bg-green-50 text-green-700',
  FREE: 'border-ridefit-border bg-ridefit-bg text-ridefit-text-secondary',
}
const SORTS = [
  { value: 'latest', label: '최신순' },
  { value: 'popular', label: '추천순' },
  { value: 'views', label: '조회순' },
]

function formatDate(iso) {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function Community() {
  const { isAuthenticated } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? 0)
  const category = searchParams.get('category') ?? ''
  const topic = searchParams.get('topic') ?? ''
  const sort = searchParams.get('sort') ?? 'latest'
  const q = searchParams.get('q') ?? ''

  const [sections, setSections] = useState([])
  const [searchText, setSearchText] = useState(q)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/api/posts/categories', { auth: false }).then(setSections).catch(() => setSections([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), size: '10', sort })
    if (category) params.set('category', category)
    if (topic) params.set('topic', topic)
    if (q) params.set('q', q)
    api
      .get(`/api/posts?${params.toString()}`, { auth: false })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [page, category, topic, sort, q])

  // 필터가 바뀌면 항상 첫 페이지부터 보여준다.
  const update = (changes) => {
    const next = { category, topic, sort, q, ...changes }
    const params = {}
    Object.entries(next).forEach(([key, value]) => {
      if (value && !(key === 'sort' && value === 'latest')) params[key] = String(value)
    })
    if (changes.page) params.page = String(changes.page)
    setSearchParams(params)
  }

  const goToPage = (p) => update({ page: p })
  const activeSection = sections.find((s) => s.code === category)
  const writeLink = category ? `/community/new?category=${category}` : '/community/new'

  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ridefit-text">커뮤니티</h1>
          <p className="mt-1 text-sm text-ridefit-text-secondary">경험을 나누고, 궁금한 걸 묻고, 자유롭게 이야기해요.</p>
        </div>
        {isAuthenticated ? (
          <Link to={writeLink} className="rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110">
            글쓰기
          </Link>
        ) : (
          <Link to="/login" className="text-sm font-medium text-ridefit-primary hover:underline">
            로그인하고 글쓰기
          </Link>
        )}
      </div>

      {/* 섹션 */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {sections.map((section) => {
          const active = category === section.code
          return (
            <button
              key={section.code}
              type="button"
              onClick={() => update({ category: active ? '' : section.code, topic: '', page: 0 })}
              aria-pressed={active}
              className={`rounded-xl border p-4 text-left transition ${
                active ? 'border-ridefit-primary bg-ridefit-primary/10' : 'border-ridefit-border bg-ridefit-card hover:border-ridefit-primary/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl" aria-hidden="true">
                  {SECTION_EMOJI[section.code]}
                </span>
                <span className="font-mono text-xs text-ridefit-text-secondary">{section.postCount}개</span>
              </div>
              <p className="mt-2 font-bold text-ridefit-text">{section.label}</p>
              <p className="mt-0.5 text-xs text-ridefit-text-secondary">{section.description}</p>
            </button>
          )
        })}
      </div>

      {/* 주제 */}
      {activeSection && (
        <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="주제 필터">
          <button
            type="button"
            onClick={() => update({ topic: '', page: 0 })}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              topic === '' ? 'bg-ridefit-primary text-white' : 'bg-ridefit-card text-ridefit-text-secondary hover:bg-ridefit-border'
            }`}
          >
            전체
          </button>
          {activeSection.topics.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => update({ topic: t, page: 0 })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                topic === t ? 'bg-ridefit-primary text-white' : 'bg-ridefit-card text-ridefit-text-secondary hover:bg-ridefit-border'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* 검색 + 정렬 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            update({ q: searchText.trim(), page: 0 })
          }}
          className="flex flex-1 gap-2"
        >
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="제목 검색"
            aria-label="제목 검색"
            className="min-w-0 flex-1 rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2 text-sm text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
          />
          <button type="submit" className="rounded-lg border border-ridefit-border px-4 py-2 text-sm text-ridefit-text-secondary transition hover:border-ridefit-primary hover:text-ridefit-primary">
            검색
          </button>
        </form>
        <select
          value={sort}
          onChange={(e) => update({ sort: e.target.value, page: 0 })}
          aria-label="정렬"
          className="rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2 text-sm text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-ridefit-text-secondary">불러오는 중...</p>}
      {error && <p className="text-red-600">에러: {error}</p>}

      {!loading && !error && data && data.content.length === 0 && (
        <p className="rounded-xl border border-dashed border-ridefit-border bg-ridefit-card px-4 py-10 text-center text-ridefit-text-secondary">
          조건에 맞는 게시글이 없어요. 첫 글을 남겨보세요.
        </p>
      )}

      {!loading && data && data.content.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.content.map((post) => (
            <li key={post.id}>
              <Link
                to={`/community/${post.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-ridefit-border bg-ridefit-card px-4 py-3 transition hover:border-ridefit-primary"
              >
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className={`rounded-full border px-2 py-0.5 font-medium ${BADGE_STYLE[post.category] ?? BADGE_STYLE.FREE}`}>
                      {post.categoryLabel}
                    </span>
                    {post.topic && <span className="text-ridefit-text-secondary">{post.topic}</span>}
                    {post.hasImage && <span aria-label="사진 첨부">🖼️</span>}
                  </div>
                  <p className="truncate font-medium text-ridefit-text">
                    {post.title}
                    {post.commentCount > 0 && <span className="ml-1.5 text-sm font-semibold text-ridefit-primary">[{post.commentCount}]</span>}
                  </p>
                  <p className="mt-1 text-xs text-ridefit-text-secondary">
                    {post.authorName} · {formatDate(post.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-ridefit-text-secondary sm:flex-row sm:gap-4">
                  <span title="조회수">👁 {post.viewCount}</span>
                  <span title="추천수">👍 {post.likeCount}</span>
                  <span title="댓글수" className="hidden sm:inline">
                    💬 {post.commentCount}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!loading && data && data.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => goToPage(page - 1)}
            className="rounded-lg border border-ridefit-border px-3 py-1.5 text-sm text-ridefit-text-secondary disabled:opacity-30"
          >
            이전
          </button>
          <span className="text-sm text-ridefit-text-secondary">
            {page + 1} / {data.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= data.totalPages - 1}
            onClick={() => goToPage(page + 1)}
            className="rounded-lg border border-ridefit-border px-3 py-1.5 text-sm text-ridefit-text-secondary disabled:opacity-30"
          >
            다음
          </button>
        </div>
      )}
    </div>
  )
}

export default Community
