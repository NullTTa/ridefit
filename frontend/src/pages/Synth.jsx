import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { API_BASE, api } from '../lib/api'

// AI_SYNTH_MODE=mock(기본)에서는 항상 고정 샘플 이미지가 표시된다. live 전환은 별도 지시가 있을 때만.
function Synth() {
  const [searchParams] = useSearchParams()
  const partId = searchParams.get('partId')
  const vehicleId = searchParams.get('vehicleId')

  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!partId || !vehicleId) {
      setError('부품과 차량 정보가 없어요. 부품 확인 화면부터 다시 시작해주세요.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    api
      .post('/api/synth', { partId: Number(partId), myVehicleId: Number(vehicleId) })
      .then(setResult)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [partId, vehicleId])

  const imageSrc = result?.imageUrl?.startsWith('/') ? `${API_BASE}${result.imageUrl}` : result?.imageUrl

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="mb-2 text-2xl font-bold text-ridefit-text">AI 장착 미리보기</h1>
      <p className="mb-8 text-sm text-ridefit-text-secondary">
        호환이 확인된 부품을 실제로 장착했을 때의 모습을 AI로 미리 확인해요.
      </p>

      {loading && (
        <div className="rounded-xl border border-ridefit-border bg-ridefit-card p-16">
          <p className="text-ridefit-text-secondary">합성 중이에요...</p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8">
          <p className="text-red-700">{error}</p>
          <Link to="/parts" className="mt-4 inline-block text-sm font-medium text-ridefit-primary hover:underline">
            부품 찾아보기로 돌아가기
          </Link>
        </div>
      )}

      {!loading && result && (
        <div className="rounded-xl border border-ridefit-border bg-ridefit-card p-6">
          <img src={imageSrc} alt="AI 합성 미리보기" className="mx-auto w-full max-w-lg rounded-lg" />
          {result.mode === 'mock' && (
            <p className="mt-4 text-xs text-ridefit-text-secondary">
              지금은 mock 모드라 고정 샘플 이미지가 표시되고 있어요.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default Synth
