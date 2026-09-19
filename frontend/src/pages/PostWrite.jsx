import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

const inputClass =
  'rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary'

function PostWrite() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [vehicles, setVehicles] = useState([])
  const [myVehicleId, setMyVehicleId] = useState('')
  const [parts, setParts] = useState([])
  const [installedPartId, setInstalledPartId] = useState('')
  const [compatibleFeedback, setCompatibleFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/api/my-vehicles').then(setVehicles).catch(() => setVehicles([]))
  }, [])

  useEffect(() => {
    setParts([])
    setInstalledPartId('')
    setCompatibleFeedback('')
    if (!myVehicleId) return
    api.get(`/api/my-vehicles/${myVehicleId}/compatible-parts`).then(setParts).catch(() => setParts([]))
  }, [myVehicleId])

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

        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </div>
  )
}

export default PostWrite
