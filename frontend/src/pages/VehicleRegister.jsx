import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import VehicleCascadeSelect from '../components/VehicleCascadeSelect'
import { api } from '../lib/api'

function VehicleRegister() {
  const navigate = useNavigate()
  const [modelYearId, setModelYearId] = useState(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!modelYearId) {
      setError('제조사, 모델, 연식을 모두 선택해주세요.')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      await api.post('/api/my-vehicles', { modelYearId, photoUrl: photoUrl || null })
      navigate('/garage')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-ridefit-text">내 차량 등록</h1>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl border border-ridefit-border bg-ridefit-card p-6 shadow-lg"
      >
        <div className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
          차종
          <VehicleCascadeSelect onModelYearChange={setModelYearId} />
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
          사진 URL (선택)
          <input
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="나중에 실제 사진으로 교체할 수 있어요"
            className="rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-ridefit-primary px-4 py-2 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? '등록 중...' : '차고에 등록하기'}
        </button>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </div>
  )
}

export default VehicleRegister
