import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

function MyPage() {
  const { user } = useAuth()
  const [recentChecks, setRecentChecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .get('/api/me/recent-checks')
      .then(setRecentChecks)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-1 text-2xl font-bold text-ridefit-text">마이페이지</h1>
      <p className="mb-8 text-sm text-ridefit-text-secondary">
        {user?.name} ({user?.email})
      </p>

      <h2 className="mb-3 text-lg font-semibold text-ridefit-text">최근 확인한 부품</h2>

      {loading && <p className="text-ridefit-text-secondary">불러오는 중...</p>}
      {error && <p className="text-red-400">에러: {error}</p>}

      {!loading && !error && recentChecks.length === 0 && (
        <p className="text-ridefit-text-secondary">아직 확인한 부품이 없어요.</p>
      )}

      {!loading && recentChecks.length > 0 && (
        <ul className="flex flex-col gap-2">
          {recentChecks.map((check) => (
            <li
              key={check.id}
              className="flex items-center justify-between rounded-lg border border-ridefit-border bg-ridefit-card px-4 py-3"
            >
              <div>
                <p className="font-medium text-ridefit-text">{check.partName}</p>
                <p className="text-xs text-ridefit-text-secondary">{check.vehicleLabel}</p>
              </div>
              <span className="text-xs font-semibold text-ridefit-text-secondary">{check.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MyPage
