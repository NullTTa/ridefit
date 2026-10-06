import { useEffect, useState } from 'react'
import { getAiAnchor } from '../constants/vehicleFitPositions'
import { api } from '../lib/api'
import SafeImage from './SafeImage'

// "장착해보기" - 체크한 부품들을 내 차량 사진에 함께 장착한 합성 이미지 한 장을 만든다. 기존 2D 위치 미리보기와 별개.
// 준비 상태 확인(/api/ai-fit/check)은 무료(API 호출 없음)이고, 실제 생성은 버튼을 눌렀을 때만 요청한다.
// 체크한 부품 중 합성에 넣을 수 없는 부품(참조 이미지 없음/지원하지 않는 종류 등)은 이유와 함께 빼고, 나머지로 만든다.
// 화면에는 "AI"라는 말을 쓰지 않는다 - 서버가 주는 안내 문구도 여기서 사용자용 문구로 바꿔 보여준다.
const PART_REASON = {
  REFERENCE_MISSING: '장착 이미지 준비 전',
  UNSUPPORTED_CATEGORY: '이 종류는 아직 지원 전',
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
}

// 서버 문구(예: "AI 이미지를 만들지 못했어요")에서 기술 용어만 걷어낸다.
const plain = (message) => (message ?? '').replace(/AI\s?/g, '')

function AiFitPanel({ vehicle, myVehicleId, activeParts, onShowResult, onShowBasic, onGenerated, viewMode }) {
  const [check, setCheck] = useState(null)
  const [checking, setChecking] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  // 체크한 순서와 상관없이 같은 조합이면 같은 요청이 되도록 부품 id 순으로 보낸다(서버 캐시 키도 정렬 기준).
  const inputs = [...activeParts]
    .sort((a, b) => a.partId - b.partId)
    .map((p) => {
      const anchor = getAiAnchor(vehicle, p)
      return { partId: p.partId, anchorX: anchor ? Number(anchor.x.toFixed(1)) : null, anchorY: anchor ? Number(anchor.y.toFixed(1)) : null }
    })
  const inputsKey = JSON.stringify(inputs)

  useEffect(() => {
    const parts = JSON.parse(inputsKey)
    if (parts.length === 0) {
      setCheck(null)
      return
    }
    let cancelled = false
    setChecking(true)
    setError(null)
    api
      .post('/api/ai-fit/check', { myVehicleId: Number(myVehicleId), parts })
      .then((res) => !cancelled && setCheck(res))
      .catch((err) => !cancelled && setCheck({ canGenerate: false, code: 'ERROR', message: err.message, parts: [] }))
      .finally(() => !cancelled && setChecking(false))
    return () => {
      cancelled = true
    }
  }, [inputsKey, myVehicleId])

  const byId = new Map(activeParts.map((p) => [p.partId, p]))
  const statusById = new Map((check?.parts ?? []).map((s) => [s.partId, s]))
  const included = (check?.parts ?? []).filter((s) => s.included).map((s) => byId.get(s.partId)).filter(Boolean)
  const title = included.map((p) => p.name).join(' + ')

  const generate = async (regenerate) => {
    if (!regenerate && check?.code === 'CACHED' && check.cachedImageUrl) {
      onShowResult({ imageUrl: check.cachedImageUrl, cached: true, title })
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
      onShowResult({ imageUrl: res.imageUrl, cached: res.cached, title })
      onGenerated?.()
    } catch (err) {
      setError(plain(err.message))
    } finally {
      setGenerating(false)
    }
  }

  const ready = check?.canGenerate && !generating && !checking
  const isCached = check?.code === 'CACHED'

  return (
    <div className="mt-6 rounded-lg border border-ridefit-border bg-ridefit-bg p-4 text-left" data-testid="ai-fit-panel">
      <p className="mb-1 text-sm font-semibold text-ridefit-text">장착한 모습 만들기</p>
      <p className="mb-3 text-xs text-ridefit-text-secondary">
        부품 목록에서 [장착해보기]로 고른 부품들을 내 차량 사진에 함께 장착한 이미지 한 장으로 만들어요.
      </p>

      {activeParts.length === 0 ? (
        <p className="text-xs text-ridefit-text-secondary" data-testid="ai-fit-empty">
          부품 목록에서 하나 이상 [장착해보기]로 고르면 만들 수 있어요.
        </p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1.5" data-testid="ai-fit-parts">
          {activeParts.map((p) => {
            const s = statusById.get(p.partId)
            const ok = s?.included
            return (
              <li key={p.partId} className="flex items-center gap-2" data-testid={`ai-fit-part-${p.partId}`} data-included={ok ? 'true' : 'false'}>
                <SafeImage
                  src={p.imageUrl}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded border border-ridefit-border bg-white object-contain p-0.5"
                  fallbackClassName="h-8 w-8 shrink-0 rounded border border-ridefit-border text-[8px] leading-tight"
                />
                <span className={`min-w-0 flex-1 truncate text-xs ${ok ? 'text-ridefit-text' : 'text-ridefit-text-secondary line-through decoration-ridefit-text-secondary/50'}`}>
                  {p.name}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    checking || !s
                      ? 'bg-ridefit-card text-ridefit-text-secondary'
                      : ok
                        ? 'bg-ridefit-primary/15 text-ridefit-primary'
                        : 'bg-ridefit-card text-ridefit-text-secondary'
                  }`}
                >
                  {checking || !s ? '확인 중' : ok ? '함께 장착' : (PART_REASON[s.code] ?? '제외')}
                </span>
              </li>
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
          {/* 이미 위치 미리보기를 보고 있을 때는 눌러도 바뀌는 게 없으므로, 다른 보기일 때만 보여준다. */}
          {viewMode !== 'fit' && (
            <button
              type="button"
              onClick={onShowBasic}
              className="rounded-lg border border-ridefit-border px-3 py-2 text-xs font-semibold text-ridefit-text-secondary transition hover:border-ridefit-primary"
            >
              위치 미리보기로 돌아가기
            </button>
          )}
          <button
            type="button"
            onClick={() => generate(false)}
            disabled={!ready}
            className="rounded-lg bg-ridefit-primary px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="ai-fit-button"
          >
            {generating ? '장착하는 중... (최대 1~2분)' : isCached ? '저장된 장착 모습 보기' : '장착해보기'}
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
        장착 모습은 참고용 합성 이미지이며 실제 장착 상태와 차이가 있을 수 있어요. 버튼을 눌렀을 때만 만들어지고, 만든 결과는 모두 아래 "저장된 장착 모습"에 남아요.
      </p>
    </div>
  )
}

export default AiFitPanel
