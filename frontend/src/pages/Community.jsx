import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

function formatDate(iso) {
  if (!iso) return ''
  return iso.slice(0, 16).replace('T', ' ')
}

function Community() {
  const { isAuthenticated } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? 0)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    api
      .get(`/api/posts?page=${page}&size=10`, { auth: false })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [page])

  const goToPage = (p) => setSearchParams({ page: String(p) })

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ridefit-text">커뮤니티</h1>
        {isAuthenticated ? (
          <Link
            to="/community/new"
            className="rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            글쓰기
          </Link>
        ) : (
          <Link to="/login" className="text-sm font-medium text-ridefit-primary hover:underline">
            로그인하고 글쓰기
          </Link>
        )}
      </div>

      {loading && <p className="text-ridefit-text-secondary">불러오는 중...</p>}
      {error && <p className="text-red-400">에러: {error}</p>}

      {!loading && !error && data && data.content.length === 0 && (
        <p className="text-ridefit-text-secondary">아직 등록된 게시글이 없어요. 첫 글을 남겨보세요.</p>
      )}

      {!loading && data && data.content.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.content.map((post) => (
            <li key={post.id}>
              <Link
                to={`/community/${post.id}`}
                className="flex items-center justify-between rounded-lg border border-ridefit-border bg-ridefit-card px-4 py-3 transition hover:border-ridefit-primary"
              >
                <span className="font-medium text-ridefit-text">{post.title}</span>
                <span className="text-xs text-ridefit-text-secondary">
                  {post.authorName} · {formatDate(post.createdAt)}
                </span>
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
