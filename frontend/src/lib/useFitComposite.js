import { useCallback, useEffect, useRef, useState } from 'react'
import { getFitLayout, getPartLayerKind } from '../constants/vehicleFitPositions'
import { MAX_COMPOSITE_PARTS, planFitComposite, renderFitComposite, uploadFitComposite } from './fitComposite'

// 부품 id 목록 -> 순서와 무관한 비교 키("3,12,79"). 선택한 부품과 입혀보기 결과에 들어간 부품이 같은지 비교할 때 쓴다.
export const partKeyOf = (ids) => [...ids].map(Number).sort((a, b) => a - b).join(',')

const REASON_TEXT = {
  'no-parts': '오른쪽 목록에서 부품을 먼저 선택해 주세요.',
  'no-layout': '이 차량 사진은 2D 입혀보기를 아직 지원하지 않아요(현재 Super Cub 110 대표 사진만 지원). 차량 위에는 부착 위치만 표시돼요.',
  'no-image': '선택한 부품은 이 차량 사진에 입힐 장착 이미지가 없어 입혀보기를 아직 지원하지 않아요. 차량 위에는 부착 위치만 표시돼요.',
  'too-many': `한 번에 ${MAX_COMPOSITE_PARTS}개 부품까지 입혀볼 수 있어요. 몇 개를 빼고 다시 입혀봐 주세요.`,
}

const preload = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('저장된 이미지 파일을 불러오지 못했어요. 파일이 삭제됐거나 서버에 연결할 수 없어요.'))
    img.src = src
  })

// FitRoom [입혀보기] / [저장하기] / 저장 결과 불러오기 상태.
//  - 선택(activeParts)과 입혀보기 결과(result)는 따로 있다. 부품을 고르는 것만으로는 이미지가 바뀌지 않고, [입혀보기]를 눌러야
//    지금 선택한 부품이 차량 사진에 그려진 PNG(lib/fitComposite renderFitComposite, AI 없음)가 만들어진다.
//  - 결과에는 "어떤 선택으로 만들었는지"(selectionKey)가 함께 남는다. 선택이 바뀌면 stale = true가 되어 화면이
//    "이전 선택 기준 결과"로 표시한다(새 선택이 반영된 것처럼 보이지 않게). 선택을 되돌리면 다시 최신이 된다.
//  - [저장하기]는 화면에 보인 그 PNG(blob)를 그대로 올린다 - 결과 이미지와 저장된 부품 목록이 항상 같다.
// result: null | { kind: 'new'|'saved'|'ai', status: 'running'|'done'|'error', selectionKey, partIds, title, imageUrl, blob?, id?, approx?, error? }
export function useFitComposite({ vehicle, myVehicleId, activeParts, onSaved }) {
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState(null) // { kind: 'error' | 'info', text }
  // 진행 중인 합성/불러오기 번호 - 더 최근 요청이 시작됐거나 초기화되면 늦게 끝난 이전 작업 결과를 버린다(연속 클릭 대비).
  const runRef = useRef(0)
  const busyRef = useRef(false)
  // 지금 결과가 쓰는 blob URL(새로 합성한 결과만). 바뀌거나 화면을 떠나면 해제한다.
  const objectUrlRef = useRef(null)

  const releaseObjectUrl = () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
  }
  useEffect(() => releaseObjectUrl, [])

  const layout = getFitLayout(vehicle)
  const selectionKey = partKeyOf(activeParts.map((p) => p.partId))
  const plan = planFitComposite(vehicle, activeParts)
  const approxIds = new Set(plan.included.filter((p) => ['photo', 'illustration'].includes(getPartLayerKind(p, layout))).map((p) => p.partId))
  const stale = !!result && result.selectionKey !== selectionKey
  const running = result?.status === 'running'
  const upToDate = !!result && result.status === 'done' && !stale

  const clear = useCallback(() => {
    runRef.current += 1
    busyRef.current = false
    releaseObjectUrl()
    setResult(null)
    setNote(null)
  }, [])

  // 다른 차량으로 바뀌면 이전 차량의 입혀보기 결과를 보여주지 않는다.
  useEffect(() => clear, [myVehicleId, clear])

  const compose = async () => {
    if (busyRef.current) return
    if (plan.reason) {
      setNote({ kind: 'error', text: REASON_TEXT[plan.reason] })
      return
    }
    busyRef.current = true
    const run = ++runRef.current
    const parts = plan.included
    const base = {
      kind: 'new',
      selectionKey,
      partIds: parts.map((p) => p.partId).sort((a, b) => a - b),
      title: parts.map((p) => p.name).join(' + '),
      excludedNames: plan.excluded.map((p) => p.name),
      approx: parts.some((p) => approxIds.has(p.partId)),
    }
    setNote(null)
    // 새 합성이 끝나기 전까지 이전 결과 이미지는 그대로 두되 "합성 중"으로 덮는다(완료처럼 보이지 않게 status가 running).
    setResult((prev) => ({ ...base, status: 'running', imageUrl: prev?.status === 'done' ? prev.imageUrl : null }))
    try {
      const blob = await renderFitComposite(vehicle, parts)
      if (run !== runRef.current) return
      releaseObjectUrl()
      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url
      setResult({ ...base, status: 'done', blob, imageUrl: url })
    } catch (err) {
      if (run !== runRef.current) return
      setResult({ ...base, status: 'error', imageUrl: null, error: err.message || '입혀보지 못했어요.' })
    } finally {
      if (run === runRef.current) busyRef.current = false
    }
  }

  // 저장된 결과 열기(내 저장 목록/내 차고 ?result=). 새로 합성하지 않고 서버에 저장된 이미지를 그대로 보여준다.
  // selectionIds = 이 결과를 열면서 켠 부품(지금도 호환 후보인 것만). 이미지가 실제로 열리는지 확인한 뒤에 완료로 표시한다.
  const openSaved = async (saved, selectionIds) => {
    const run = ++runRef.current
    busyRef.current = false
    releaseObjectUrl()
    const base = {
      // 서버 model: 'direct-composite' = 2D 합성 저장(AI 없음), 그 밖 = 예전 AI 생성 결과
      kind: saved.model === 'direct-composite' ? 'saved' : 'ai',
      id: saved.id,
      selectionKey: partKeyOf(selectionIds),
      partIds: [...saved.partIds].sort((a, b) => a - b),
      title: saved.partNames.join(' + '),
      imageUrl: saved.imageUrl,
      createdAt: saved.createdAt,
    }
    setNote(null)
    setResult({ ...base, status: 'running' })
    try {
      await preload(saved.imageUrl)
      if (run === runRef.current) setResult({ ...base, status: 'done' })
    } catch (err) {
      if (run === runRef.current) setResult({ ...base, status: 'error', imageUrl: null, error: err.message })
    }
  }

  // AI 패널(장착한 모습 만들기)이 돌려준 결과. 2D 합성과 구분해 'ai'로 표시한다.
  const showAiResult = ({ imageUrl, title, partIds, cached }) => {
    runRef.current += 1
    busyRef.current = false
    releaseObjectUrl()
    setNote(null)
    setResult({ kind: 'ai', status: 'done', selectionKey, partIds: partIds ?? [], title, imageUrl, cached })
  }

  const save = async () => {
    if (!upToDate || result.kind !== 'new' || saving) return
    setSaving(true)
    setNote(null)
    const target = result
    try {
      const parts = activeParts.filter((p) => target.partIds.includes(p.partId))
      const res = await uploadFitComposite(myVehicleId, parts, target.blob)
      // 저장 중에 다시 합성/초기화했다면 화면은 그대로 두고 목록만 새로 고친다.
      setResult((cur) => {
        if (cur !== target) return cur
        releaseObjectUrl()
        return { ...target, kind: 'saved', blob: null, id: res.id, imageUrl: res.imageUrl, createdAt: res.createdAt }
      })
      setNote(
        res.cached
          ? { kind: 'info', text: '같은 부품 조합으로 이미 저장한 결과가 있어서 그 결과를 열었어요(새로 저장하지 않음).' }
          : { kind: 'info', text: '내 저장 목록과 내 차고에 저장했어요.' },
      )
      onSaved?.(res)
    } catch (err) {
      setNote({ kind: 'error', text: `저장하지 못했어요. ${(err.message ?? '').replace(/AI\s?/g, '')}`.trim() })
    } finally {
      setSaving(false)
    }
  }

  return {
    result,
    plan,
    approxIds,
    reasonText: plan.reason ? REASON_TEXT[plan.reason] : null,
    stale,
    running,
    upToDate,
    canCompose: !plan.reason && !running,
    canSave: upToDate && result.kind === 'new' && !saving,
    saving,
    note,
    compose,
    save,
    openSaved,
    showAiResult,
    clear,
  }
}
