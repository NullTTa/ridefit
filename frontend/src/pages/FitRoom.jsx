import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ArrowUp, Bookmark, Check, ChevronDown, Heart, Redo2, Search, Star, Trash2, Undo2, X } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import AiFitPanel from '../components/AiFitPanel'
import FitSavedList, { FitComposeBar, FitComposeDock, FitTryButton } from '../components/FitSavePanel'
import FitResultStage from '../components/FitResultStage'
import { FitEquippedPanel, FitFavoritesPanel } from '../components/FitSidePanels'
import CategoryMenu from '../components/CategoryMenu'
import ConfirmDialog from '../components/ConfirmDialog'
import { Ico } from '../components/Icon'
import { ImageLightbox, Lightbox } from '../components/Lightbox'
import PartBadges from '../components/PartBadges'
import ProductImage from '../components/ProductImage'
import Vehicle360Viewer from '../components/Vehicle360Viewer'
import VehicleFitStage from '../components/VehicleFitStage'
import VehicleYearBadge, { ModelImageNotice } from '../components/VehicleYearBadge'
import { getVehicle360Frames, getVehicle360StartIndex } from '../constants/vehicle360'
import { get360PartLayerInfo } from '../constants/vehicle360Parts'
import { groupCategories, groupLabelOf } from '../constants/partCategoryGroups'
import { HERO_BUILD } from '../constants/heroBuild'
import { getFitLayout, getPartLayerKind, getStageScale, getVehicleStageAspectRatio } from '../constants/vehicleFitPositions'
import { api } from '../lib/api'
import { josa } from '../lib/korean'
import { deleteFitPreset, listFitPresets, loadFitBuild, saveFitBuild, saveFitPreset, toggleFitBuildPart } from '../lib/fitBuild'
import { formatFitmentYears } from '../lib/fitment'
import { useFitComposite } from '../lib/useFitComposite'
import { containWheel, LG_QUERY, padForSticky } from '../lib/fitScroll'
import { COMPAT_TEXT, compatDisplay } from '../lib/compatStatus'

// 검색용 정규화: 대소문자/띄어쓰기 무시("사이드 백" = "사이드백").
const normText = (s) => (s ?? '').toLowerCase().replace(/\s+/g, '')

const STATUS_STYLE = {
  호환가능: 'border-ridefit-success-border bg-ridefit-success-bg text-ridefit-success',
  브라켓필요: 'border-ridefit-warning-border bg-ridefit-warning-bg text-ridefit-warning',
  // 호환 근거 미확인(호환가능 + 근거 메모 없음) - 장착 중이어도 근거 있는 호환과 같은 초록으로 보이지 않게
  unverified: 'border-ridefit-primary bg-ridefit-primary/10',
}

// 부품 카드의 "장착하면 차량 위에 그려지는 것" 안내(getPartLayerKind 값별)
const LAYER_KIND_TEXT = {
  layer: '장착 이미지 있음 · [입혀보기]하면 차량 이미지에 그려져요',
  photo: '간이 미리보기 · 상품 사진을 장착 자리에 겹친 근사치예요(실제 장착 모습과 다를 수 있어요)',
  illustration: '간이 일러스트 · 상품 사진이 없어 단순한 그림으로 표시돼요(실제 제품 모습 아님)',
  pin: '장착 이미지 없음 · 입혀보기 이미지에서 빠지고 부착 위치만 표시돼요',
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
  // 부품 선택 변경 실행 취소/다시 실행 - 이미지 자체가 아니라 "어떤 부품이 켜져 있었는지"의 이력만 쌓는다
  // (가볍고 안전함). 사용자가 직접 켜고 끈 토글만 쌓인다 - URL로 들어온 초기 선택/구성 불러오기는 그 전
  // 상태를 "되돌릴 지점"으로 한 번 쌓지만, 페이지 첫 진입 자체는 쌓지 않는다. 최대 50단계.
  const [history, setHistory] = useState({ past: [], future: [] })
  // "저장한 구성"(이름 붙여 여러 개 저장, lib/fitBuild) - 이 차량의 저장된 구성 목록.
  const [presets, setPresets] = useState([])
  const [presetName, setPresetName] = useState('')
  const [presetToDelete, setPresetToDelete] = useState(null)
  // 구성을 불러왔는데 그중 일부가 지금은 호환 후보가 아니어서 뺐을 때의 안내: { name, skipped } | null
  const [presetNotice, setPresetNotice] = useState(null)
  const [conflicts, setConflicts] = useState([])
  const [checkingConflicts, setCheckingConflicts] = useState(false)
  // 왼쪽 보기: 'fit' = 2D 합성(결과 이미지 또는 원본), '360' = 360° 보기
  const [viewMode, setViewMode] = useState('fit')
  // 원본/입혀보기 결과 비교: 'after' = 입혀보기 결과, 'before' = 부품 없는 원본 차량. 입혀보기 결과가 있을 때만 보인다.
  const [compare, setCompare] = useState('after')
  // 이 차량으로 만든 장착 결과 전체(서버에 저장된 것, 최신순). 만들 때마다 늘어나고 지워지지 않는다.
  const [savedResults, setSavedResults] = useState([])
  // 저장된 장착 모습 개별 삭제(입혀보기 결과 이미지만 - 부품 저장/장착해보기 선택과는 무관)
  const [resultToDelete, setResultToDelete] = useState(null)
  // 저장 결과를 불러왔는데 그때 장착했던 부품 중 지금은 호환 후보가 아닌 것이 있으면 알린다.
  const [restoreNotice, setRestoreNotice] = useState(null)
  const [deletingResult, setDeletingResult] = useState(false)
  const [resultDeleteError, setResultDeleteError] = useState('')
  const [aiCheckKey, setAiCheckKey] = useState(0)
  // "크게 보기"(전체 화면)로 연 입혀보기 결과. null이면 닫힘.
  const [zoomed, setZoomed] = useState(null)
  // 모바일/태블릿: 차량 무대가 화면에 보이는지(안 보이면 화면 아래 [입혀보기] 바를 띄운다)
  const stageRef = useRef(null)
  const [stageInView, setStageInView] = useState(true)
  // 위치 미리보기 크게 보기(원본 이미지들을 큰 무대에 다시 배치 - 작은 화면을 늘리는 것이 아님)
  const [stageZoom, setStageZoom] = useState(false)
  // 목록 카테고리 필터(null = 전체). 장착 상태와 무관 - 다른 카테고리에서 장착한 부품은 그대로 장착돼 있다.
  const [categoryFilter, setCategoryFilter] = useState(null)
  // 대분류(큰 묶음, PartsSearch와 같은 기준) - 소분류 선택과 별개로, 카테고리를 한 단계 더 좁혀 보여준다.
  const [categoryGroup, setCategoryGroup] = useState(null)
  // true면 "이 차량에 저장한 부품"만 목록에 보인다(장착 상태와 무관).
  const [savedOnly, setSavedOnly] = useState(false)
  // 이 차량에 저장한(즐겨찾기) 부품 id. "장착해보기"와는 별개의 행동이다(하나를 눌러도 다른 쪽은 바뀌지 않음).
  const [savedPartIds, setSavedPartIds] = useState(new Set())
  // 즐겨찾기 API 응답 그대로(부품 이름/사진) - 이 차량 호환 후보에 없는 즐겨찾기도 왼쪽 패널에 이유와 함께 보여주려고 둔다.
  const [favoriteRows, setFavoriteRows] = useState([])
  // 즐겨찾기 추가/해제가 서버에서 실패하면 화면을 되돌리고 이유를 보여준다(예전에는 조용히 되돌아가 눌러도 안 되는 것처럼 보였다).
  const [favoriteError, setFavoriteError] = useState(null)
  // 오른쪽 목록 검색어(부품명/카테고리). 장착 상태와 무관.
  const [query, setQuery] = useState('')
  // 오른쪽 목록 [맨 위로] 버튼 표시 여부
  const [showTop, setShowTop] = useState(false)
  const partsPaneRef = useRef(null)
  // 오른쪽 목록 박스 ref: 휠 처리(containWheel) + [맨 위로]가 이 박스를 스크롤하도록 기억한다. 렌더마다 다시 붙지 않게 고정.
  const attachPartsPane = useCallback((el) => {
    partsPaneRef.current = el
    return containWheel(el)
  }, [])

  useEffect(() => {
    setSavedPartIds(new Set())
    setFavoriteRows([])
    api
      .get(`/api/me/favorites?myVehicleId=${myVehicleId}`)
      .then((data) => {
        setFavoriteRows(data)
        setSavedPartIds(new Set(data.map((f) => f.partId)))
      })
      .catch(() => {})
  }, [myVehicleId])

  // 모바일/태블릿(~lg)은 목록이 페이지와 함께 스크롤되므로, 목록 시작이 화면 위로 충분히 지나가면 [맨 위로]를 보여준다(lg는 목록 박스 onScroll).
  useEffect(() => {
    const onScroll = () => {
      const el = partsPaneRef.current
      if (!el || window.matchMedia(LG_QUERY).matches) return
      const r = el.getBoundingClientRect()
      setShowTop(r.top < -300 && r.bottom > window.innerHeight * 0.5)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // 차량이 바뀌면 실행 취소 이력은 그 차량에서만 의미가 있으므로 비우고, 저장한 구성 목록은 새로 불러온다.
  useEffect(() => {
    setHistory({ past: [], future: [] })
    setPresets(listFitPresets(myVehicleId))
    setPresetName('')
    setCompare('after')
  }, [myVehicleId])

  const toggleSaved = (partId) => {
    const saved = savedPartIds.has(partId)
    const flip = (prev) => {
      const next = new Set(prev)
      if (saved) next.delete(partId)
      else next.add(partId)
      return next
    }
    setSavedPartIds(flip)
    setFavoriteError(null)
    ;(saved
      ? api.del(`/api/me/favorites/${partId}?myVehicleId=${myVehicleId}`)
      : api.post('/api/me/favorites', { partId, myVehicleId: Number(myVehicleId) })
    ).catch((err) => {
      setFavoriteError({ partId, text: `즐겨찾기를 ${saved ? '해제' : '추가'}하지 못했어요. ${err.message ?? ''}`.trim() })
      setSavedPartIds((prev) => {
        const next = new Set(prev)
        if (saved) next.add(partId)
        else next.delete(partId)
        return next
      })
    })
  }

  const loadSavedResults = useCallback(
    () =>
      api
        .get(`/api/ai-fit/results?myVehicleId=${myVehicleId}`)
        .then((data) => {
          setSavedResults(data)
          return data
        })
        .catch(() => {
          setSavedResults([])
          return []
        }),
    [myVehicleId],
  )

  const confirmDeleteResult = async () => {
    const target = resultToDelete
    if (!target) return
    setDeletingResult(true)
    setResultDeleteError('')
    try {
      await api.del(`/api/ai-fit/results/${target.id}`)
      setSavedResults((prev) => prev.filter((r) => r.id !== target.id))
      // 지금 왼쪽에 보이던 결과를 지웠으면 결과를 비운다(선택한 부품은 그대로 - 다시 합성할 수 있다). AI 패널은 캐시 상태를 다시 확인한다.
      if (fit.result?.id === target.id) fit.clear()
      setAiCheckKey((k) => k + 1)
    } catch (err) {
      setResultDeleteError(err.message || '삭제하지 못했어요.')
    } finally {
      setDeletingResult(false)
      setResultToDelete(null)
    }
  }

  // ?result=<id>(내 차고의 "저장된 장착 모습"에서 들어온 경우): 이 차량의 저장 결과 중 그 결과를 바로 보여준다 - 목록에서 누른 것과 같이
  // 이미지 + 그때 장착했던 부품을 함께 복원한다(restoreSaved). 부품 후보(호환 목록)를 불러온 뒤에 해야 해서 loading이 끝나면 부른다.
  // 이 차량 결과 목록에 없는 id는 무시한다(다른 차량 결과를 URL로 열 수 없다). 새로 생성하지 않는다.
  const requestedResultId = searchParams.get('result')

  useEffect(() => {
    if (loading) return
    loadSavedResults().then((data) => {
      const r = requestedResultId && data.find((x) => String(x.id) === requestedResultId)
      if (r) restoreSaved(r)
    })
    // restoreSaved는 부품 후보를 불러온 이 시점의 상태로 한 번만 부른다(함수가 매 렌더 새로 만들어져 의존성에 넣지 않는다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadSavedResults, requestedResultId])

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
  // 카테고리 2단 필터 표시용(PartsSearch와 같은 묶음): [대분류, 그 안에 실제로 있는 소분류들].
  const groupedCategories = useMemo(() => groupCategories(categories.map(([c]) => c)), [categories])
  const categoryCounts = useMemo(() => new Map(categories.map(([c, ps]) => [c, ps.length])), [categories])

  // 장착하면 차량 위에 무엇이 그려지는지(부품별) - 위치 미리보기·저장 이미지와 같은 기준(getPartLayerKind = getPartOverlays).
  // 'layer' 검증한 장착 레이어 / 'photo' 상품 사진 기반 간이 미리보기 / 'illustration' 간이 일러스트 / 없음 = 부착 위치 배지만.
  // 카드에서 미리 구분해 알려 준다(간이 미리보기를 실제 장착 모습으로 오해하지 않게).
  const layerKindById = useMemo(() => {
    const layout = vehicle ? getFitLayout(vehicle) : null
    return new Map(parts.map((p) => [p.partId, layout ? getPartLayerKind(p, layout) : null]))
  }, [vehicle, parts])
  const activeParts = useMemo(() => parts.filter((p) => activePartIds.has(p.partId)), [parts, activePartIds])
  // [입혀보기]/[저장하기]/저장 결과 불러오기 - 선택(activePartIds)과 입혀보기 결과를 따로 관리한다(lib/useFitComposite).
  // 저장하면 목록을 다시 읽는다(왼쪽 결과는 그대로 "저장된 결과"로 바뀐다).
  const fit = useFitComposite({ vehicle, myVehicleId, activeParts, onSaved: () => loadSavedResults() })
  const resultDone = fit.result?.status === 'done'
  // [원본] 비교: 입혀보기 결과가 있을 때만 의미가 있다.
  const showBefore = compare === 'before' && resultDone
  // 입혀보기 결과에 들어간 부품(360°도 이 부품들로 그린다 - 2D 결과와 360°가 서로 다른 상태를 보여주지 않게).
  const resultParts = resultDone ? parts.filter((p) => fit.result.partIds.includes(p.partId)) : []
  const stageParts = showBefore ? [] : resultParts
  const vehicle360Frames = getVehicle360Frames(vehicle)
  // 360 보기: 합성한 부품 중 8개 각도 레이어가 완성된 것만 레이어로 겹치고, 나머지는 "360° 장착 이미지 준비 중"으로 알린다.
  const layers360 = vehicle360Frames
    ? stageParts
        .map((p) => ({ key: p.partId, ...get360PartLayerInfo(vehicle.modelImageUrl, p.name, vehicle360Frames.length, stageParts.map((x) => x.name)) }))
        .filter((l) => l.frames)
    : []
  const pending360 = vehicle360Frames && !showBefore ? stageParts.filter((p) => !layers360.some((l) => l.key === p.partId)) : []

  // 모바일/태블릿: 차량 무대가 화면 밖이면(부품 목록을 내려 고르는 중) 화면 아래 [입혀보기] 바를 띄운다.
  useEffect(() => {
    const el = stageRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(([entry]) => setStageInView(entry.isIntersecting), { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [loading])
  const composeAndShow = () => {
    if (!fit.upToDate) fit.compose()
    setViewMode('fit')
    setCompare('after')
    const el = stageRef.current
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' })
  }

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
  // 이 규칙(toggleFitBuildPart)은 PartsSearch(부품 찾아보기)도 똑같이 쓴다 - 어느 화면에서 켜고 꺼도 같게 동작한다.
  // 선택을 바꿀 때 공통: 선택만 바뀌고 입혀보기 결과 이미지는 그대로다 - 결과가 지금 선택과 다르면 왼쪽에 "이전 선택 기준"으로 표시되고
  // [다시 입혀보기]를 눌러야 반영된다(useFitComposite stale). 선택을 되돌려 결과와 같아지면 다시 최신 결과로 보인다.
  const applyActive = (next) => {
    setActivePartIds(next)
    saveFitBuild(myVehicleId, next)
    checkConflicts(next)
    setCompare('after')
    setRestoreNotice(null)
  }

  // [초기화]: 선택한 부품을 모두 빼고 입혀보기 결과를 지운다(실행 취소로 선택은 되돌릴 수 있음). 저장된 결과는 지우지 않는다.
  const resetAll = () => {
    if (activePartIds.size > 0) setHistory((h) => ({ past: [...h.past, activePartIds].slice(-50), future: [] }))
    setReplaced(null)
    applyActive(new Set())
    fit.clear()
  }

  const togglePart = (partId) => {
    const { next, turningOn, replaced: r } = toggleFitBuildPart(activePartIds, partId, parts)
    // 실행 취소 이력에 "바뀌기 전" 상태를 쌓는다 - 직접 토글할 때만(초기 선택/구성 불러오기는 각자 따로 처리).
    setHistory((h) => ({ past: [...h.past, activePartIds].slice(-50), future: [] }))
    setReplaced(r)
    applyActive(next)
    if (turningOn) {
      // 실제 "장착 시도" 신호 - 인기상품 계산에 쓰인다.
      api.post(`/api/parts/${partId}/fit-selections`).catch(() => {})
    }
  }

  // 실행 취소/다시 실행 - 부품 선택 "상태"만 되돌린다(이미지를 따로 저장해두지 않고, 그 상태의 활성 부품
  // id만으로 위치 미리보기/360/장착 모습 패널이 전부 다시 그려진다 - 3단계의 "항상 재구성" 원칙과 같다).
  const undo = () => {
    if (history.past.length === 0) return
    const prev = history.past[history.past.length - 1]
    setHistory({ past: history.past.slice(0, -1), future: [activePartIds, ...history.future].slice(0, 50) })
    setReplaced(null)
    applyActive(prev)
  }
  const redo = () => {
    if (history.future.length === 0) return
    const next = history.future[0]
    setHistory({ past: [...history.past, activePartIds].slice(-50), future: history.future.slice(1) })
    setReplaced(null)
    applyActive(next)
  }

  // "저장한 구성" - 지금 장착 중인 부품을 이름 붙여 저장/불러오기/삭제한다(이 브라우저에만 저장, lib/fitBuild).
  const handleSavePreset = () => {
    const saved = saveFitPreset(myVehicleId, presetName, activePartIds)
    if (!saved) return
    setPresets(listFitPresets(myVehicleId))
    setPresetName('')
  }
  // 저장했던 부품 중 지금도 호환 후보에 있는 것만 불러온다(그사이 호환성이 바뀌었을 수 있다) - 빠진 게 있으면 알려준다.
  const handleLoadPreset = (preset) => {
    const valid = preset.partIds.filter((id) => parts.some((p) => p.partId === id))
    setHistory((h) => ({ past: [...h.past, activePartIds].slice(-50), future: [] }))
    setReplaced(null)
    applyActive(new Set(valid))
    setPresetNotice(
      valid.length < preset.partIds.length
        ? { name: preset.name, skipped: preset.partIds.length - valid.length }
        : null,
    )
  }
  // 저장 결과 불러오기(내 저장 목록 클릭 / 내 차고에서 ?result=로 열기): 그 이미지와 저장할 때 장착했던 부품을 함께 복원한다 -
  // 이미지만 바뀌고 장착 체크 상태는 그대로인 일이 없게. 부품 상태는 구성 불러오기와 같은 경로(실행 취소 이력 + 현재 구성 저장)로 바꾼다.
  // 지금도 이 차량의 호환 후보인 부품만 켠다(빠진 게 있으면 알린다). 저장 결과의 partIds = 그 이미지에 실제로 들어간 부품.
  const restoreSaved = (r) => {
    // 다른 차량에서 저장한 결과는 이 차량에 적용하지 않는다(차량 id가 없는 예전 결과는 서버가 같은 회원·같은 차종 것만 준다).
    if (r.myVehicleId != null && String(r.myVehicleId) !== String(myVehicleId)) {
      setRestoreNotice({ wrongVehicle: true })
      return
    }
    const valid = r.partIds.filter((id) => parts.some((p) => p.partId === id))
    const next = new Set(valid)
    const same = next.size === activePartIds.size && valid.every((id) => activePartIds.has(id))
    if (!same) {
      setHistory((h) => ({ past: [...h.past, activePartIds].slice(-50), future: [] }))
      setReplaced(null)
      applyActive(next)
    }
    setRestoreNotice(valid.length < r.partIds.length ? { skipped: r.partIds.length - valid.length } : null)
    fit.openSaved(r, valid)
    setCompare('after')
    setViewMode('fit')
  }

  const confirmDeletePreset = () => {
    if (!presetToDelete) return
    deleteFitPreset(myVehicleId, presetToDelete.id)
    setPresets(listFitPresets(myVehicleId))
    setPresetToDelete(null)
  }

  // ---- 오른쪽 목록에 보일 부품: 검색어가 있으면 카테고리 선택과 상관없이 전체에서(부품명/카테고리/대분류 이름), 없으면 고른 대분류·소분류만.
  // "저장한 부품만"은 둘 다에 겹쳐 적용한다. 장착 상태(activePartIds)는 건드리지 않는다.
  const qn = normText(query)
  const visibleCategories = categories
    .filter(
      ([category]) =>
        qn ||
        ((categoryFilter === null || category === categoryFilter) &&
          (categoryFilter !== null || categoryGroup === null || groupLabelOf(category) === categoryGroup)),
    )
    .map(([category, allParts]) => [
      category,
      allParts.filter(
        (p) =>
          (!savedOnly || savedPartIds.has(p.partId)) &&
          (!qn || normText(p.name).includes(qn) || normText(category).includes(qn) || normText(groupLabelOf(category)).includes(qn)),
      ),
    ])
    .filter(([, categoryParts]) => categoryParts.length > 0)
  const visibleCount = visibleCategories.reduce((n, [, ps]) => n + ps.length, 0)
  // 검색어가 카테고리 이름과 맞으면 그 카테고리로 바로 가는 버튼을 보여준다.
  const matchedCategories = qn ? categories.map(([c]) => c).filter((c) => normText(c).includes(qn)) : []
  // 왼쪽 즐겨찾기 카드: 즐겨찾기 순서대로, 이 차량 호환 후보면 장착 가능(장착 상태는 activePartIds 그대로).
  const favoriteItems = [...savedPartIds]
    .map((id) => {
      const part = parts.find((p) => p.partId === id)
      const info = part ?? favoriteRows.find((r) => r.partId === id)
      return info && { partId: id, name: info.name, imageUrl: info.imageUrl, category: info.category, compatible: !!part, active: activePartIds.has(id) }
    })
    .filter(Boolean)

  // 오른쪽 목록을 맨 위로: 데스크톱은 목록 박스만(페이지는 그대로), 모바일은 목록 시작 위치로 페이지를 올린다(헤더 높이만큼 띄움).
  const scrollPartsTop = (behavior = 'smooth') => {
    const el = partsPaneRef.current
    if (!el) return
    if (window.matchMedia(LG_QUERY).matches) {
      if (el.scrollTop > 0) el.scrollTo({ top: 0, behavior })
    } else if (behavior === 'smooth') {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior })
    }
  }
  // 카테고리 고르기(빠른 카테고리/전체 카테고리 메뉴/검색 결과의 카테고리 버튼): 검색어는 비우고 목록을 처음부터 보여준다.
  const selectCategory = (group, category) => {
    setCategoryGroup(group)
    setCategoryFilter(category)
    setQuery('')
    scrollPartsTop('auto')
  }
  // [내 목록 ↓]: 내 저장 목록(있으면 첫 항목)이 고정된 미리보기 바로 아래 오게 한다. scrollIntoView는 페이지까지 함께 움직여
  // 차량이 밀려 올라가므로 쓰지 않고, 데스크톱은 왼쪽 카드만, 모바일은 페이지를 헤더 높이만큼 띄워 스크롤한다.
  const jumpToSavedList = () => {
    const list = document.querySelector('[data-testid=ai-fit-history]')
    if (!list) return
    const target = list.querySelector('[data-testid=fit-saved-results] li') ?? list
    const pane = list.closest('[data-testid=fit-preview-pane]')
    if (pane && window.matchMedia(LG_QUERY).matches) {
      const pad = parseFloat(pane.style.scrollPaddingTop) || 0
      pane.scrollTo({ top: pane.scrollTop + target.getBoundingClientRect().top - pane.getBoundingClientRect().top - pad - 4, behavior: 'smooth' })
    } else {
      window.scrollTo({ top: list.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' })
    }
  }
  const resetFilters = () => {
    setQuery('')
    setCategoryGroup(null)
    setCategoryFilter(null)
    setSavedOnly(false)
    scrollPartsTop('auto')
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
    // 데스크톱(lg~): 페이지가 헤더(h-16) 아래 화면 높이를 꽉 채우고, 왼쪽(차량 미리보기)/오른쪽(부품 목록)이 각자 안에서만 스크롤된다.
    // 예전에는 부품 목록(수천 px)이 페이지 전체를 스크롤시켜, sticky(top-6)인 왼쪽 카드가 헤더 밑으로 들어가거나 목록 끝에서 밀려 올라가 차량이 잘렸다.
    // 모바일/태블릿(~lg)은 예전처럼 위아래로 이어지는 배치 그대로.
    <div className="mx-auto max-w-5xl px-4 py-12 lg:flex lg:h-[calc(100dvh-4rem)] lg:flex-col lg:py-6" data-testid="fit-room">
      {zoomed && (
        // 전체 화면 보기: 입혀보기 결과 원본 이미지를 그대로(썸네일 아님). 기본은 원본보다 크게 늘리지 않는 화면 맞춤, 큰 원본은 1:1로도 본다.
        <ImageLightbox
          src={zoomed.imageUrl}
          alt={`${zoomed.title} 입혀보기 결과`}
          title={zoomed.title}
          onClose={() => setZoomed(null)}
          testid="ai-fit-lightbox"
        />
      )}
      {stageZoom && (
        // 원본 차량 크게 보기: 같은 원본 이미지(차량 1829px)를 큰 무대에 다시 배치한다 - 원본 픽셀보다 크게는 늘리지 않는다.
        <Lightbox
          label="차량 크게 보기"
          onClose={() => setStageZoom(false)}
          testid="fit-stage-lightbox"
          footer={<p className="w-full text-xs text-white/80">원본 차량(입혀보기 전)</p>}
        >
          <div
            className="w-full overflow-hidden rounded-lg bg-ridefit-card"
            style={{ maxWidth: `min(100%, calc((100vh - 9rem) * ${getVehicleStageAspectRatio(vehicle)}))` }}
            onClick={(e) => e.stopPropagation()}
          >
            <VehicleFitStage vehicle={vehicle} parts={[]} conflictPartIds={conflictPartIds} large />
          </div>
        </Lightbox>
      )}

      <p className="text-xs font-semibold uppercase tracking-wider text-ridefit-primary">부품 입혀보기</p>
      <h1 className="mt-1 text-2xl font-bold text-ridefit-text" data-testid="fit-vehicle-title">
        {vehicle.nickname ? `${vehicle.nickname} · ` : ''}
        {vehicle.manufacturerName} {vehicle.modelYearLabel}
      </h1>
      <p className="mb-8 mt-1 text-sm text-ridefit-text-secondary lg:mb-5">
        ① 부품 선택 → ② [입혀보기]로 차량 이미지에 적용 → ③ [저장하기]로 내 차고에 보관. 다른 자리 부품은 여러 개를 함께 고를 수 있어요.
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
          {preselect.build
            ? preselect.ok
              ? `홈에서 본 구성 중 이 차량에 호환되는 부품(${preselect.name})을 선택한 상태로 열었어요. [입혀보기]를 누르면 차량 이미지에 적용돼요.`
              : `홈에서 본 구성은 ${josa(vehicle.nickname || vehicle.modelYearLabel, '과', '와')} 호환이 확인되지 않아 선택하지 않았어요. 부품 목록의 호환 부품을 직접 선택해 보세요.`
            : preselect.ok
            ? `${josa(`'${preselect.name}'`, '을', '를')} 선택한 상태로 열었어요. 다른 부품을 더 고른 뒤 [입혀보기]를 누르면 차량 이미지에 적용돼요.`
            : `${preselect.name ? `${josa(`'${preselect.name}'`, '은', '는')} ` : '선택한 부품은 '}${josa(
                vehicle.nickname || vehicle.modelYearLabel,
                '과',
                '와',
              )} 호환이 확인되지 않아 선택하지 않았어요(장착 가능한 부품처럼 입혀보지 않아요). 부품 상세에서 호환 차량을 확인해 주세요. 지금 선택해 둔 다른 부품은 그대로예요.`}
        </div>
      )}

      <div className="grid gap-8 lg:min-h-0 lg:flex-1 lg:grid-cols-[1.1fr_1fr] lg:gap-6">
        {/* 왼쪽: 입혀보기 결과(또는 원본 차량) / 360° + 합성 바 + 선택한 부품 + 즐겨찾기 + 내 저장 목록.
            lg: 카드 높이 = 남은 화면 높이. 카드 안에서만 스크롤되고, 보기 버튼·무대·합성 바는 카드 맨 위에 붙어(sticky) 있어
            아래 패널을 내려 봐도 차량과 [입혀보기]가 그대로 보인다. */}
        <div
          className="fit-scroll relative self-start overflow-hidden rounded-xl border border-ridefit-border bg-ridefit-card p-6 lg:h-full lg:self-auto lg:overflow-y-auto lg:overscroll-contain lg:pt-0"
          data-testid="fit-preview-pane"
          ref={containWheel}
        >
          <div className="lg:sticky lg:top-0 lg:z-10 lg:-mx-6 lg:bg-ridefit-card lg:px-6 lg:pb-3 lg:pt-6" data-testid="fit-preview-stage" ref={padForSticky}>
          {/* 보기 전환(2D 합성 / 360°) + [원본 / 입혀보기 결과] 비교를 한 줄에. 결과가 없을 때도 lg에서는 같은 높이를 비워 둔다(차량이 밀리지 않게). */}
          <div className="mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          {vehicle360Frames && (
            <div className="flex justify-center gap-2">
              {[
                ['fit', '2D 미리보기'],
                ['360', '360° 보기'],
              ].map(([mode, text]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  aria-pressed={viewMode === mode}
                  data-testid={`fit-view-${mode}`}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    viewMode === mode ? 'bg-ridefit-primary text-white' : 'bg-ridefit-bg text-ridefit-text-secondary hover:bg-ridefit-border'
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
          )}
          {resultDone ? (
            <div className="flex justify-center" data-testid="fit-compare">
              <div className="inline-flex rounded-lg border border-ridefit-border bg-ridefit-bg p-0.5" role="group" aria-label="원본과 입혀보기 결과 비교">
                {[
                  ['before', '원본'],
                  ['after', '입혀보기 결과'],
                ].map(([value, text]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCompare(value)}
                    aria-pressed={compare === value}
                    data-testid={`fit-compare-${value}`}
                    className={`rounded-md px-4 py-1.5 text-xs font-semibold transition ${
                      compare === value ? 'bg-ridefit-primary text-white' : 'text-ridefit-text-secondary hover:text-ridefit-text'
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div aria-hidden="true" className="hidden h-[34px] lg:block" />
          )}
          </div>

          {/* 2D 합성 / 360° 모두 같은 무대 폭(max-w-2xl)과 종횡비(getVehicleStageAspectRatio)를 쓴다 - 보기를 바꿔도 차량 크기가 같다.
              isolate: 무대 안의 z-index(연식 배지 z-50 등)가 스크롤 시 상단 헤더(z-50) 위로 올라오지 않게 가둔다. */}
          <div ref={stageRef} className="fit-stage-cap relative isolate mx-auto w-full max-w-2xl" style={{ '--fit-stage-ar': getVehicleStageAspectRatio(vehicle) }}>
          <VehicleYearBadge vehicle={vehicle} />
          {viewMode === '360' && vehicle360Frames ? (
            // 2D 무대와 같은 종횡비. 대표 사진과 같은 각도의 프레임부터 시작하고, 프레임별 차량 높이/바닥선을 대표 사진에 맞춘다.
            <>
              <Vehicle360Viewer
                frames={vehicle360Frames}
                alt={vehicle.nickname || vehicle.modelYearLabel}
                className="mx-auto w-full max-w-2xl"
                style={{ aspectRatio: getVehicleStageAspectRatio(vehicle) }}
                fillScale={getStageScale(vehicle)}
                startIndex={getVehicle360StartIndex(vehicle.modelImageUrl)}
                normalizeTo={vehicle.modelImageUrl}
                layers={showBefore ? [] : layers360}
                expandable
              />
              <p className="mt-2 text-center text-xs text-ridefit-text-secondary" data-testid="fit-360-status">
                {showBefore
                  ? '원본 차량(입혀보기 전)을 돌려 보고 있어요.'
                  : !resultDone
                    ? '360°에는 [입혀보기]한 부품이 반영돼요. 아직 입혀본 결과가 없어 순정 차량이 보여요.'
                    : layers360.length > 0
                      ? `360° 반영: ${stageParts.filter((p) => layers360.some((l) => l.key === p.partId)).map((p) => p.name).join(', ')}${fit.stale ? ' (이전 입혀보기 기준)' : ''}`
                      : '입혀본 부품 중 360° 각도별 이미지가 있는 부품이 없어요.'}
              </p>
            </>
          ) : (
            <FitResultStage
              vehicle={vehicle}
              fit={fit}
              selectedParts={activeParts}
              showOriginal={showBefore}
              conflictPartIds={conflictPartIds}
              onZoomResult={() => fit.result?.imageUrl && setZoomed({ imageUrl: fit.result.imageUrl, title: fit.result.title })}
              onZoomStage={() => setStageZoom(true)}
            />
          )}
          </div>

          {viewMode === '360' && pending360.length > 0 && (
            <p className="mt-3 rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2 text-center text-xs text-ridefit-text-secondary" data-testid="fit-360-pending">
              360° 장착 이미지 준비 중(360°에는 안 보임): {pending360.map((p) => p.name).join(', ')}
              <span className="mt-0.5 block">이 부품들은 [2D 미리보기] 결과에서 확인할 수 있어요.</span>
            </p>
          )}
          {replaced && (
            <p className="mt-3 rounded-lg border border-ridefit-primary/40 bg-ridefit-primary/10 px-3 py-2 text-center text-xs text-ridefit-text" data-testid="fit-replaced">
              {josa(replaced.category, '은', '는')} 한 자리에 하나만 장착돼요 - {replaced.from} 대신 {josa(replaced.to, '으로', '로')} 바꿨어요.
            </p>
          )}
          <FitComposeBar
            fit={fit}
            selectedCount={activeParts.length}
            onReset={resetAll}
            savedCount={savedResults.length}
            onJumpToList={jumpToSavedList}
          />
          </div>
          {/* 대표 사진 안내는 고정 영역 밖(데스크톱에서 고정 영역 높이를 줄인다) */}
          <ModelImageNotice vehicle={vehicle} className="mt-2" />

          {/* 선택한 부품 / 즐겨찾기 부품 - 상태는 activePartIds·savedPartIds 하나뿐이고 버튼은 오른쪽 목록과 같은 togglePart/toggleSaved를 부른다. */}

          <FitEquippedPanel
            activeParts={activeParts}
            onRemove={togglePart}
            layerKindById={layerKindById}
            resultPartIds={fit.upToDate ? fit.result.partIds : null}
            action={<FitTryButton fit={fit} onComposeAndShow={composeAndShow} testid="fit-compose-panel" />}
          />

          <FitFavoritesPanel items={favoriteItems} onToggleEquip={togglePart} onUnfavorite={toggleSaved} error={favoriteError?.text} />

          {restoreNotice && (
            <p className="mt-2 text-xs text-ridefit-warning" data-testid="fit-restore-notice">
              {restoreNotice.wrongVehicle
                ? '다른 차량에서 저장한 결과라 이 차량에서는 열 수 없어요.'
                : `저장할 때 입혀봤던 부품 중 ${restoreNotice.skipped}개는 지금은 이 차량의 호환 후보가 아니라 선택에서 뺐어요(저장된 이미지에는 남아 있어요).`}
            </p>
          )}
          {/* 내 저장 목록 - 합성 바 바로 아래. 데스크톱에서는 이 아래만 미리보기 카드 안에서 스크롤된다. */}
          <FitSavedList
            fit={fit}
            savedResults={savedResults}
            activeResultId={fit.result?.id ?? null}
            onOpen={restoreSaved}
            onDelete={setResultToDelete}
          />

          {/* 미리 준비한 장착 이미지가 없는 부품의 "장착한 모습 만들기"(AI, 버튼을 눌렀을 때만 요청). 2D 합성 부품을 고르면 이 패널은 숨는다. */}
          <AiFitPanel
            vehicle={vehicle}
            myVehicleId={myVehicleId}
            activeParts={activeParts}
            viewMode={viewMode}
            onShowBasic={() => setViewMode('fit')}
            onGenerated={loadSavedResults}
            refreshKey={aiCheckKey}
            onShowResult={(result) => {
              fit.showAiResult(result)
              setCompare('after')
              setViewMode('fit')
            }}
          />
          {resultDeleteError && (
            <p className="mt-2 text-sm text-ridefit-danger" role="alert" data-testid="ai-fit-history-delete-error">{resultDeleteError}</p>
          )}
          <ConfirmDialog
            open={!!resultToDelete}
            title="저장된 장착 모습을 삭제할까요?"
            message="이 입혀보기 결과 이미지를 삭제합니다."
            confirmLabel="삭제"
            cancelLabel="취소"
            danger
            busy={deletingResult}
            onConfirm={confirmDeleteResult}
            onCancel={() => setResultToDelete(null)}
          />
        </div>

        {/* 카테고리별 부품 토글 목록 - "이 차량에 장착 가능한(호환) 부품" 전체. [장착해보기]는 화면 안의 임시 선택일 뿐 저장되지 않는다([♡ 저장]만 차량별 즐겨찾기로 저장). */}
        {/* lg: 독립 스크롤 박스 - 마우스가 이 안에 있으면 목록만 스크롤되고, 끝에 닿아도 페이지는 움직이지 않는다(overscroll-contain). */}
        <div
          className="fit-scroll flex flex-col gap-6 lg:h-full lg:min-h-0 lg:gap-4 lg:overflow-y-auto lg:overscroll-contain lg:rounded-xl lg:border lg:border-ridefit-border lg:bg-ridefit-bg-alt lg:p-4"
          data-testid="fit-parts-pane"
          ref={attachPartsPane}
          onScroll={(e) => {
            const next = e.currentTarget.scrollTop > 400
            if (next !== showTop) setShowTop(next)
          }}
        >
          {parts.length > 0 && (
            <>
            {/* 목록 머리(제목·요약/실행 취소·카테고리 칩): lg에서는 목록 박스 맨 위에 붙어(sticky) 부품 카드를 내려도 그대로 보인다.
                설명 문구와 "저장한 구성"은 그 아래에서 목록과 함께 스크롤된다(머리 높이를 줄여 부품 카드가 보이는 높이를 확보). */}
            <div
              data-testid="fit-candidates-heading"
              ref={padForSticky}
              className="lg:sticky lg:-top-4 lg:z-10 lg:-mx-4 lg:-mt-4 lg:border-b lg:border-ridefit-border lg:bg-ridefit-bg-alt lg:px-4 lg:pb-3 lg:pt-4"
            >
              <div className="flex items-start justify-between gap-2">
              <h2 className="min-w-0 text-lg font-semibold text-ridefit-text lg:text-base">
                {/* 데스크톱은 바로 위 페이지 제목에 차량 이름이 있어 빼고 한 줄로(고정 머리 높이를 줄임) */}<span className="lg:hidden">{vehicle.nickname || vehicle.modelYearLabel}에 </span>장착 가능한 부품 ({parts.length}개)
              </h2>
              {/* 실행 취소/다시 실행 - 제목 줄 오른쪽(데스크톱은 아이콘만, 이름은 aria-label/title) */}
              <div className="flex shrink-0 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={undo}
                  disabled={history.past.length === 0}
                  aria-label="실행 취소"
                  title="방금 선택/빼기를 취소"
                  data-testid="fit-undo"
                  className="rounded-full border border-ridefit-border px-2.5 py-1 font-medium text-ridefit-text-secondary transition hover:border-ridefit-primary hover:text-ridefit-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Ico as={Undo2} className="mr-1 lg:mr-0" /><span className="lg:sr-only">실행 취소</span>
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={history.future.length === 0}
                  aria-label="다시 실행"
                  title="취소한 것을 다시 적용"
                  data-testid="fit-redo"
                  className="rounded-full border border-ridefit-border px-2.5 py-1 font-medium text-ridefit-text-secondary transition hover:border-ridefit-primary hover:text-ridefit-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Ico as={Redo2} className="mr-1 lg:mr-0" /><span className="lg:sr-only">다시 실행</span>
                </button>
              </div>
              </div>
              {/* 세 가지를 구분해서 보여준다: 호환(이 목록 전체) / 저장(♥) / 지금 입혀보는 중(✓) */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" data-testid="fit-summary">
                <span className="rounded-full border border-ridefit-border px-2.5 py-1 text-ridefit-text-secondary">호환 {parts.length}개</span>
                <span className="rounded-full border border-ridefit-primary/50 bg-ridefit-primary/10 px-2.5 py-1 font-medium text-ridefit-primary" data-testid="fit-summary-active">
                  <Ico as={Check} className="mr-1" />선택 {activePartIds.size}개
                </span>
                {/* 목록에서 고르다가 바로 입혀볼 수 있게 - 왼쪽 무대 옆 [입혀보기]와 같은 동작 */}
                <FitTryButton fit={fit} onComposeAndShow={composeAndShow} testid="fit-compose-list" />
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
              {/* 찾기: 부품명·카테고리 검색 + [전체 카테고리] 메뉴(26개 소분류를 가로로 밀지 않고 묶음별로 전부 고른다).
                  규칙: 검색어가 있으면 고른 카테고리와 상관없이 전체 부품에서 찾는다(고른 카테고리는 기억해 두었다가 검색을 지우면 다시 적용). */}
              <div className="mt-3 flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ridefit-text-secondary" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      scrollPartsTop('auto')
                    }}
                    onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
                    placeholder="부품명이나 카테고리로 찾기"
                    aria-label="부품명이나 카테고리로 찾기"
                    className="w-full rounded-lg border border-ridefit-border bg-ridefit-bg py-1.5 pl-8 pr-8 text-xs text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
                    data-testid="fit-search"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-ridefit-text-secondary transition hover:text-ridefit-text"
                      aria-label="검색어 지우기"
                      data-testid="fit-search-clear"
                    >
                      <X aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <CategoryMenu
                  groups={groupedCategories}
                  counts={categoryCounts}
                  group={categoryGroup}
                  category={categoryFilter}
                  onSelect={({ group, category }) => selectCategory(group, category)}
                />
              </div>
              {/* 빠른 카테고리 = 대분류 묶음(partCategoryGroups, 표시용 묶음 - 인기 순위가 아님). 줄바꿈해서 모두 보인다(가로 스크롤 없음). */}
              {groupedCategories.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="빠른 카테고리" data-testid="fit-quick-categories">
                  {[null, ...groupedCategories.map(([label]) => label)].map((label) => {
                    const on = !query.trim() && categoryGroup === label
                    return (
                      <button
                        key={label ?? 'all'}
                        type="button"
                        onClick={() => selectCategory(label, null)}
                        aria-pressed={on}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ridefit-primary ${
                          on ? 'bg-ridefit-primary text-white' : 'bg-ridefit-card text-ridefit-text-secondary hover:text-ridefit-text'
                        }`}
                      >
                        {label ?? '전체'}
                      </button>
                    )
                  })}
                </div>
              )}
              {favoriteError && (
                <p className="mt-2 rounded-md border border-ridefit-danger-border bg-ridefit-danger-bg px-2.5 py-1.5 text-[11px] text-ridefit-danger" role="alert" data-testid="fit-favorite-error">
                  {favoriteError.text}
                </p>
              )}
              {/* 지금 적용된 조건(검색/카테고리/저장한 부품만) + 초기화. 장착 상태는 바꾸지 않는다. */}
              {(query.trim() || categoryGroup || categoryFilter || savedOnly) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" data-testid="fit-filter-status" aria-live="polite">
                  <span className="text-ridefit-text-secondary">
                    {query.trim()
                      ? <>검색 <span className="font-semibold text-ridefit-text">‘{query.trim()}’</span> · 전체 카테고리에서 {visibleCount}개{(categoryFilter || categoryGroup) && ` (고른 ‘${categoryFilter ?? categoryGroup}’은 검색을 지우면 다시 적용)`}</>
                      : <>보는 중 <span className="font-semibold text-ridefit-text" data-testid="fit-filter-current">{categoryGroup ?? '전체'}{categoryFilter ? ` › ${categoryFilter}` : ''}</span> · {visibleCount}개</>}
                    {savedOnly && ' · 저장한 부품만'}
                  </span>
                  {matchedCategories.length > 0 && (
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="text-ridefit-text-secondary">카테고리로 보기:</span>
                      {matchedCategories.slice(0, 4).map((c) => (
                        <button key={c} type="button" onClick={() => selectCategory(groupLabelOf(c), c)} className="rounded-full border border-ridefit-primary/50 px-2 py-0.5 font-semibold text-ridefit-primary transition hover:bg-ridefit-primary/10" data-testid={`fit-search-category-${c}`}>
                          {c} {categoryCounts.get(c)}
                        </button>
                      ))}
                    </span>
                  )}
                  <button type="button" onClick={resetFilters} className="font-semibold text-ridefit-primary hover:underline" data-testid="fit-filter-reset">
                    조건 초기화
                  </button>
                </div>
              )}
            </div>
            <div>
                {/* 짧은 데스크톱 화면(높이 700px 이하)에서는 이 도움말을 숨겨 첫 부품 카드가 보이게 한다(같은 뜻이 버튼 이름/툴팁에 있음). */}
                <p className="text-xs text-ridefit-text-secondary lg:[@media(max-height:700px)]:hidden">
                  이 차량의 호환 데이터(호환가능·브라켓필요)가 있는 부품만 보여요. ‘호환 근거 미확인’ 부품은 구매 전에 판매처나 제조사에 장착 가능 여부를 확인해 주세요. [선택]한 부품은 왼쪽 [입혀보기]를 눌러야 차량 이미지에 적용돼요. 같은 자리(카테고리) 부품은 하나만 선택되고, [♡ 저장하기]한 부품은 내 차고와 왼쪽 즐겨찾기에 남아요.
                </p>
                {/* "저장한 구성" - 지금 장착 중인 조합에 이름을 붙여 저장해두고 나중에 그대로 불러온다(이 브라우저에만 저장).
                    접어 두어(기본 닫힘) 첫 부품 카드가 목록 맨 위에 바로 보이게 한다. */}
                <details className="group mt-2 rounded-lg border border-ridefit-border bg-ridefit-card" data-testid="fit-presets">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-ridefit-text focus:outline-none focus-visible:ring-2 focus-visible:ring-ridefit-primary [&::-webkit-details-marker]:hidden">
                    <span>
                      <Ico as={Bookmark} className="mr-1" />저장한 구성 ({presets.length})
                      <span className="ml-1 font-normal text-ridefit-text-secondary">· 지금 조합에 이름 붙여 저장하고 불러오기</span>
                    </span>
                    <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ridefit-text-secondary transition group-open:rotate-180" />
                  </summary>
                  <div className="px-3 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="이 조합을 이름 붙여 저장 (예: 출퇴근용)"
                      aria-label="구성 이름"
                      maxLength={40}
                      data-testid="fit-preset-name"
                      className="min-w-0 flex-1 rounded-lg border border-ridefit-border bg-ridefit-bg px-2.5 py-1.5 text-xs text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
                    />
                    <button
                      type="button"
                      onClick={handleSavePreset}
                      disabled={!presetName.trim() || activePartIds.size === 0}
                      data-testid="fit-preset-save"
                      className="shrink-0 rounded-lg bg-ridefit-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Ico as={Bookmark} className="mr-1" />현재 구성 저장
                    </button>
                  </div>
                  {presetNotice && (
                    <p className="mt-2 text-xs text-ridefit-warning" data-testid="fit-preset-notice">
                      '{presetNotice.name}' 구성을 불러왔어요 - 그중 {presetNotice.skipped}개는 지금은 호환 후보가 아니라 뺐어요.
                    </p>
                  )}
                  {presets.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {presets.map((preset) => (
                        <li
                          key={preset.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-ridefit-border bg-ridefit-bg px-2.5 py-1.5"
                          data-testid={`fit-preset-${preset.id}`}
                        >
                          <button
                            type="button"
                            onClick={() => handleLoadPreset(preset)}
                            className="wrap-name min-w-0 flex-1 text-left text-xs font-medium text-ridefit-text hover:text-ridefit-primary hover:underline"
                            title={`불러오기 · 부품 ${preset.partIds.length}개`}
                          >
                            {preset.name} <span className="text-ridefit-text-secondary">· {preset.partIds.length}개</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPresetToDelete(preset)}
                            aria-label={`${preset.name} 구성 삭제`}
                            className="shrink-0 text-ridefit-text-secondary transition hover:text-ridefit-danger"
                            data-testid={`fit-preset-delete-${preset.id}`}
                          >
                            <Ico as={Trash2} className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  </div>
                </details>
                <ConfirmDialog
                  open={!!presetToDelete}
                  title="저장한 구성을 삭제할까요?"
                  message={presetToDelete ? `'${presetToDelete.name}' 구성을 지웁니다. 지금 장착 중인 부품에는 영향이 없어요.` : undefined}
                  confirmLabel="삭제"
                  cancelLabel="취소"
                  danger
                  onConfirm={confirmDeletePreset}
                  onCancel={() => setPresetToDelete(null)}
                />
            </div>
            </>
          )}
          {parts.length === 0 && (
            <p className="text-sm text-ridefit-text-secondary">
              이 차량의 호환 데이터가 있는 부품이 아직 없어요.{' '}
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

          {/* 검색/카테고리 조건에 맞는 부품이 없을 때 - 검색을 지우거나 전체 부품으로 돌아갈 수 있게 한다(장착 상태는 그대로). */}
          {parts.length > 0 && visibleCategories.length === 0 && !(savedOnly && !parts.some((p) => savedPartIds.has(p.partId))) && (
            <div className="rounded-lg border border-dashed border-ridefit-border px-4 py-5 text-sm text-ridefit-text-secondary" data-testid="fit-search-empty">
              <p>{query.trim() ? `‘${query.trim()}’와 맞는 부품이나 카테고리가 없어요.` : '이 조건에 맞는 부품이 없어요.'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {query.trim() && (
                  <button type="button" onClick={() => setQuery('')} className="rounded-lg border border-ridefit-border px-3 py-1.5 text-xs font-semibold text-ridefit-text transition hover:border-ridefit-primary">
                    검색 지우기
                  </button>
                )}
                <button type="button" onClick={resetFilters} className="rounded-lg bg-ridefit-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110">
                  전체 부품 보기
                </button>
              </div>
            </div>
          )}

          {visibleCategories
            .map(([category, categoryParts]) => (
            <div key={category}>
              <h3 className="mb-2 text-sm font-semibold text-ridefit-text-secondary">{category}</h3>
              <div className="flex flex-col gap-2">
                {categoryParts.map((part) => {
                  const isActive = activePartIds.has(part.partId)
                  const isSaved = savedPartIds.has(part.partId)
                  const compat = compatDisplay(part.status, part.note)
                  return (
                    <div
                      key={part.partId}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition ${
                        isActive
                          ? (STATUS_STYLE[compat.key] ?? 'border-ridefit-primary bg-ridefit-primary/10')
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
                          className="wrap-name text-sm font-medium text-ridefit-text hover:underline"
                        >
                          {part.name}
                        </Link>
                        <p className="text-xs text-ridefit-text-secondary">
                          {part.price != null ? `${part.price.toLocaleString()}원` : '가격 정보 준비중'} ·{' '}
                          <span
                            className={COMPAT_TEXT[compat.key]}
                            data-testid={`fit-compat-${part.partId}`}
                            data-compat={compat.key}
                          >
                            {compat.label}
                          </span>
                        </p>
                        <p
                          className={`text-[11px] ${layerKindById.get(part.partId) === 'layer' ? 'text-ridefit-primary' : 'text-ridefit-text-secondary'}`}
                          data-testid={`fit-image-${part.partId}`}
                          data-image={layerKindById.get(part.partId) ?? 'pin'}
                        >
                          {LAYER_KIND_TEXT[layerKindById.get(part.partId) ?? 'pin']}
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
                            {isActive ? <><Ico as={Check} className="mr-1" />선택됨 · 빼기</> : '선택'}
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
                현재 조합 ({activeParts.length}개) ·{' '}
                {/* 가격이 하나도 확인되지 않았으면 "합계 0원" 대신 준비중으로(출처 없는 가격을 만들지 않는다) */}
                {activeParts.every((p) => p.price == null)
                  ? '가격 정보 준비중'
                  : `합계 ${activeParts.reduce((sum, p) => sum + (p.price ?? 0), 0).toLocaleString()}원`}
                {activeParts.some((p) => p.price == null) && activeParts.some((p) => p.price != null) && (
                  <span className="ml-1 text-xs font-normal text-ridefit-text-secondary">(가격 정보 없는 부품 {activeParts.filter((p) => p.price == null).length}개 제외)</span>
                )}
              </p>
              <p className="text-xs text-ridefit-text-secondary">
                {activeParts.map((p) => p.name).join(', ')}
              </p>
            </div>
          )}

          {/* [맨 위로] - 목록 박스 맨 아래에 붙어(sticky) 있다가, 목록을 400px 넘게 내리면 보인다(모바일은 목록 시작이 화면 위로 지나가면).
              데스크톱은 목록 박스만, 모바일은 목록 시작 위치로 올린다. 숨어 있을 때는 invisible이라 Tab으로도 가지 않는다.
              모바일은 카드의 [저장하기] 버튼을 가리지 않게 글자 없는 작은 원형으로 화면 오른쪽 여백 쪽에 둔다(이름은 aria-label). */}
          <div className={`pointer-events-none sticky -mr-3.5 -mt-4 flex justify-end lg:bottom-0 lg:mr-0 ${!stageInView ? 'bottom-20' : 'bottom-3'}`}>
            <button
              type="button"
              onClick={() => scrollPartsTop('smooth')}
              className={`pointer-events-auto inline-flex h-8 w-8 items-center justify-center gap-1 rounded-full border border-ridefit-border bg-ridefit-card/95 text-xs font-semibold lg:h-auto lg:w-auto lg:px-3 lg:py-1.5 text-ridefit-text shadow-lg backdrop-blur transition hover:border-ridefit-primary hover:text-ridefit-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ridefit-primary ${
                showTop ? '' : 'invisible'
              }`}
              aria-label="부품 목록 맨 위로"
              data-testid="fit-scroll-top"
            >
              <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /><span className="hidden lg:inline">맨 위로</span>
            </button>
          </div>
        </div>
      </div>
      {/* 모바일/태블릿: 부품 목록을 내려 차량 무대가 안 보일 때 화면 아래 [입혀보기] 바(목록 마지막 카드가 바에 가리지 않게 여백) */}
      <div aria-hidden="true" className="h-16 lg:hidden" />
      <FitComposeDock fit={fit} selectedCount={activeParts.length} visible={!stageInView} onComposeAndShow={composeAndShow} />
    </div>
  )
}

export default FitRoom
