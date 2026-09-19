import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

const CARDS = [
  { key: 'memberCount', label: '전체 회원 수' },
  { key: 'vehicleCount', label: '등록 차량 수' },
  { key: 'partCount', label: '부품 수' },
  { key: 'postCount', label: '게시글 수' },
]

function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/api/admin/stats').then(setStats).catch((err) => setError(err.message))
  }, [])

  if (error) return <p className="text-red-400">에러: {error}</p>
  if (!stats) return <p className="text-ridefit-text-secondary">불러오는 중...</p>

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map((card) => (
        <div key={card.key} className="rounded-xl border border-ridefit-border bg-ridefit-card p-5">
          <p className="text-sm text-ridefit-text-secondary">{card.label}</p>
          <p className="mt-2 text-3xl font-bold text-ridefit-text">{stats[card.key]}</p>
        </div>
      ))}
    </div>
  )
}

export default AdminDashboard
