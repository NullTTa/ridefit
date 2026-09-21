import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE, api } from '../lib/api'

const inputClass =
  'rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary'

function PostWrite() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [sections, setSections] = useState([])
  const [category, setCategory] = useState(searchParams.get('category') || 'FREE')
  const [topic, setTopic] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [vehicles, setVehicles] = useState([])
  const [myVehicleId, setMyVehicleId] = useState('')
  const [parts, setParts] = useState([])
  const [installedPartId, setInstalledPartId] = useState('')
  const [compatibleFeedback, setCompatibleFeedback] = useState('')
  const [rating, setRating] = useState(0)
  const [imageUrl, setImageUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/api/posts/categories', { auth: false }).then(setSections).catch(() => setSections([]))
    api.get('/api/my-vehicles').then(setVehicles).catch(() => setVehicles([]))
  }, [])

  useEffect(() => {
    setParts([])
    setInstalledPartId('')
    setCompatibleFeedback('')
    setRating(0)
    if (!myVehicleId) return
    api.get(`/api/my-vehicles/${myVehicleId}/compatible-parts`).then(setParts).catch(() => setParts([]))
  }, [myVehicleId])

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await api.post('/api/uploads', formData)
      setImageUrl(result.url)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const created = await api.post('/api/posts', {
        title,
        content,
        myVehicleId: myVehicleId || null,
        installedPartId: installedPartId || null,
        compatibleFeedback: installedPartId ? compatibleFeedback || null : null,
        imageUrl: imageUrl || null,
        videoUrl: videoUrl || null,
        rating: installedPartId && rating > 0 ? rating : null,
        category,
        topic: topic || null,
      })
      navigate(`/community/${created.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-ridefit-text">글쓰기</h1>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl border border-ridefit-border bg-ridefit-card p-6 shadow-lg"
      >
        <div className="flex flex-col gap-2 text-sm font-medium text-ridefit-text-secondary">
          어디에 올릴까요?
          <div className="grid gap-2 sm:grid-cols-3">
            {sections.map((section) => (
              <button
                key={section.code}
                type="button"
                onClick={() => {
                  setCategory(section.code)
                  setTopic('')
                }}
                aria-pressed={category === section.code}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  category === section.code
                    ? 'border-ridefit-primary bg-ridefit-primary/10 text-ridefit-text'
                    : 'border-ridefit-border bg-ridefit-bg text-ridefit-text-secondary hover:border-ridefit-primary/60'
                }`}
              >
                <span className="block text-sm font-semibold">{section.label}</span>
                <span className="block text-xs font-normal">{section.description}</span>
              </button>
            ))}
          </div>
          {sections.find((s) => s.code === category) && (
            <select value={topic} onChange={(e) => setTopic(e.target.value)} className={inputClass} aria-label="주제">
              <option value="">주제 선택 (선택)</option>
              {sections
                .find((s) => s.code === category)
                .topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
            </select>
          )}
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
          제목
          <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
          내용
          <textarea
            required
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
          장착한 차량 (선택)
          <select value={myVehicleId} onChange={(e) => setMyVehicleId(e.target.value)} className={inputClass}>
            <option value="">선택 안 함</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.modelYearLabel}
              </option>
            ))}
          </select>
        </label>

        {myVehicleId && (
          <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
            장착한 부품 (선택)
            <select value={installedPartId} onChange={(e) => setInstalledPartId(e.target.value)} className={inputClass}>
              <option value="">선택 안 함</option>
              {parts.map((p) => (
                <option key={p.partId} value={p.partId}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
          사진 첨부 (선택)
          <input type="file" accept="image/*" onChange={handleFileChange} className={inputClass} />
        </label>
        {uploading && <p className="text-xs text-ridefit-text-secondary">업로드 중...</p>}
        {imageUrl && (
          <div className="flex items-center gap-3">
            <img src={`${API_BASE}${imageUrl}`} alt="첨부 미리보기" className="h-20 w-20 rounded-lg object-cover" />
            <button type="button" onClick={() => setImageUrl('')} className="text-xs text-red-600 hover:underline">
              제거
            </button>
          </div>
        )}

        <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
          관련 영상 (유튜브 링크, 선택)
          <input
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className={inputClass}
          />
        </label>

        {installedPartId && (
          <div className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
            이 부품 평점 (선택)
            <div className="flex gap-1 text-2xl">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating((prev) => (prev === n ? 0 : n))}
                  aria-label={`${n}점`}
                  className={n <= rating ? 'text-yellow-700' : 'text-ridefit-text-secondary/40'}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        )}

        {installedPartId && (
          <div className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
            호환 여부
            <div className="flex gap-4">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="feedback"
                  checked={compatibleFeedback === 'MATCHED'}
                  onChange={() => setCompatibleFeedback('MATCHED')}
                />
                맞았어요
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="feedback"
                  checked={compatibleFeedback === 'NOT_MATCHED'}
                  onChange={() => setCompatibleFeedback('NOT_MATCHED')}
                />
                안 맞았어요
              </label>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-ridefit-primary px-4 py-2 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? '등록 중...' : '등록하기'}
        </button>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  )
}

export default PostWrite
