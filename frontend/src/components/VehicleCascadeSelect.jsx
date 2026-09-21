import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

const selectClass =
  'rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary disabled:opacity-40'

// 제조사 -> 모델 -> 연식 순으로 내려가는 캐스케이딩 선택 컴포넌트.
// 차량 등록, 부품 링크 자동인식 실패 시 수동 선택, 차량 수정(연식 변경) 화면에서 공통으로 쓰인다.
// initial* props는 수정 화면에서 기존 값으로 미리 채워둘 때만 사용한다.
function VehicleCascadeSelect({ onModelYearChange, initialManufacturerId, initialVehicleModelId, initialModelYearId }) {
  const [manufacturers, setManufacturers] = useState([])
  const [models, setModels] = useState([])
  const [years, setYears] = useState([])
  const [manufacturerId, setManufacturerId] = useState(initialManufacturerId ? String(initialManufacturerId) : '')
  const [vehicleModelId, setVehicleModelId] = useState(initialVehicleModelId ? String(initialVehicleModelId) : '')
  const [modelYearId, setModelYearId] = useState(initialModelYearId ? String(initialModelYearId) : '')

  // 한 단계 위 값이 "처음 넘어온 값" 그대로인 동안에는 아래 단계를 리셋하지 않는다 - 사용자가 실제로
  // 다른 값을 고르면 더 이상 초기값과 같지 않으므로 정상적으로 리셋된다. 값 비교 방식이라 StrictMode가
  // 이 effect를 두 번 실행해도(같은 값끼리 비교) "한 번 쓰고 버리는 플래그" 방식과 달리 순서에 영향을 받지 않는다.
  const initialManufacturerIdRef = useRef(initialManufacturerId ? String(initialManufacturerId) : null)
  const initialVehicleModelIdRef = useRef(initialVehicleModelId ? String(initialVehicleModelId) : null)

  useEffect(() => {
    api
      .get('/api/manufacturers', { auth: false })
      .then(setManufacturers)
      .catch(() => setManufacturers([]))
  }, [])

  useEffect(() => {
    setModels([])
    if (!manufacturerId) {
      setVehicleModelId('')
      return
    }
    api
      .get(`/api/manufacturers/${manufacturerId}/vehicle-models`, { auth: false })
      .then((data) => {
        setModels(data)
        if (manufacturerId !== initialManufacturerIdRef.current) setVehicleModelId('')
      })
      .catch(() => setModels([]))
  }, [manufacturerId])

  useEffect(() => {
    setYears([])
    if (!vehicleModelId) {
      setModelYearId('')
      return
    }
    api
      .get(`/api/vehicle-models/${vehicleModelId}/model-years`, { auth: false })
      .then((data) => {
        setYears(data)
        if (vehicleModelId !== initialVehicleModelIdRef.current) setModelYearId('')
      })
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
