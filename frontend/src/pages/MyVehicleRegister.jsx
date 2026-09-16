import { useState } from 'react'
import { Link } from 'react-router-dom'

function MyVehicleRegister() {
  const [memberId, setMemberId] = useState('')
  const [modelYearId, setModelYearId] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [created, setCreated] = useState(null)

  // 내 차량 등록: memberId/modelYearId가 존재하지 않으면 백엔드가 404를 반환한다.
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setCreated(null)

    try {
      const res = await fetch('http://localhost:8080/api/my-vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: Number(memberId),
          modelYearId: Number(modelYearId),
          photoUrl: photoUrl || null,
        }),
      })

      if (res.status === 404) {
        throw new Error('존재하지 않는 회원(memberId) 또는 차량 연식(modelYearId)입니다.')
      }
      if (!res.ok) {
        throw new Error(`등록 실패 (status: ${res.status})`)
      }

      const data = await res.json()
      setCreated(data)
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
          회원 ID (memberId)
          <input
            type="number"
            required
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary dark:border-gray-700 dark:bg-ridefit-bg-dark"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          연식 ID (modelYearId)
          <input
            type="number"
            required
            value={modelYearId}
            onChange={(e) => setModelYearId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary dark:border-gray-700 dark:bg-ridefit-bg-dark"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          사진 URL (선택)
          <input
            type="text"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
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

      {created && (
        <div className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          <p>차량이 등록됐습니다. (myVehicleId: {created.id})</p>
          <Link
            to={`/my-vehicles/${created.id}/compatible-parts`}
            className="mt-2 inline-block font-semibold text-ridefit-primary hover:underline"
          >
            호환 부품 확인하러 가기 →
          </Link>
        </div>
      )}
    </div>
  )
}

export default MyVehicleRegister
