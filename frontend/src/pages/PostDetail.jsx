import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import YoutubeEmbed from '../components/YoutubeEmbed'
import { useAuth } from '../context/AuthContext'
import { API_BASE, api } from '../lib/api'

const FEEDBACK_LABEL = { MATCHED: '✅ 맞았어요', NOT_MATCHED: '❌ 안 맞았어요' }

function formatDate(iso) {
  if (!iso) return ''
  return iso.slice(0, 16).replace('T', ' ')
}

function PostDetail() {
  const { postId } = useParams()
  const { isAuthenticated } = useAuth()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    setLoading(true)
    api
      .get(`/api/posts/${postId}`, { auth: false })
      .then(setPost)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [postId])

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim()) return
    setSubmitting(true)
    try {
      await api.post(`/api/posts/${postId}/comments`, { content: commentText })
      setCommentText('')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="mx-auto max-w-2xl px-4 py-16 text-ridefit-text-secondary">불러오는 중...</p>
  if (error) return <p className="mx-auto max-w-2xl px-4 py-16 text-red-400">에러: {error}</p>
  if (!post) return null

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-2 text-2xl font-bold text-ridefit-text">{post.title}</h1>
      <p className="mb-6 text-xs text-ridefit-text-secondary">
        {post.authorName} · {formatDate(post.createdAt)}
      </p>

      {post.installedPartName && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-ridefit-border bg-ridefit-card px-3 py-2 text-sm">
          <span className="text-ridefit-text-secondary">장착한 부품:</span>
          <span className="font-medium text-ridefit-text">{post.installedPartName}</span>
          {post.compatibleFeedback && (
            <span className="ml-auto font-semibold">{FEEDBACK_LABEL[post.compatibleFeedback] ?? post.compatibleFeedback}</span>
          )}
        </div>
      )}

      {post.imageUrl && (
        <img
          src={post.imageUrl.startsWith('/') ? `${API_BASE}${post.imageUrl}` : post.imageUrl}
          alt="첨부 사진"
          className="mb-6 w-full max-w-lg rounded-lg"
        />
      )}

      <p className="mb-6 whitespace-pre-wrap text-ridefit-text">{post.content}</p>

      {(post.videoUrl || post.installVideoUrl) && (
        <div className="mb-10 flex flex-col gap-4">
          {post.videoUrl && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ridefit-text-secondary">관련 영상</h2>
              <YoutubeEmbed url={post.videoUrl} title="관련 영상" />
            </div>
          )}
          {post.installVideoUrl && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ridefit-text-secondary">
                {post.installedPartName} 설치 방법 영상
              </h2>
              <YoutubeEmbed url={post.installVideoUrl} title="설치 방법 영상" />
            </div>
          )}
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold text-ridefit-text">댓글 {post.comments.length}</h2>
      <ul className="mb-6 flex flex-col gap-2">
        {post.comments.map((c) => (
          <li key={c.id} className="rounded-lg border border-ridefit-border bg-ridefit-card px-4 py-3">
            <p className="text-sm text-ridefit-text">{c.content}</p>
            <p className="mt-1 text-xs text-ridefit-text-secondary">
              {c.authorName} · {formatDate(c.createdAt)}
            </p>
          </li>
        ))}
        {post.comments.length === 0 && <p className="text-sm text-ridefit-text-secondary">첫 댓글을 남겨보세요.</p>}
      </ul>

      {isAuthenticated ? (
        <form onSubmit={handleAddComment} className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="댓글을 입력하세요"
            className="flex-1 rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            등록
          </button>
        </form>
      ) : (
        <p className="text-sm text-ridefit-text-secondary">댓글을 작성하려면 로그인해주세요.</p>
      )}
    </div>
  )
}

export default PostDetail
