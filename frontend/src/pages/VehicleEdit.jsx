import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import VehicleCascadeSelect from '../components/VehicleCascadeSelect'
import { VEHICLE_PLACEHOLDER_IMAGE } from '../constants/images'
import { api } from '../lib/api'

// 내 차고에 등록된 차량 하나의 별명/연식/사진을 수정하는 화면.
// VehicleRegister와 같은 연식 선택 컴포넌트를 재사용하되, 기존 값을 미리 채워서 보여준다.
function VehicleEdit() {
  const { myVehicleId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [vehicle, setVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [nickname, setNickname] = useState('')
  const [modelYearId, setModelYearId] = useState(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api
      .get('/api/my-vehicles')
      .then((list) => {
        const found = list.find((v) => String(v.id) === String(myVehicleId))
        if (!found) {
          setError('존재하지 않는 차량이에요.')
          return
        }
        setVehicle(found)
        setNickname(found.nickname ?? '')
        setModelYearId(found.modelYearId)
        setPhotoUrl(found.photoUrl ?? '')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [myVehicleId])

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await api.post('/api/uploads', formData)
      setPhotoUrl(result.url)
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
      await api.patch(`/api/my-vehicles/${myVehicleId}`, {
        modelYearId,
        nickname,
        photoUrl,
      })
      navigate('/garage')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="mx-auto max-w-lg px-4 py-16 text-ridefit-text-secondary">불러오는 중...</p>
  if (error && !vehicle) return <p className="mx-auto max-w-lg px-4 py-16 text-red-600">{error}</p>

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-ridefit-text">내 차량 수정</h1>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 rounded-xl border border-ridefit-border bg-ridefit-card p-6 shadow-lg"
      >
        <div className="flex flex-col items-center gap-3">
          <img
            src={photoUrl || vehicle.modelImageUrl || VEHICLE_PLACEHOLDER_IMAGE}
            alt={nickname || vehicle.modelYearLabel}
            className="h-40 w-full rounded-lg border border-ridefit-border bg-ridefit-bg-alt object-contain p-2"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-ridefit-border px-3 py-1.5 text-xs font-medium text-ridefit-text-secondary transition hover:border-ridefit-primary hover:text-ridefit-primary disabled:opacity-50"
          >
            {uploading ? '업로드 중...' : '내 차량 사진 올리기'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          {photoUrl && (
            <button
              type="button"
              onClick={() => setPhotoUrl('')}
              className="text-xs text-ridefit-text-secondary hover:text-red-600"
            >
              올린 사진 지우고 기본 이미지로
            </button>
          )}
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
          별명
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="예: 내 애마, 출퇴근용 커브"
            maxLength={30}
            className="rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
          />
        </label>

        <div className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
          연식 · 모델
          <VehicleCascadeSelect
            onModelYearChange={setModelYearId}
            initialManufacturerId={vehicle.manufacturerId}
            initialVehicleModelId={vehicle.vehicleModelId}
            initialModelYearId={vehicle.modelYearId}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-ridefit-primary px-4 py-2 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? '저장 중...' : '저장하기'}
        </button>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  )
}

export default VehicleEdit
