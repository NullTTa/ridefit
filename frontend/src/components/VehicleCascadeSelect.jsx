import { useEffect, useState } from 'react'
import { api } from '../lib/api'

const selectClass =
  'rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary disabled:opacity-40'

// 제조사 -> 모델 -> 연식 순으로 내려가는 캐스케이딩 선택 컴포넌트.
// 차량 등록, 그리고 부품 링크 자동인식 실패 시 수동으로 차종을 고르는 화면에서 공통으로 쓰인다.
function VehicleCascadeSelect({ onModelYearChange }) {
  const [manufacturers, setManufacturers] = useState([])
  const [models, setModels] = useState([])
  const [years, setYears] = useState([])
  const [manufacturerId, setManufacturerId] = useState('')
  const [vehicleModelId, setVehicleModelId] = useState('')
  const [modelYearId, setModelYearId] = useState('')

  useEffect(() => {
    api
      .get('/api/manufacturers', { auth: false })
      .then(setManufacturers)
      .catch(() => setManufacturers([]))
  }, [])

  useEffect(() => {
    setModels([])
    setVehicleModelId('')
    if (!manufacturerId) return
    api
      .get(`/api/manufacturers/${manufacturerId}/vehicle-models`, { auth: false })
      .then(setModels)
      .catch(() => setModels([]))
  }, [manufacturerId])

  useEffect(() => {
    setYears([])
    setModelYearId('')
    if (!vehicleModelId) return
    api
      .get(`/api/vehicle-models/${vehicleModelId}/model-years`, { auth: false })
      .then(setYears)
      .catch(() => setYears([]))
  }, [vehicleModelId])

  useEffect(() => {
    onModelYearChange?.(modelYearId ? Number(modelYearId) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelYearId])

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <select value={manufacturerId} onChange={(e) => setManufacturerId(e.target.value)} className={selectClass}>
        <option value="">제조사 선택</option>
        {manufacturers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      <select
        value={vehicleModelId}
        onChange={(e) => setVehicleModelId(e.target.value)}
        disabled={!manufacturerId}
        className={selectClass}
      >
        <option value="">{manufacturerId ? '모델 선택' : '먼저 제조사를 선택하세요'}</option>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      <select
        value={modelYearId}
        onChange={(e) => setModelYearId(e.target.value)}
        disabled={!vehicleModelId}
        className={selectClass}
      >
        <option value="">{vehicleModelId ? '연식 선택' : '먼저 모델을 선택하세요'}</option>
        {years.map((y) => (
          <option key={y.id} value={y.id}>
            {y.year}
            {y.chassisCode ? ` (${y.chassisCode})` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

export default VehicleCascadeSelect
