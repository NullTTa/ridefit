import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PartBadges from '../components/PartBadges'
import VehicleFitStage from '../components/VehicleFitStage'
import { api } from '../lib/api'

const STATUS_STYLE = {
  호환가능: 'border-ridefit-success-border bg-ridefit-success-bg text-ridefit-success',
  브라켓필요: 'border-ridefit-warning-border bg-ridefit-warning-bg text-ridefit-warning',
}

function FitRoom() {
  const { myVehicleId } = useParams()

  const [vehicle, setVehicle] = useState(null)
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [activePartIds, setActivePartIds] = useState(new Set())
  const [conflicts, setConflicts] = useState([])
  const [checkingConflicts, setCheckingConflicts] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/api/my-vehicles'),
      api.get(`/api/my-vehicles/${myVehicleId}/compatible-parts`),
    ])
      .then(([vehicles, compatibleParts]) => {
        setVehicle(vehicles.find((v) => String(v.id) === String(myVehicleId)) ?? null)
        // 호환불가/정보없음 부품은 애초에 장착 후보에서 제외한다.
        setParts(compatibleParts.filter((p) => p.status === '호환가능' || p.status === '브라켓필요'))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [myVehicleId])

  const categories = useMemo(() => {
    const map = new Map()
    for (const part of parts) {
      if (!map.has(part.category)) map.set(part.category, [])
      map.get(part.category).push(part)
    }
    return [...map.entries()]
  }, [parts])

  const activeParts = useMemo(() => parts.filter((p) => activePartIds.has(p.partId)), [parts, activePartIds])

  const checkConflicts = async (nextIds) => {
    if (nextIds.size < 2) {
      setConflicts([])
      return
    }
    setCheckingConflicts(true)
    try {
      const result = await api.post('/api/part-conflicts/check', { partIds: [...nextIds] })
      setConflicts(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setCheckingConflicts(false)
    }
  }

  const togglePart = (partId) => {
    setActivePartIds((prev) => {
      const next = new Set(prev)
      const turningOn = !next.has(partId)
      turningOn ? next.add(partId) : next.delete(partId)
      checkConflicts(next)
      if (turningOn) {
        // 실제 "장착 시도" 신호 - 인기상품 계산에 쓰인다.
        api.post(`/api/parts/${partId}/fit-selections`).catch(() => {})
      }
      return next
    })
  }

  const activeConflictPairs = conflicts.filter(
    (c) => activePartIds.has(c.partAId) && activePartIds.has(c.partBId),
  )
  const conflictPartIds = new Set(activeConflictPairs.flatMap((c) => [c.partAId, c.partBId]))

  if (loading) return <p className="mx-auto max-w-5xl px-4 py-16 text-ridefit-text-secondary">불러오는 중...</p>
  if (error) return <p className="mx-auto max-w-5xl px-4 py-16 text-ridefit-danger">에러: {error}</p>
  if (!vehicle) return <p className="mx-auto max-w-5xl px-4 py-16 text-ridefit-danger">존재하지 않는 차량이에요.</p>

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold text-ridefit-text">부품 입혀보기</h1>
      <p className="mb-8 text-sm text-ridefit-text-secondary">
        {vehicle.nickname || vehicle.modelYearLabel} — 호환되는 부품을 켜고 끄면서 조합을 비교해보세요.
      </p>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* 차량 이미지 + 장착된 부품 이미지 오버레이(오버레이 이미지가 없는 부품은 배지) */}
        <div className="relative self-start overflow-hidden rounded-xl border border-ridefit-border bg-ridefit-card p-6 lg:sticky lg:top-6">
          <VehicleFitStage vehicle={vehicle} parts={activeParts} conflictPartIds={conflictPartIds} />

          {activeParts.length === 0 && (
            <p className="mt-4 text-center text-sm text-ridefit-text-secondary">
              오른쪽 목록에서 부품을 켜면 차량 위에 표시돼요.
            </p>
          )}
        </div>

        {/* 카테고리별 부품 토글 목록 */}
        <div className="flex flex-col gap-6">
          {parts.length === 0 && (
            <p className="text-sm text-ridefit-text-secondary">
              이 차량에 호환이 확인된 부품이 아직 없어요.{' '}
              <Link to="/parts/import" className="text-ridefit-primary hover:underline">
                부품 링크로 확인하러 가기
              </Link>
            </p>
          )}

          {categories.map(([category, categoryParts]) => (
            <div key={category}>
              <h2 className="mb-2 text-sm font-semibold text-ridefit-text-secondary">{category}</h2>
              <div className="flex flex-col gap-2">
                {categoryParts.map((part) => {
                  const isActive = activePartIds.has(part.partId)
                  return (
                    <label
                      key={part.partId}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 transition ${
                        isActive
                          ? (STATUS_STYLE[part.status] ?? 'border-ridefit-primary bg-ridefit-primary/10')
                          : 'border-ridefit-border bg-ridefit-card hover:border-ridefit-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => togglePart(part.partId)}
                          className="h-4 w-4 shrink-0 accent-ridefit-primary"
                        />
                        {part.imageUrl ? (
                          <img
                            src={part.imageUrl}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-md border border-ridefit-border bg-white object-contain p-0.5"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-ridefit-border bg-ridefit-bg-alt text-center text-[9px] leading-tight text-ridefit-text-secondary">
                            이미지 준비중
                          </div>
                        )}
                        <div>
                          <Link
                            to={`/parts/${part.partId}?vehicleId=${myVehicleId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm font-medium text-ridefit-text hover:underline"
                          >
                            {part.name}
                          </Link>
                          <p className="text-xs text-ridefit-text-secondary">
                            {part.price.toLocaleString()}원 · {part.status}
                          </p>
                          {part.stats?.badges?.length > 0 && (
                            <div className="mt-1">
                              <PartBadges badges={part.stats.badges} />
                            </div>
                          )}
                        </div>
                      </div>
                      {isActive && (
                        <Link
                          to={`/synth?partId=${part.partId}&vehicleId=${myVehicleId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 text-xs font-medium text-ridefit-primary hover:underline"
                        >
                          AI 합성 보기
                        </Link>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}

          {checkingConflicts && <p className="text-xs text-ridefit-text-secondary">충돌 확인 중...</p>}

          {activeConflictPairs.length > 0 && (
            <div className="rounded-lg border border-ridefit-danger-border bg-ridefit-danger-bg p-4">
              <p className="mb-2 text-sm font-semibold text-ridefit-danger">동시 장착 시 충돌이 있어요</p>
              <ul className="flex flex-col gap-1">
                {activeConflictPairs.map((c) => (
                  <li key={c.id} className="text-xs text-ridefit-danger">
                    {c.partAName} + {c.partBName}: {c.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeParts.length > 0 && (
            <div className="rounded-lg border border-ridefit-border bg-ridefit-card p-4">
              <p className="mb-1 text-sm font-semibold text-ridefit-text">
                현재 조합 ({activeParts.length}개) · 합계{' '}
                {activeParts.reduce((sum, p) => sum + p.price, 0).toLocaleString()}원
              </p>
              <p className="text-xs text-ridefit-text-secondary">
                {activeParts.map((p) => p.name).join(', ')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FitRoom
