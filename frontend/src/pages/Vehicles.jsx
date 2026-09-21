import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import VehicleCard from '../components/VehicleCard'
import { api } from '../lib/api'

const chipClass = (active) =>
  `rounded-full px-4 py-2 text-sm font-medium transition ${
    active ? 'bg-ridefit-primary text-white' : 'bg-ridefit-card text-ridefit-text-secondary hover:bg-ridefit-border'
  }`

// 차량 둘러보기: 등록된 차종 전체를 차체 형태/제조사로 걸러서 본다. 차량 상세(/vehicles/:id)의 진입점.
function Vehicles() {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [manufacturer, setManufacturer] = useState('전체')
  const [bodyGroup, setBodyGroup] = useState('전체')

  useEffect(() => {
    api
      .get('/api/vehicles', { auth: false })
      .then(setVehicles)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const manufacturers = useMemo(() => ['전체', ...new Set(vehicles.map((v) => v.manufacturerName))], [vehicles])
  // 스쿠터 계열(맥시/쓰리휠 포함)은 하나로 묶어 필터를 단순하게 유지한다.
  const groupOf = (v) => (v.bodyStyle?.includes('스쿠터') ? '스쿠터' : (v.bodyStyle ?? v.type ?? '기타'))
  const bodyGroups = useMemo(() => ['전체', ...new Set(vehicles.map(groupOf))], [vehicles])

  const filtered = vehicles.filter(
    (v) => (manufacturer === '전체' || v.manufacturerName === manufacturer) && (bodyGroup === '전체' || groupOf(v) === bodyGroup),
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ridefit-text">차량 둘러보기</h1>
          <p className="mt-1 text-sm text-ridefit-text-secondary">
            차량을 눌러 성향과 호환 부품, 비슷한 차량까지 한 번에 확인해보세요.
          </p>
        </div>
        <Link
          to="/finder"
          className="rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
        >
          성향으로 나의 오토바이 찾기 →
        </Link>
      </div>

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="제조사 필터">
        {manufacturers.map((m) => (
          <button key={m} type="button" onClick={() => setManufacturer(m)} className={chipClass(manufacturer === m)}>
            {m}
          </button>
        ))}
      </div>
      <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="차체 형태 필터">
        {bodyGroups.map((g) => (
          <button key={g} type="button" onClick={() => setBodyGroup(g)} className={chipClass(bodyGroup === g)}>
            {g}
          </button>
        ))}
      </div>

      {loading && <p className="text-ridefit-text-secondary">불러오는 중...</p>}
      {error && <p className="text-red-600">에러: {error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p className="text-ridefit-text-secondary">조건에 맞는 차량이 없어요.</p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ))}
      </div>
    </div>
  )
}

export default Vehicles
