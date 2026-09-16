import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const FIXED_MODEL_YEAR_ID = 1 // 등록된 차량이 아직 하나뿐이라 고정값으로 사용 (추후 차량 선택 UI로 대체 예정)

function MyVehicleRegister() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // 1) 회원 생성(POST /api/members) → memberId 확보
  // 2) 그 memberId로 내 차량 등록(POST /api/my-vehicles) → myVehicleId 확보
  // 3) 등록된 차량의 호환 부품 화면으로 자동 이동
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const memberRes = await fetch('http://localhost:8080/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      })
      if (!memberRes.ok) {
        throw new Error(`회원 등록 실패 (status: ${memberRes.status})`)
      }
      const member = await memberRes.json()

      const vehicleRes = await fetch('http://localhost:8080/api/my-vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          modelYearId: FIXED_MODEL_YEAR_ID,
        }),
      })
      if (vehicleRes.status === 404) {
        throw new Error('등록할 차량 정보(modelYearId)를 찾을 수 없습니다.')
      }
      if (!vehicleRes.ok) {
        throw new Error(`차량 등록 실패 (status: ${vehicleRes.status})`)
      }
      const myVehicle = await vehicleRes.json()

      navigate(`/my-vehicles/${myVehicle.id}/compatible-parts`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-ridefit-text-light dark:text-ridefit-text-dark">
        내 차량 등록
      </h1>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-md dark:bg-ridefit-bg-dark-alt"
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          이메일
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary dark:border-gray-700 dark:bg-ridefit-bg-dark"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          이름
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary dark:border-gray-700 dark:bg-ridefit-bg-dark"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-ridefit-primary px-4 py-2 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? '등록 중...' : '등록하기'}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

export default MyVehicleRegister
