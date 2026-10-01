import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import AiFitPanel from '../components/AiFitPanel'
import PartBadges from '../components/PartBadges'
import SafeImage from '../components/SafeImage'
import Vehicle360Viewer from '../components/Vehicle360Viewer'
import VehicleFitStage from '../components/VehicleFitStage'
import VehicleYearBadge, { ModelImageNotice } from '../components/VehicleYearBadge'
import { getVehicle360Frames, getVehicle360StartIndex } from '../constants/vehicle360'
import { getVehicleStageAspectRatio } from '../constants/vehicleFitPositions'
import { api } from '../lib/api'
import { formatFitmentYears } from '../lib/fitment'

const STATUS_STYLE = {
  호환가능: 'border-ridefit-success-border bg-ridefit-success-bg text-ridefit-success',
  브라켓필요: 'border-ridefit-warning-border bg-ridefit-warning-bg text-ridefit-warning',
}

function FitRoom() {
  const { myVehicleId } = useParams()
  const [searchParams] = useSearchParams()
  // 숫자가 아닌 값은 무시한다(호환 목록과 비교할 수 없음).
  const rawPartId = searchParams.get('partId')
  const requestedPartId = rawPartId && /^\d+$/.test(rawPartId) ? String(Number(rawPartId)) : null
  // URL로 요청된 부품의 자동 선택 결과: null(요청 없음) | { ok, name }
  const [preselect, setPreselect] = useState(null)

  const [vehicle, setVehicle] = useState(null)
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [activePartIds, setActivePartIds] = useState(new Set())
  const [conflicts, setConflicts] = useState([])
  const [checkingConflicts, setCheckingConflicts] = useState(false)
  const [viewMode, setViewMode] = useState('fit')
  // "장착해보기" 결과({ imageUrl, cached, part }). 없으면 "장착 모습" 탭 자체를 숨긴다.
  const [aiResult, setAiResult] = useState(null)

  useEffect(() => {
    setLoading(true)
    setPreselect(null)
    Promise.all([
      api.get('/api/my-vehicles'),
      api.get(`/api/my-vehicles/${myVehicleId}/compatible-parts`),
    ])
      .then(([vehicles, compatibleParts]) => {
        setVehicle(vehicles.find((v) => String(v.id) === String(myVehicleId)) ?? null)
        // 호환불가/정보없음 부품은 애초에 장착 후보에서 제외한다.
        const candidates = compatibleParts.filter((p) => p.status === '호환가능' || p.status === '브라켓필요')
        setParts(candidates)

        // ?partId= 로 들어오면(부품 찾아보기/상세의 "내 차에 장착해보기") 그 부품을 켠 상태로 연다.
        // 이 차량의 호환 후보 안에 있을 때만 켠다 - URL로 호환성 검사를 건너뛸 수 없다.
        // 사용자가 직접 켠 것이 아니므로 fit-selections(장착 시도 집계)는 기록하지 않는다.
        if (requestedPartId != null) {
          const match = candidates.find((p) => String(p.partId) === requestedPartId)
          if (match) {
            setActivePartIds(new Set([match.partId]))
            setPreselect({ ok: true, name: match.name })
          } else {
            const known = compatibleParts.find((p) => String(p.partId) === requestedPartId)
            setPreselect({ ok: false, name: known?.name ?? null })
          }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [myVehicleId, requestedPartId])

  const categories = useMemo(() => {
    const map = new Map()
    for (const part of parts) {
      if (!map.has(part.category)) map.set(part.category, [])
      map.get(part.category).push(part)
    }
    return [...map.entries()]
  }, [parts])

  const activeParts = useMemo(() => parts.filter((p) => activePartIds.has(p.partId)), [parts, activePartIds])
  const vehicle360Frames = getVehicle360Frames(vehicle)

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

  // 서버 호출(충돌 확인/장착 시도 집계)은 setState 업데이트 함수 밖에서 한 번만 한다.
  // 업데이트 함수 안에 두면 React StrictMode(개발 모드)가 함수를 두 번 실행해 집계가 2배로 쌓인다.
  const togglePart = (partId) => {
    const next = new Set(activePartIds)
    const turningOn = !next.has(partId)
    if (turningOn) next.add(partId)
    else next.delete(partId)
    setActivePartIds(next)
    checkConflicts(next)
    if (turningOn) {
      // 실제 "장착 시도" 신호 - 인기상품 계산에 쓰인다.
      api.post(`/api/parts/${partId}/fit-selections`).catch(() => {})
    }
  }

  const activeConflictPairs = conflicts.filter(
    (c) => activePartIds.has(c.partAId) && activePartIds.has(c.partBId),
  )
  const conflictPartIds = new Set(activeConflictPairs.flatMap((c) => [c.partAId, c.partBId]))

  if (loading) return <p className="mx-auto max-w-5xl px-4 py-16 text-ridefit-text-secondary">불러오는 중...</p>
  if (error || !vehicle)
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <p className="text-ridefit-danger">{error ? `에러: ${error}` : '존재하지 않는 차량이에요.'}</p>
        <Link to="/garage" className="mt-3 inline-block text-sm font-medium text-ridefit-primary hover:underline">
          내 차고로 돌아가기 →
        </Link>
      </div>
    )

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold text-ridefit-text">부품 입혀보기</h1>
      <p className="mb-8 text-sm text-ridefit-text-secondary">
        {vehicle.nickname || vehicle.modelYearLabel} — 호환되는 부품을 켜고 끄면서 조합을 비교해보세요.
      </p>

      {preselect && (
        <div
          className={`-mt-4 mb-6 rounded-lg border px-4 py-3 text-sm ${
            preselect.ok
              ? 'border-ridefit-border bg-ridefit-card text-ridefit-text'
              : 'border-ridefit-warning-border bg-ridefit-warning-bg text-ridefit-warning'
          }`}
          data-testid="fit-preselect-notice"
        >
          {preselect.ok
            ? `'${preselect.name}'을(를) 장착한 상태로 열었어요. 아래 "장착한 모습 보기"에서 장착한 모습도 확인할 수 있어요.`
            : `${preselect.name ? `'${preselect.name}'은(는) ` : '선택한 부품은 '}${
                vehicle.nickname || vehicle.modelYearLabel
              }과(와) 호환이 확인되지 않아 자동으로 장착하지 않았어요. 오른쪽 목록의 호환 부품은 그대로 사용할 수 있어요.`}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* 차량 이미지 + 장착된 부품 이미지 오버레이(오버레이 이미지가 없는 부품은 배지) */}
        <div className="relative self-start overflow-hidden rounded-xl border border-ridefit-border bg-ridefit-card p-6 lg:sticky lg:top-6">
          {(vehicle360Frames || aiResult) && (
            <div className="mb-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('fit')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  viewMode === 'fit' ? 'bg-ridefit-primary text-white' : 'bg-ridefit-bg text-ridefit-text-secondary hover:bg-ridefit-border'
                }`}
              >
                위치 미리보기
              </button>
              {vehicle360Frames && (
              <button
                type="button"
                onClick={() => setViewMode('360')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  viewMode === '360' ? 'bg-ridefit-primary text-white' : 'bg-ridefit-bg text-ridefit-text-secondary hover:bg-ridefit-border'
                }`}
              >
                360° 보기
              </button>
              )}
              {aiResult && (
                <button
                  type="button"
                  onClick={() => setViewMode('ai')}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    viewMode === 'ai' ? 'bg-ridefit-primary text-white' : 'bg-ridefit-bg text-ridefit-text-secondary hover:bg-ridefit-border'
                  }`}
                >
                  장착 모습
                </button>
              )}
            </div>
          )}

          {/* 위치 미리보기 / 360° / 장착 모습이 같은 무대 폭(max-w-2xl)과 종횡비(getVehicleStageAspectRatio)를 쓴다. */}
          <div className="relative mx-auto w-full max-w-2xl">
          <VehicleYearBadge vehicle={vehicle} />
          {viewMode === 'ai' && aiResult ? (
            <figure data-testid="ai-fit-result">
              <SafeImage
                src={aiResult.imageUrl}
                alt={`${aiResult.part.name} 장착 모습`}
                className="mx-auto w-full max-w-2xl rounded-lg object-contain"
                style={{ aspectRatio: getVehicleStageAspectRatio(vehicle) }}
                fallbackClassName="mx-auto h-64 w-full max-w-2xl rounded-lg"
                fallbackText="장착 모습을 불러오지 못했어요"
              />
              <figcaption className="mt-3 text-center text-xs text-ridefit-text-secondary">
                {aiResult.part.name} · 참고용 합성 이미지이며 실제 장착 상태와 차이가 있을 수 있습니다.
              </figcaption>
            </figure>
          ) : viewMode === '360' && vehicle360Frames ? (
            // "부품 장착" 무대와 같은 종횡비를 써서 두 보기 모드를 오갈 때 차량 크기가 달라 보이지 않게 한다.
            // 대표 사진과 같은 각도의 프레임부터 시작하고, 프레임별 차량 높이/바닥선을 대표 사진에 맞춘다.
            <Vehicle360Viewer
              frames={vehicle360Frames}
              alt={vehicle.nickname || vehicle.modelYearLabel}
              className="mx-auto w-full max-w-2xl"
              style={{ aspectRatio: getVehicleStageAspectRatio(vehicle) }}
              startIndex={getVehicle360StartIndex(vehicle.modelImageUrl)}
              normalizeTo={vehicle.modelImageUrl}
            />
          ) : (
            <VehicleFitStage vehicle={vehicle} parts={activeParts} conflictPartIds={conflictPartIds} />
          )}
          </div>
          <ModelImageNotice vehicle={vehicle} className="mt-2" />

          {viewMode === 'fit' && activeParts.length === 0 && (
            <p className="mt-4 text-center text-sm text-ridefit-text-secondary">
              오른쪽 목록에서 부품을 켜면 차량 위에 표시돼요.
            </p>
          )}

          <AiFitPanel
            vehicle={vehicle}
            myVehicleId={myVehicleId}
            activeParts={activeParts}
            viewMode={viewMode}
            onShowBasic={() => setViewMode('fit')}
            onShowResult={(result) => {
              setAiResult(result)
              setViewMode('ai')
            }}
          />
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
                        <SafeImage
                          src={part.imageUrl}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-md border border-ridefit-border bg-white object-contain p-0.5"
                          fallbackClassName="h-12 w-12 shrink-0 rounded-md border border-ridefit-border text-[9px] leading-tight"
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
                          {formatFitmentYears(part.sameModelFitments) && (
                            <p className="text-[11px] text-ridefit-text-secondary" data-testid={`fit-years-${part.partId}`}>
                              적용: {formatFitmentYears(part.sameModelFitments)}
                            </p>
                          )}
                          {part.stats?.ratingCount > 0 && (
                            <p className="text-xs text-ridefit-text-secondary">
                              <span className="text-ridefit-warning">★</span> {part.stats.avgRating.toFixed(1)}{' '}
                              <span className="text-ridefit-text-secondary/70">({part.stats.ratingCount}개 후기)</span>
                            </p>
                          )}
                          {part.stats?.badges?.length > 0 && (
                            <div className="mt-1">
                              <PartBadges badges={part.stats.badges} />
                            </div>
                          )}
                        </div>
                      </div>
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
