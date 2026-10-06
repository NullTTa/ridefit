import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Ico } from '../components/Icon'
import { API_BASE, api } from '../lib/api'

// 예전 AI 합성 화면(/api/synth). 비용이 드는 호출이라 페이지를 열 때 자동으로 만들지 않고, 버튼을 눌렀을 때만 요청한다.
// FitRoom에는 새 "장착해보기"(/api/ai-fit, 결과 캐시)가 들어가 있다. 화면 문구에는 "AI"라는 말을 쓰지 않는다.
function Synth() {
  const [searchParams] = useSearchParams()
  const partId = searchParams.get('partId')
  const vehicleId = searchParams.get('vehicleId')
  const missingParams = !partId || !vehicleId

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(
    missingParams ? '부품과 차량 정보가 없어요. 부품 확인 화면부터 다시 시작해주세요.' : null,
  )

  const handleSynth = () => {
    setLoading(true)
    setError(null)
    api
      .post('/api/synth', { partId: Number(partId), myVehicleId: Number(vehicleId) })
      .then(setResult)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  const imageSrc = result?.imageUrl?.startsWith('/') ? `${API_BASE}${result.imageUrl}` : result?.imageUrl

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="mb-2 text-2xl font-bold text-ridefit-text">장착 미리보기</h1>
      <p className="mb-8 text-sm text-ridefit-text-secondary">
        호환이 확인된 부품을 실제로 장착했을 때의 모습을 미리 확인해요.
      </p>

      {!missingParams && !result && !loading && (
        <div className="mb-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleSynth}
            className="rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            장착 모습 만들기
          </button>
          <Link to={`/garage/${vehicleId}/fit`} className="text-xs text-ridefit-text-secondary hover:text-ridefit-primary hover:underline">
            부품 입혀보기에서 장착해보기 <Ico as={ArrowRight} />
          </Link>
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-ridefit-border bg-ridefit-card p-16">
          <p className="text-ridefit-text-secondary">장착 모습을 만드는 중이에요...</p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-ridefit-danger-border bg-ridefit-danger-bg p-8">
          <p className="text-ridefit-danger">{error}</p>
          <Link to="/parts" className="mt-4 inline-block text-sm font-medium text-ridefit-primary hover:underline">
            부품 찾아보기로 돌아가기
          </Link>
        </div>
      )}

      {!loading && result && (
        <div className="rounded-xl border border-ridefit-border bg-ridefit-card p-6">
          <img src={imageSrc} alt="장착 미리보기" className="mx-auto w-full max-w-lg rounded-lg" />
          <p className="mt-3 text-xs text-ridefit-text-secondary">
            참고용 합성 이미지이며 실제 장착 상태와 차이가 있을 수 있어요.
          </p>
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
