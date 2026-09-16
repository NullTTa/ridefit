import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

const STATUS_STYLE = {
  호환가능:
    'bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  브라켓필요:
    'bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800',
  호환불가:
    'bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
}
const DEFAULT_STATUS_STYLE =
  'bg-gray-50 text-gray-700 border-gray-300 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700'

function CompatibleParts() {
  const { myVehicleId } = useParams()
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(null)

  // 내 차량(myVehicleId) 기준 호환 부품 목록 조회. 존재하지 않는 차량이면 백엔드가 404를 반환한다.
  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    setError(null)

    fetch(`http://localhost:8080/api/my-vehicles/${myVehicleId}/compatible-parts`)
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true)
          return null
        }
        if (!res.ok) {
          throw new Error(`서버 응답 오류: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        if (data) setParts(data)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [myVehicleId])

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-ridefit-text-light dark:text-ridefit-text-dark">
        호환 부품 확인 (내 차량 #{myVehicleId})
      </h1>

      {loading && <p className="text-gray-500 dark:text-gray-400">불러오는 중...</p>}
      {notFound && (
        <p className="text-red-600 dark:text-red-400">
          존재하지 않는 차량입니다. (myVehicleId: {myVehicleId})
        </p>
      )}
      {error && <p className="text-red-600 dark:text-red-400">에러: {error}</p>}

      {!loading && !notFound && !error && parts.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400">등록된 호환 정보가 없습니다.</p>
      )}

      {!loading && !notFound && !error && parts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {parts.map((part) => (
            <div
              key={part.partId}
              className={`rounded-xl border p-4 shadow-md ${STATUS_STYLE[part.status] ?? DEFAULT_STATUS_STYLE}`}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold">{part.name}</p>
                <span className="rounded-full bg-white/60 px-2 py-1 text-xs font-bold dark:bg-black/20">
                  {part.status}
                </span>
              </div>
              <p className="mt-1 text-sm opacity-80">{part.category}</p>
              <p className="mt-2 text-sm font-medium">{part.price.toLocaleString()}원</p>
              {part.note && <p className="mt-2 text-xs opacity-70">{part.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CompatibleParts
