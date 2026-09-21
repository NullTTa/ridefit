import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PartBadges from '../components/PartBadges'
import { VEHICLE_PLACEHOLDER_IMAGE } from '../constants/images'
import { CATEGORY_POSITION, DEFAULT_POSITION } from '../constants/vehicleFitPositions'
import { api } from '../lib/api'

const STATUS_STYLE = {
  호환가능: 'border-green-200 bg-green-50 text-green-700',
  브라켓필요: 'border-yellow-200 bg-yellow-50 text-yellow-700',
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

  if (loading) return <p className="mx-auto max-w-5xl px-4 py-16 text-ridefit-text-secondary">불러오는 중...</p>
  if (error) return <p className="mx-auto max-w-5xl px-4 py-16 text-red-600">에러: {error}</p>
  if (!vehicle) return <p className="mx-auto max-w-5xl px-4 py-16 text-red-600">존재하지 않는 차량이에요.</p>

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold text-ridefit-text">부품 입혀보기</h1>
      <p className="mb-8 text-sm text-ridefit-text-secondary">
        {vehicle.nickname || vehicle.modelYearLabel} — 호환되는 부품을 켜고 끄면서 조합을 비교해보세요.
      </p>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* 차량 이미지 + 장착된 부품 오버레이 배지 */}
        <div className="relative overflow-hidden rounded-xl border border-ridefit-border bg-ridefit-card p-6">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-lg">
            <img
              src={vehicle.photoUrl || vehicle.modelImageUrl || VEHICLE_PLACEHOLDER_IMAGE}
              alt={vehicle.modelYearLabel}
              className="h-full w-full object-contain"
            />
            {activeParts.map((part) => {
              const pos = CATEGORY_POSITION[part.category] ?? DEFAULT_POSITION
              const hasConflict = activeConflictPairs.some(
                (c) => c.partAId === part.partId || c.partBId === part.partId,
              )
              return (
                <div
                  key={part.partId}
                  className="absolute -translate-x-1/2 -translate-y-1/2 animate-fadeIn"
                  style={{ top: pos.top, left: pos.left }}
                  title={part.name}
                >
                  <span
                    className={`block rounded-full border px-2 py-1 text-xs font-semibold shadow-lg backdrop-blur ${
                      hasConflict
                        ? 'border-red-300 bg-red-50 text-red-700'
                        : 'border-ridefit-primary bg-ridefit-bg/90 text-ridefit-primary'
                    }`}
                  >
                    {part.category}
                    {hasConflict ? ' · 충돌' : ''}
                  </span>
                </div>
              )
            })}
          </div>

          {activeParts.length === 0 && (
            <p className="mt-4 text-center text-sm text-ridefit-text-secondary">
              오른쪽 목록에서 부품을 켜면 이 위치에 표시돼요.
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
                          className="h-4 w-4 accent-ridefit-primary"
                        />
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
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="mb-2 text-sm font-semibold text-red-700">동시 장착 시 충돌이 있어요</p>
              <ul className="flex flex-col gap-1">
                {activeConflictPairs.map((c) => (
                  <li key={c.id} className="text-xs text-red-700">
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
