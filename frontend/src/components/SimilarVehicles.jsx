import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import VehicleCard from './VehicleCard'

// "이 차량과 비슷한 차량" / "내 차량과 비슷한 차량" / "최근 본 차량과 비슷한 차량" 공통 블록.
// ids: 기준 차종(VehicleModel) id 목록. 서버가 배기량/차체 형태/가격대/성향을 비교해서 이유와 함께 돌려준다.
// 기준 차량이 없거나 추천할 차량이 없으면 아무것도 그리지 않는다.
function SimilarVehicles({ ids, title, description, limit = 4, className = '' }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const key = ids.join(',')

  useEffect(() => {
    if (!key) {
      setItems([])
      setLoading(false)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    api
      .get(`/api/vehicles/similar?ids=${key}&limit=${limit}`, { auth: false })
      .then((data) => !cancelled && setItems(data))
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [key, limit])

  if (!key || (!loading && items.length === 0)) return null

  return (
    <section className={className}>
      <h2 className="text-xl font-bold text-ridefit-text">{title}</h2>
      {description && <p className="mt-1 text-sm text-ridefit-text-secondary">{description}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-ridefit-text-secondary">불러오는 중...</p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <VehicleCard
              key={item.vehicle.id}
              vehicle={item.vehicle}
              badge={`유사도 ${item.similarityPercent}%`}
              reasons={item.reasons}
              footer={<p className="text-xs text-ridefit-text-secondary">{item.basedOnName} 기준</p>}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default SimilarVehicles
