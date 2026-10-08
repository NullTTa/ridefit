import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Heart, Maximize2, Star, Trash2 } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import AiFitPanel from '../components/AiFitPanel'
import ConfirmDialog from '../components/ConfirmDialog'
import { Ico } from '../components/Icon'
import { ImageLightbox, Lightbox } from '../components/Lightbox'
import PartBadges from '../components/PartBadges'
import ProductImage from '../components/ProductImage'
import SafeImage from '../components/SafeImage'
import Vehicle360Viewer from '../components/Vehicle360Viewer'
import VehicleFitStage from '../components/VehicleFitStage'
import VehicleYearBadge, { ModelImageNotice } from '../components/VehicleYearBadge'
import { getVehicle360Frames, getVehicle360StartIndex } from '../constants/vehicle360'
import { get360PartLayerInfo } from '../constants/vehicle360Parts'
import { HERO_BUILD } from '../constants/heroBuild'
import { getFitLayout, getStageScale, getVehicleStageAspectRatio } from '../constants/vehicleFitPositions'
import { api } from '../lib/api'
import { loadFitBuild, saveFitBuild } from '../lib/fitBuild'
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
  // ?build=hero : 홈 Hero에 보여준 구성(부품 이름 기준 - DB마다 id가 다를 수 있어 이름으로 맞춘다)을 켠 상태로 연다.
  const requestedBuild = searchParams.get('build') === 'hero' ? HERO_BUILD.map((b) => b.partName) : null
  // URL로 요청된 부품의 자동 선택 결과: null(요청 없음) | { ok, name }
  const [preselect, setPreselect] = useState(null)
  // 같은 자리(같은 카테고리) 부품을 바꿔 끼웠을 때 안내: { category, from, to } | null
  const [replaced, setReplaced] = useState(null)

  const [vehicle, setVehicle] = useState(null)
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [activePartIds, setActivePartIds] = useState(new Set())
  const [conflicts, setConflicts] = useState([])
  const [checkingConflicts, setCheckingConflicts] = useState(false)
  const [viewMode, setViewMode] = useState('fit')
  // "장착해보기" 결과({ imageUrl, cached, title }). 없으면 "장착 모습" 탭 자체를 숨긴다.
  const [aiResult, setAiResult] = useState(null)
  // 이 차량으로 만든 장착 결과 전체(서버에 저장된 것, 최신순). 만들 때마다 늘어나고 지워지지 않는다.
  const [savedResults, setSavedResults] = useState([])
  // 저장된 장착 모습 개별 삭제(합성 결과 이미지만 - 부품 저장/장착해보기 선택과는 무관)
  const [resultToDelete, setResultToDelete] = useState(null)
  const [deletingResult, setDeletingResult] = useState(false)
  const [resultDeleteError, setResultDeleteError] = useState('')
  const [aiCheckKey, setAiCheckKey] = useState(0)
  // "크게 보기"(전체 화면)로 연 장착 결과. null이면 닫힘.
  const [zoomed, setZoomed] = useState(null)
  // 위치 미리보기 크게 보기(원본 이미지들을 큰 무대에 다시 배치 - 작은 화면을 늘리는 것이 아님)
  const [stageZoom, setStageZoom] = useState(false)
  // 목록 카테고리 필터(null = 전체). 장착 상태와 무관 - 다른 카테고리에서 장착한 부품은 그대로 장착돼 있다.
  const [categoryFilter, setCategoryFilter] = useState(null)
  // true면 "이 차량에 저장한 부품"만 목록에 보인다(장착 상태와 무관).
  const [savedOnly, setSavedOnly] = useState(false)
  // 이 차량에 저장한(즐겨찾기) 부품 id. "장착해보기"와는 별개의 행동이다(하나를 눌러도 다른 쪽은 바뀌지 않음).
  const [savedPartIds, setSavedPartIds] = useState(new Set())

  useEffect(() => {
    setSavedPartIds(new Set())
    api
      .get(`/api/me/favorites?myVehicleId=${myVehicleId}`)
      .then((data) => setSavedPartIds(new Set(data.map((f) => f.partId))))
      .catch(() => {})
  }, [myVehicleId])

  const toggleSaved = (partId) => {
    const saved = savedPartIds.has(partId)
    const flip = (prev) => {
      const next = new Set(prev)
      saved ? next.delete(partId) : next.add(partId)
      return next
    }
    setSavedPartIds(flip)
    ;(saved
      ? api.del(`/api/me/favorites/${partId}?myVehicleId=${myVehicleId}`)
      : api.post('/api/me/favorites', { partId, myVehicleId: Number(myVehicleId) })
    ).catch(() => setSavedPartIds((prev) => {
      const next = new Set(prev)
      saved ? next.add(partId) : next.delete(partId)
      return next
    }))
  }

  const loadSavedResults = () =>
    api
      .get(`/api/ai-fit/results?myVehicleId=${myVehicleId}`)
      .then((data) => {
        setSavedResults(data)
        return data
      })
      .catch(() => {
        setSavedResults([])
        return []
      })

  const confirmDeleteResult = async () => {
    const target = resultToDelete
    if (!target) return
    setDeletingResult(true)
    setResultDeleteError('')
    try {
      await api.del(`/api/ai-fit/results/${target.id}`)
      setSavedResults((prev) => prev.filter((r) => r.id !== target.id))
      // 지금 크게 보고 있던 결과면 기본 장착 화면으로 돌아가고, AI 패널은 캐시 상태를 다시 확인한다.
      if (aiResult?.imageUrl === target.imageUrl) {
        setAiResult(null)
        setViewMode('fit')
      }
      setAiCheckKey((k) => k + 1)
    } catch (err) {
      setResultDeleteError(err.message || '삭제하지 못했어요.')
    } finally {
      setDeletingResult(false)
      setResultToDelete(null)
    }
  }

  // ?result=<id>(내 차고의 "저장된 장착 모습"에서 들어온 경우): 이 차량의 저장 결과 중 그 결과를 바로 보여준다.
  // 이 차량 결과 목록에 없는 id는 무시한다(다른 차량 결과를 URL로 열 수 없다). 새로 생성하지 않는다.
  const requestedResultId = searchParams.get('result')

  useEffect(() => {
    loadSavedResults().then((data) => {
      const r = requestedResultId && data.find((x) => String(x.id) === requestedResultId)
      if (r) {
        setAiResult({ imageUrl: r.imageUrl, cached: true, title: r.partNames.join(' + ') })
        setViewMode('ai')
      }
    })
  }, [myVehicleId])

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
        if (requestedBuild) {
          // 호환 후보 안에 있는 것만, 같은 카테고리는 하나만 켠다(URL로 호환성 검사를 건너뛸 수 없다).
          const picked = []
          for (const name of requestedBuild) {
            const match = candidates.find((p) => p.name === name)
            if (match && !picked.some((x) => x.category === match.category)) picked.push(match)
          }
          if (picked.length > 0) {
            setActivePartIds(new Set(picked.map((p) => p.partId)))
            setPreselect({ ok: true, name: picked.map((p) => p.name).join(', '), build: true })
          } else {
            setPreselect({ ok: false, name: null, build: true })
          }
        } else if (requestedPartId != null) {
          const match = candidates.find((p) => String(p.partId) === requestedPartId)
          if (match) {
            // "장착해보기"로 들어오면 이 차량의 현재 구성에 이 부품을 더한다(같은 자리 부품은 바꿔 끼움) - 내 차고 "현재 구성"과 이어진다.
            const kept = loadFitBuild(myVehicleId)
              .map((id) => candidates.find((p) => p.partId === id))
              .filter((p) => p && p.partId !== match.partId && p.category !== match.category)
              .map((p) => p.partId)
            const next = new Set([...kept, match.partId])
            setActivePartIds(next)
            saveFitBuild(myVehicleId, next)
            if (next.size > 1) checkConflicts(next)
            setPreselect({ ok: true, name: match.name })
          } else {
            const known = compatibleParts.find((p) => String(p.partId) === requestedPartId)
            setPreselect({ ok: false, name: known?.name ?? null })
          }
        } else {
          // 링크로 지정한 부품이 없으면 이 차량에서 마지막으로 맞춰 둔 "현재 구성"을 이어서 보여준다(지금도 호환 후보인 것만).
          const saved = loadFitBuild(myVehicleId).filter((id) => candidates.some((p) => p.partId === id))
          if (saved.length > 0) {
            setActivePartIds(new Set(saved))
            checkConflicts(new Set(saved))
          }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myVehicleId, requestedPartId, requestedBuild?.join('|')])

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
  // 360 보기: 장착한 부품 중 8개 각도 레이어가 완성된 것만 레이어로 겹치고, 나머지는 "360° 장착 이미지 준비 중"으로 알린다.
  // (장착 상태는 위치 미리보기/360/장착 모습 만들기가 모두 같은 activePartIds 하나를 쓴다)
  const layers360 = vehicle360Frames
    ? activeParts
        .map((p) => ({ key: p.partId, ...get360PartLayerInfo(vehicle.modelImageUrl, p.name, vehicle360Frames.length) }))
        .filter((l) => l.frames)
    : []
  const pending360 = vehicle360Frames ? activeParts.filter((p) => !layers360.some((l) => l.key === p.partId)) : []

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
  // 같은 자리(같은 카테고리, 예: 사이드백 121과 122)에는 하나만 장착된다 - 새로 켜면 기존 것을 빼고 바꿔 끼운 것을 알린다.
  const togglePart = (partId) => {
    const next = new Set(activePartIds)
    const turningOn = !next.has(partId)
    setReplaced(null)
    if (turningOn) {
      const part = parts.find((p) => p.partId === partId)
      const sameSlot = parts.filter((p) => p.partId !== partId && next.has(p.partId) && p.category === part?.category)
      sameSlot.forEach((p) => next.delete(p.partId))
      if (sameSlot.length > 0) setReplaced({ category: part.category, from: sameSlot.map((p) => p.name).join(', '), to: part.name })
      next.add(partId)
    } else next.delete(partId)
    setActivePartIds(next)
    saveFitBuild(myVehicleId, next)
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
          내 차고로 돌아가기 <Ico as={ArrowRight} />
        </Link>
      </div>
    )

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {zoomed && (
        // 전체 화면 보기: 저장된 원본 결과 이미지를 그대로(썸네일 아님). 기본은 원본보다 크게 늘리지 않는 화면 맞춤, 큰 원본은 1:1로도 본다.
        <ImageLightbox
          src={zoomed.imageUrl}
          alt={`${zoomed.title} 장착 모습`}
          title={zoomed.title}
          onClose={() => setZoomed(null)}
          testid="ai-fit-lightbox"
        />
      )}
      {stageZoom && (
        // 위치 미리보기 크게 보기: 같은 원본 이미지(차량 1829px, 부품 레이어)를 큰 무대에 다시 배치한다 - 원본 픽셀보다 크게는 늘리지 않는다.
        <Lightbox
          label="위치 미리보기 크게 보기"
          onClose={() => setStageZoom(false)}
          testid="fit-stage-lightbox"
          footer={<p className="w-full text-xs text-white/80">{activeParts.map((p) => p.name).join(' + ') || '순정'} · 위치 미리보기</p>}
        >
          <div
            className="w-full overflow-hidden rounded-lg bg-ridefit-card"
            style={{ maxWidth: `min(100%, calc((100vh - 9rem) * ${getVehicleStageAspectRatio(vehicle)}))` }}
            onClick={(e) => e.stopPropagation()}
          >
            <VehicleFitStage vehicle={vehicle} parts={activeParts} conflictPartIds={conflictPartIds} large />
          </div>
        </Lightbox>
      )}

      <p className="text-xs font-semibold uppercase tracking-wider text-ridefit-primary">부품 입혀보기</p>
      <h1 className="mt-1 text-2xl font-bold text-ridefit-text" data-testid="fit-vehicle-title">
        {vehicle.nickname ? `${vehicle.nickname} · ` : ''}
        {vehicle.manufacturerName} {vehicle.modelYearLabel}
      </h1>
      <p className="mb-8 mt-1 text-sm text-ridefit-text-secondary">이 차량에 장착 가능한 부품을 골라 직접 장착해보세요.</p>

      {preselect && (
        <div
          className={`-mt-4 mb-6 rounded-lg border px-4 py-3 text-sm ${
            preselect.ok
              ? 'border-ridefit-border bg-ridefit-card text-ridefit-text'
              : 'border-ridefit-warning-border bg-ridefit-warning-bg text-ridefit-warning'
          }`}
          data-testid="fit-preselect-notice"
        >
          {preselect.build
            ? preselect.ok
              ? `홈에서 본 구성 중 이 차량에 호환되는 부품(${preselect.name})을 장착한 상태로 열었어요. [360° 보기]로 돌려보거나 하나씩 빼볼 수 있어요.`
              : `홈에서 본 구성은 ${vehicle.nickname || vehicle.modelYearLabel}과(와) 호환이 확인되지 않아 장착하지 않았어요. 부품 목록의 호환 부품으로 직접 장착해보세요.`
            : preselect.ok
            ? `'${preselect.name}'을(를) 장착한 상태로 열었어요. 아래 "장착한 모습" 패널에서 장착 결과 이미지도 만들 수 있어요.`
            : `${preselect.name ? `'${preselect.name}'은(는) ` : '선택한 부품은 '}${
                vehicle.nickname || vehicle.modelYearLabel
              }과(와) 호환이 확인되지 않아 자동으로 장착하지 않았어요. 부품 목록의 호환 부품은 그대로 사용할 수 있어요.`}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* 차량 이미지 + 장착된 부품 이미지 오버레이(오버레이 이미지가 없는 부품은 배지) */}
        {/* 위치 미리보기 / 360° / 장착 모습 모두 같은 카드·같은 무대 크기(보기를 바꿔도 배치와 차량 크기가 그대로). 장착 모습 원본 크기는 "크게 보기". */}
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

          {/* 위치 미리보기 / 360° / 장착 모습 모두 같은 무대 폭(max-w-2xl)과 종횡비(getVehicleStageAspectRatio)를 쓴다 - 보기를 바꿔도 차량 크기가 같다.
              isolate: 무대 안의 z-index(연식 배지 z-50 등)가 스크롤 시 상단 헤더(z-50) 위로 올라오지 않게 가둔다. */}
          <div className="relative isolate mx-auto w-full max-w-2xl">
          <VehicleYearBadge vehicle={vehicle} />
          {viewMode === 'ai' && aiResult ? (
            // 결과 이미지는 차량 주변만 남기고 잘린 사진(차량이 약 89%)이라, 더 넓은 박스에 꽉 채우면 위치 미리보기/360°보다 차량이 2배 가까이
            // 커 보였다. 같은 무대(폭/종횡비) 안에 object-contain으로 넣어 차량 크기를 다른 보기와 맞춘다. 원본 크기는 "크게 보기"로 본다.
            <figure data-testid="ai-fit-result">
              <button
                type="button"
                onClick={() => setZoomed(aiResult)}
                className="block w-full cursor-zoom-in"
                aria-label="장착 모습 크게 보기"
              >
                {/* 이미지는 absolute로 넣어 원본 픽셀 크기가 열(grid) 폭을 밀어내지 않게 한다 - 보기를 바꿔도 무대 폭이 그대로. */}
                <div className="relative w-full overflow-hidden rounded-lg bg-black" style={{ aspectRatio: getVehicleStageAspectRatio(vehicle) }}>
                  <SafeImage
                    src={aiResult.imageUrl}
                    alt={`${aiResult.title} 장착 모습`}
                    className="absolute inset-0 block h-full w-full object-contain"
                    fallbackClassName="absolute inset-0 h-full w-full rounded-lg"
                    fallbackText="장착 모습을 불러오지 못했어요"
                  />
                </div>
              </button>
              <figcaption className="mt-3 flex flex-col items-center gap-2 text-center text-xs text-ridefit-text-secondary">
                <span>{aiResult.title} · 참고용 합성 이미지이며 실제 장착 상태와 차이가 있을 수 있습니다.</span>
                <button
                  type="button"
                  onClick={() => setZoomed(aiResult)}
                  className="rounded-full border border-ridefit-border px-3 py-1 font-semibold text-ridefit-text transition hover:border-ridefit-primary"
                  data-testid="ai-fit-zoom"
                >
                  크게 보기
                </button>
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
              fillScale={getStageScale(vehicle)}
              startIndex={getVehicle360StartIndex(vehicle.modelImageUrl)}
              normalizeTo={vehicle.modelImageUrl}
              layers={layers360}
              expandable
            />
          ) : getFitLayout(vehicle) ? (
            // 누르면 크게 보기(원본 이미지로 다시 그린 큰 무대)
            <div className="relative">
              <button type="button" onClick={() => setStageZoom(true)} className="block w-full cursor-zoom-in" aria-label="위치 미리보기 크게 보기" data-testid="fit-stage-zoom-area">
                <VehicleFitStage vehicle={vehicle} parts={activeParts} conflictPartIds={conflictPartIds} />
              </button>
              <button
                type="button"
                onClick={() => setStageZoom(true)}
                className="absolute right-2 top-2 z-[60] flex items-center gap-1 rounded-full border border-ridefit-border bg-ridefit-bg/85 px-2.5 py-1.5 text-xs font-medium text-ridefit-text shadow-lg backdrop-blur transition hover:border-ridefit-primary hover:text-ridefit-primary"
                data-testid="fit-stage-zoom"
              >
                <Maximize2 aria-hidden="true" className="h-3.5 w-3.5" />크게 보기
              </button>
            </div>
          ) : (
            <VehicleFitStage vehicle={vehicle} parts={activeParts} conflictPartIds={conflictPartIds} />
          )}
          </div>
          <ModelImageNotice vehicle={vehicle} className="mt-2" />

          {viewMode === '360' && pending360.length > 0 && (
            <p className="mt-3 rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2 text-center text-xs text-ridefit-text-secondary" data-testid="fit-360-pending">
              360° 장착 이미지 준비 중: {pending360.map((p) => p.name).join(', ')}
              <span className="mt-0.5 block">장착 상태는 그대로예요. [위치 미리보기]나 [장착한 모습 만들기]에서 확인할 수 있어요.</span>
            </p>
          )}
          {replaced && (
            <p className="mt-3 rounded-lg border border-ridefit-primary/40 bg-ridefit-primary/10 px-3 py-2 text-center text-xs text-ridefit-text" data-testid="fit-replaced">
              {replaced.category}는 한 자리에 하나만 장착돼요 - {replaced.from} 대신 {replaced.to}(으)로 바꿨어요.
            </p>
          )}

          {viewMode === 'fit' && activeParts.length === 0 && (
            <p className="mt-4 text-center text-sm text-ridefit-text-secondary">
              부품 목록에서 [장착해보기]를 누르면 차량 위에 표시돼요.
            </p>
          )}

          <AiFitPanel
            vehicle={vehicle}
            myVehicleId={myVehicleId}
            activeParts={activeParts}
            viewMode={viewMode}
            onShowBasic={() => setViewMode('fit')}
            onGenerated={loadSavedResults}
            refreshKey={aiCheckKey}
            savedResults={savedResults}
            onShowResult={(result) => {
              setAiResult(result)
              setViewMode('ai')
            }}
          />

          {savedResults.length > 0 && (
            <div className="mt-6 text-left" data-testid="ai-fit-history">
              <p className="mb-2 text-sm font-semibold text-ridefit-text">저장된 장착 모습 ({savedResults.length})</p>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {savedResults.map((r) => {
                  const title = r.partNames.join(' + ')
                  const active = viewMode === 'ai' && aiResult?.imageUrl === r.imageUrl
                  return (
                    <li key={r.id} className="relative">
                      <button
                        type="button"
                        onClick={() => setResultToDelete(r)}
                        className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white transition hover:border-ridefit-danger hover:text-ridefit-danger"
                        aria-label={`${title} 장착 모습 삭제`}
                        title="장착 모습 삭제"
                        data-testid={`ai-fit-history-delete-${r.id}`}
                      >
                        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAiResult({ imageUrl: r.imageUrl, cached: true, title })
                          setViewMode('ai')
                        }}
                        className={`w-full overflow-hidden rounded-md border bg-ridefit-card text-left transition ${
                          active ? 'border-ridefit-primary ring-1 ring-ridefit-primary' : 'border-ridefit-border hover:border-ridefit-primary'
                        }`}
                        title={title}
                        data-testid={`ai-fit-history-${r.id}`}
                      >
                        <SafeImage
                          src={r.imageUrl}
                          alt={`${title} 장착 모습`}
                          className="aspect-[4/3] w-full bg-ridefit-bg object-contain"
                          fallbackClassName="aspect-[4/3] w-full text-[9px]"
                          fallbackText="이미지 없음"
                        />
                        <span className="block truncate px-1.5 pt-1 text-[10px] text-ridefit-text">{title}</span>
                        <span className="block px-1.5 pb-1 text-[10px] text-ridefit-text-secondary">
                          {new Date(r.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {resultDeleteError && (
            <p className="mt-2 text-sm text-ridefit-danger" role="alert" data-testid="ai-fit-history-delete-error">{resultDeleteError}</p>
          )}
          <ConfirmDialog
            open={!!resultToDelete}
            title="저장된 장착 모습을 삭제할까요?"
            message="이 합성 결과 이미지를 삭제합니다."
            confirmLabel="삭제"
            cancelLabel="취소"
            danger
            busy={deletingResult}
            onConfirm={confirmDeleteResult}
            onCancel={() => setResultToDelete(null)}
          />
        </div>

        {/* 카테고리별 부품 토글 목록 - "이 차량에 장착 가능한(호환) 부품" 전체. [장착해보기]는 화면 안의 임시 선택일 뿐 저장되지 않는다([♡ 저장]만 차량별 즐겨찾기로 저장). */}
        <div className="flex flex-col gap-6">
          {parts.length > 0 && (
            <div data-testid="fit-candidates-heading">
              <h2 className="text-lg font-semibold text-ridefit-text">
                {vehicle.nickname || vehicle.modelYearLabel}에 장착 가능한 부품 ({parts.length}개)
              </h2>
              <p className="mt-1 text-xs text-ridefit-text-secondary">
                이 차량과 호환되는 부품만 보여드려요. 저장한 부품 목록이 아니에요 - [장착해보기]는 이 화면에서만 붙여보는 것이고,
                [저장]을 누른 부품만 내 차고에 남아요.
              </p>
              {/* 세 가지를 구분해서 보여준다: 호환(이 목록 전체) / 저장(♥) / 지금 입혀보는 중(✓) */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" data-testid="fit-summary">
                <span className="rounded-full border border-ridefit-border px-2.5 py-1 text-ridefit-text-secondary">호환 {parts.length}개</span>
                <span className="rounded-full border border-ridefit-primary/50 bg-ridefit-primary/10 px-2.5 py-1 font-medium text-ridefit-primary" data-testid="fit-summary-active">
                  <Ico as={Check} className="mr-1" />입혀보는 중 {activePartIds.size}개
                </span>
                <button
                  type="button"
                  onClick={() => setSavedOnly((v) => !v)}
                  aria-pressed={savedOnly}
                  data-testid="fit-saved-only"
                  className={`rounded-full border px-2.5 py-1 font-medium transition ${
                    savedOnly
                      ? 'border-ridefit-warning bg-ridefit-warning/15 text-ridefit-warning'
                      : 'border-ridefit-warning/50 text-ridefit-warning hover:bg-ridefit-warning/10'
                  }`}
                >
                  <Ico as={Heart} className="mr-1" filled />저장한 부품 {parts.filter((p) => savedPartIds.has(p.partId)).length}개{savedOnly ? ' · 전체 보기' : ' 만 보기'}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="부품 카테고리">
                {[null, ...categories.map(([c]) => c)].map((c) => (
                  <button
                    key={c ?? 'all'}
                    type="button"
                    onClick={() => setCategoryFilter(c)}
                    aria-pressed={categoryFilter === c}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      categoryFilter === c ? 'bg-ridefit-primary text-white' : 'bg-ridefit-card text-ridefit-text-secondary hover:bg-ridefit-bg-alt'
                    }`}
                  >
                    {c ?? '전체'}
                  </button>
                ))}
              </div>
            </div>
          )}
          {parts.length === 0 && (
            <p className="text-sm text-ridefit-text-secondary">
              이 차량에 호환이 확인된 부품이 아직 없어요.{' '}
              <Link to="/parts/import" className="text-ridefit-primary hover:underline">
                부품 링크로 확인하러 가기
              </Link>
            </p>
          )}

          {savedOnly && !parts.some((p) => savedPartIds.has(p.partId)) && (
            <p className="rounded-lg border border-dashed border-ridefit-border px-3 py-3 text-sm text-ridefit-text-secondary" data-testid="fit-saved-empty">
              아직 이 차량에 저장한 부품이 없어요. 마음에 드는 부품의 [저장]을 눌러보세요.
            </p>
          )}

          {categories
            .filter(([category]) => categoryFilter === null || category === categoryFilter)
            .map(([category, allParts]) => [category, savedOnly ? allParts.filter((p) => savedPartIds.has(p.partId)) : allParts])
            .filter(([, categoryParts]) => categoryParts.length > 0)
            .map(([category, categoryParts]) => (
            <div key={category}>
              <h3 className="mb-2 text-sm font-semibold text-ridefit-text-secondary">{category}</h3>
              <div className="flex flex-col gap-2">
                {categoryParts.map((part) => {
                  const isActive = activePartIds.has(part.partId)
                  const isSaved = savedPartIds.has(part.partId)
                  return (
                    <div
                      key={part.partId}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition ${
                        isActive
                          ? (STATUS_STYLE[part.status] ?? 'border-ridefit-primary bg-ridefit-primary/10')
                          : 'border-ridefit-border bg-ridefit-card'
                      }`}
                      data-testid={`fit-part-${part.partId}`}
                    >
                      <div className="w-16 shrink-0 overflow-hidden rounded-lg border border-ridefit-border">
                        <ProductImage src={part.imageUrl} alt="" className="!aspect-square" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/parts/${part.partId}?vehicleId=${myVehicleId}`}
                          className="text-sm font-medium text-ridefit-text hover:underline"
                        >
                          {part.name}
                        </Link>
                        <p className="text-xs text-ridefit-text-secondary">
                          {part.price != null ? `${part.price.toLocaleString()}원` : '가격 정보 없음'} · {part.status}
                        </p>
                        {formatFitmentYears(part.sameModelFitments) && (
                          <p className="text-[11px] text-ridefit-text-secondary" data-testid={`fit-years-${part.partId}`}>
                            적용: {formatFitmentYears(part.sameModelFitments)}
                          </p>
                        )}
                        {part.stats?.ratingCount > 0 && (
                          <p className="text-xs text-ridefit-text-secondary">
                            <Ico as={Star} className="text-ridefit-warning" filled /> {part.stats.avgRating.toFixed(1)}{' '}
                            <span className="text-ridefit-text-secondary/70">({part.stats.ratingCount}개 후기)</span>
                          </p>
                        )}
                        {part.stats?.badges?.length > 0 && (
                          <div className="mt-1">
                            <PartBadges badges={part.stats.badges} />
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => togglePart(part.partId)}
                            aria-pressed={isActive}
                            data-testid={`fit-toggle-${part.partId}`}
                            className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition sm:px-3 sm:py-1.5 sm:text-xs ${
                              isActive
                                ? 'border border-ridefit-primary bg-ridefit-primary/15 text-ridefit-primary hover:bg-ridefit-primary/25'
                                : 'bg-ridefit-primary text-white hover:brightness-110'
                            }`}
                          >
                            {isActive ? <><Ico as={Check} className="mr-1" />장착 중 · 빼기</> : '장착해보기'}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSaved(part.partId)}
                            aria-pressed={isSaved}
                            title={`${vehicle.nickname || vehicle.modelYearLabel}에 ${isSaved ? '저장됨 (눌러서 해제)' : '저장'}`}
                            data-testid={`fit-save-${part.partId}`}
                            className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition sm:px-3 sm:py-1.5 sm:text-xs ${
                              isSaved
                                ? 'border-ridefit-warning/60 bg-ridefit-warning/10 text-ridefit-warning'
                                : 'border-ridefit-border text-ridefit-text-secondary hover:border-ridefit-warning hover:text-ridefit-warning'
                            }`}
                          >
                            <Ico as={Heart} className="mr-1" filled={isSaved} />{isSaved ? '저장됨' : '저장하기'}
                          </button>
                        </div>
                      </div>
                    </div>
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
                {activeParts.reduce((sum, p) => sum + (p.price ?? 0), 0).toLocaleString()}원
                {activeParts.some((p) => p.price == null) && (
                  <span className="ml-1 text-xs font-normal text-ridefit-text-secondary">(가격 정보 없는 부품 {activeParts.filter((p) => p.price == null).length}개 제외)</span>
                )}
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
