import { useEffect, useState } from 'react'
import { getAiAnchor, getFitLayout, isDirectCompositePart } from '../constants/vehicleFitPositions'
import { api } from '../lib/api'
import SafeImage from './SafeImage'
import { displayImageUrl } from '../constants/productImages'

// "장착해보기" - 체크한 부품들을 내 차량 사진에 함께 장착한 합성 이미지 한 장을 만든다. 기존 2D 위치 미리보기와 별개.
// 준비 상태 확인(/api/ai-fit/check)은 무료(API 호출 없음)이고, 실제 생성은 버튼을 눌렀을 때만 요청한다.
// 체크한 부품 중 합성에 넣을 수 없는 부품(참조 이미지 없음/지원하지 않는 종류 등)은 이유와 함께 빼고, 나머지로 만든다.
// 화면에는 "AI"라는 말을 쓰지 않는다 - 서버가 주는 안내 문구도 여기서 사용자용 문구로 바꿔 보여준다.
const PART_REASON = {
  REFERENCE_MISSING: '장착 이미지 준비 전',
  UNSUPPORTED_CATEGORY: '이 종류는 아직 지원 전',
  USE_2D_IMAGE: '위치 미리보기로 확인',
  NOT_COMPATIBLE: '호환 확인 안 됨',
  VEHICLE_IMAGE_MISSING: '차량 사진 없음',
  TOO_MANY: '한 번에 4개까지',
}

const STATUS_TEXT = {
  READY: '선택한 부품을 함께 장착한 모습을 만들 수 있어요.',
  CACHED: '이 조합으로 만든 장착 모습이 저장되어 있어요.',
  NOT_CONFIGURED: '장착 모습 만들기가 아직 준비되지 않았어요. 위치 미리보기는 그대로 볼 수 있어요.',
  REFERENCE_MISSING: '선택한 부품은 아직 장착 모습을 지원하지 않아요. 위치 미리보기로 확인해주세요.',
  UNSUPPORTED_CATEGORY: '선택한 부품 종류는 아직 장착 모습을 지원하지 않아요. 위치 미리보기로 확인해주세요.',
  USE_2D_IMAGE: '사이드백은 위치 미리보기의 측면 장착 이미지로 확인해주세요.',
}

// 서버 문구(예: "AI 이미지를 만들지 못했어요")에서 기술 용어만 걷어낸다.
const plain = (message) => (message ?? '').replace(/AI\s?/g, '')

// 패널 안 부품 한 줄: 썸네일 + 이름 + 상태 배지 + [장착하기/장착해제].
// 버튼은 FitRoom의 togglePart(= lib/fitBuild toggleFitBuildPart, 실행 취소 이력/현재 구성 저장 포함)를 그대로 부른다 - 별도 장착 상태 없음.
function PartRow({ part, active, ok, badge, badgeActive, onToggle }) {
  return (
    <li className="flex items-center gap-2" data-testid={`ai-fit-part-${part.partId}`} data-included={ok ? 'true' : 'false'} data-active={active ? 'true' : 'false'}>
      <SafeImage
        src={displayImageUrl(part.imageUrl)}
        alt=""
        className={`h-8 w-8 shrink-0 rounded border border-ridefit-border bg-white object-contain p-0.5 ${active ? '' : 'opacity-50'}`}
        fallbackClassName="h-8 w-8 shrink-0 rounded border border-ridefit-border text-[8px] leading-tight"
        fallbackText="없음"
      />
      {/* 좁은 화면에서는 배지를 이름 아래로 내린다(한 줄에 배지+버튼까지 넣으면 이름이 몇 글자만 남았다). 이름은 자르지 않고 줄바꿈한다. */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
        <span
          className={`wrap-name min-w-0 text-xs leading-snug sm:flex-1 ${active && ok ? 'text-ridefit-text' : 'text-ridefit-text-secondary'} ${active && !ok ? 'line-through decoration-ridefit-text-secondary/50' : ''}`}
          title={part.name}
        >
          {part.name}
        </span>
        <span className={`w-fit shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeActive ? 'bg-ridefit-primary/15 text-ridefit-primary' : 'bg-ridefit-card text-ridefit-text-secondary'}`}>
          {badge}
        </span>
      </span>
      {onToggle && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggle(part.partId)
          }}
          aria-pressed={active}
          aria-label={`${part.name} ${active ? '장착해제' : '장착하기'}`}
          data-testid={`ai-fit-toggle-${part.partId}`}
          className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
            active
              ? 'border border-ridefit-border text-ridefit-text-secondary hover:border-ridefit-danger hover:text-ridefit-danger'
              : 'bg-ridefit-primary text-white hover:brightness-110'
          }`}
        >
          {active ? '장착해제' : '장착하기'}
        </button>
      )}
    </li>
  )
}

// refreshKey: 저장된 장착 모습을 삭제하는 등 서버 캐시가 바뀌었을 때 값을 바꿔 다시 확인하게 한다.
//
// 직접 합성 모드: 미리 준비한 장착 이미지가 있는 부품(vehicleFitPositions의 directComposite 배치)을 고르면 이 패널은 숨고(null),
// FitRoom의 FitSavePanel [현재 모습 저장]이 위치 미리보기와 같은 배치로 저장한다(lib/fitComposite.js, 외부 호출 없음). 이때는 생성용 상태 확인도 하지 않는다.
// 장착/해제는 FitRoom 왼쪽 "현재 장착 중" 패널과 오른쪽 부품 목록이 맡는다 - 이 패널은 "어떤 부품이 이미지에 들어가는지"만 보여준다(같은 부품을 두 번 다루지 않게).
function AiFitPanel({ vehicle, myVehicleId, activeParts, onShowResult, onShowBasic, onGenerated, viewMode, refreshKey = 0 }) {
  // 생성 가능 여부 응답은 어떤 요청(부품 조합/차량/새로고침 번호)에 대한 것인지 함께 저장한다.
  const [checkState, setCheckState] = useState({ inputsKey: null, requestKey: null, value: null })
  const [generating, setGenerating] = useState(false)
  const [errorNote, setErrorNote] = useState({ key: null, message: null })

  const layout = getFitLayout(vehicle)
  const compositeMode = activeParts.some((p) => isDirectCompositePart(p, layout))

  // 체크한 순서와 상관없이 같은 조합이면 같은 요청이 되도록 부품 id 순으로 보낸다(서버 캐시 키도 정렬 기준).
  const inputs = [...activeParts]
    .sort((a, b) => a.partId - b.partId)
    .map((p) => {
      const anchor = getAiAnchor(vehicle, p)
      return { partId: p.partId, anchorX: anchor ? Number(anchor.x.toFixed(1)) : null, anchorY: anchor ? Number(anchor.y.toFixed(1)) : null }
    })
  const inputsKey = JSON.stringify(inputs)
  const requestKey = `${inputsKey}|${myVehicleId}|${refreshKey}`
  const checkActive = inputs.length > 0 && !compositeMode
  // 같은 조합을 다시 확인하는 동안(새로고침)은 이전 결과를 유지하고, 조합이 바뀌면 새 응답 전까지 비운다.
  const check = checkActive && checkState.inputsKey === inputsKey ? checkState.value : null
  const checking = checkActive && checkState.requestKey !== requestKey
  const setCheck = (update) =>
    setCheckState((prev) => ({ ...prev, value: typeof update === 'function' ? update(prev.value) : update }))
  // 오류 안내도 같은 요청 동안만 보여준다(조합/차량이 바뀌면 사라진다).
  const error = errorNote.key === requestKey ? errorNote.message : null
  const setError = (message) => setErrorNote({ key: requestKey, message })

  useEffect(() => {
    if (!checkActive) return
    const parts = JSON.parse(inputsKey)
    const key = `${inputsKey}|${myVehicleId}|${refreshKey}`
    let cancelled = false
    const done = (value) => !cancelled && setCheckState({ inputsKey, requestKey: key, value })
    api
      .post('/api/ai-fit/check', { myVehicleId: Number(myVehicleId), parts })
      .then(done)
      .catch((err) => done({ canGenerate: false, code: 'ERROR', message: err.message, parts: [] }))
    return () => {
      cancelled = true
    }
  }, [checkActive, inputsKey, myVehicleId, refreshKey])

  const byId = new Map(activeParts.map((p) => [p.partId, p]))
  const statusById = new Map((check?.parts ?? []).map((s) => [s.partId, s]))
  const included = (check?.parts ?? []).filter((s) => s.included).map((s) => byId.get(s.partId)).filter(Boolean)
  const title = included.map((p) => p.name).join(' + ')

  const generate = async (regenerate) => {
    // partIds = 이 이미지에 실제로 들어간 부품(FitRoom이 선택과 비교해 "이전 선택 기준 결과"를 구분한다)
    const partIds = included.map((p) => p.partId)
    if (!regenerate && check?.code === 'CACHED' && check.cachedImageUrl) {
      onShowResult({ imageUrl: check.cachedImageUrl, cached: true, title, partIds })
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const res = await api.post('/api/ai-fit', {
        myVehicleId: Number(myVehicleId),
        parts: inputs.filter((i) => statusById.get(i.partId)?.included),
        regenerate,
      })
      setCheck((prev) => ({ ...prev, code: 'CACHED', canGenerate: true, cachedImageUrl: res.imageUrl, cachedAt: res.createdAt }))
      onShowResult({ imageUrl: res.imageUrl, cached: res.cached, title, partIds })
      onGenerated?.()
    } catch (err) {
      setError(plain(err.message))
    } finally {
      setGenerating(false)
    }
  }

  const ready = check?.canGenerate && !generating && !checking
  const isCached = check?.code === 'CACHED'
  // 이미지 만들기 버튼을 누를 수 없는 이유(버튼 옆에 그대로 보여준다 - 장착/해제 버튼과는 무관).
  const blockedReason = generating || ready
    ? null
    : checking
      ? '이미지에 넣을 수 있는지 확인 중이에요.'
      : check?.code === 'NOT_CONFIGURED'
        ? '이미지 만들기는 아직 준비 중이에요. 장착/해제와 입혀보기 전·후 비교는 위 미리보기에서 바로 볼 수 있어요.'
        : null

  // 미리 준비한 장착 이미지가 있는 부품(직접 합성)은 FitRoom 왼쪽의 [현재 모습 저장](FitSavePanel, lib/fitComposite saveFitComposite)이 저장한다.
  // 이 패널은 그 외 부품의 "장착한 모습 만들기" 흐름만 맡는다(저장 버튼을 두 군데 만들지 않는다).
  // 장착한 부품이 없으면 만들 것도 없다 - 빈 안내는 왼쪽 "현재 장착 중"/[현재 모습 저장] 줄이 이미 보여준다.
  if (compositeMode || activeParts.length === 0) return null

  return (
    <div className="mt-6 rounded-lg border border-ridefit-border bg-ridefit-bg p-4 text-left" data-testid="ai-fit-panel">
      <p className="mb-1 text-sm font-semibold text-ridefit-text">장착한 모습 만들기</p>
      <p className="mb-3 text-xs text-ridefit-text-secondary">
        미리 준비한 장착 이미지가 없는 부품은 버튼을 눌렀을 때 내 차량 사진에 함께 장착한 이미지 한 장을 새로 만들어요.
      </p>

      <p className="mb-1.5 text-[11px] font-semibold text-ridefit-text-secondary">이미지에 들어갈 부품 <span className="font-normal">· 장착/해제는 위 '현재 장착 중'에서</span></p>
      {activeParts.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1.5" data-testid="ai-fit-parts">
          {activeParts.map((p) => {
            const s = statusById.get(p.partId)
            const ok = s?.included
            // 배지는 "이미지 만들기"에 들어가는지(서버 확인 결과)이고, 장착 상태는 오른쪽 버튼이 보여준다.
            return (
              <PartRow
                key={p.partId}
                part={p}
                active
                ok={ok}
                badge={checking || !s ? '확인 중' : ok ? '이미지 포함' : (PART_REASON[s.code] ?? '제외')}
                badgeActive={!checking && !!s && ok}
              />
            )
          })}
        </ul>
      )}

      {activeParts.length > 0 && (
        <p className="mb-3 text-xs text-ridefit-text-secondary" data-testid="ai-fit-status">
          {checking
            ? '확인 중...'
            : included.length > 0 && included.length < activeParts.length
              ? `${activeParts.length}개 중 ${included.length}개 부품으로 만들어요. ${STATUS_TEXT[check?.code] ?? ''}`
              : (STATUS_TEXT[check?.code] ?? plain(check?.message))}
        </p>
      )}

      {activeParts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {/* 360° 보기 중일 때만 2D 결과 보기로 돌아가는 버튼을 보여준다. */}
          {viewMode !== 'fit' && (
            <button
              type="button"
              onClick={onShowBasic}
              className="rounded-lg border border-ridefit-border px-3 py-2 text-xs font-semibold text-ridefit-text-secondary transition hover:border-ridefit-primary"
            >
              2D 보기로 돌아가기
            </button>
          )}
          <button
            type="button"
            onClick={() => generate(false)}
            disabled={!ready}
            className="rounded-lg bg-ridefit-primary px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="ai-fit-button"
          >
            {generating ? '이미지 만드는 중... (최대 1~2분)' : isCached ? '저장된 장착 모습 보기' : '장착 모습 이미지 만들기'}
          </button>
          {isCached && !generating && (
            <button
              type="button"
              onClick={() => generate(true)}
              disabled={!ready}
              className="rounded-lg border border-ridefit-primary px-3 py-2 text-xs font-semibold text-ridefit-primary transition hover:bg-ridefit-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
              data-testid="ai-fit-regenerate"
            >
              새로 다시 만들기
            </button>
          )}
        </div>
      )}

      {activeParts.length > 0 && blockedReason && (
        <p className="mt-2 text-xs text-ridefit-text-secondary" data-testid="ai-fit-blocked">
          {blockedReason}
        </p>
      )}

      {generating && (
        <p className="mt-2 flex items-center gap-2 text-xs text-ridefit-text-secondary" data-testid="ai-fit-generating" aria-live="polite">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-ridefit-primary border-t-transparent" aria-hidden="true" />
          {title} 장착 모습을 만들고 있어요...
        </p>
      )}

      {error && (
        <p className="mt-2 text-xs text-ridefit-danger" data-testid="ai-fit-error">
          {error}
        </p>
      )}
      <p className="mt-3 text-[11px] text-ridefit-text-secondary">
        장착 모습은 참고용 생성 이미지이며 실제 장착 상태와 차이가 있을 수 있어요. 버튼을 눌렀을 때만 만들어지고, 만든 결과는 모두 위 '내 저장 목록'에 남아요.
      </p>
    </div>
  )
}

export default AiFitPanel
