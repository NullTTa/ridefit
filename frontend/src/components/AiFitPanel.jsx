import { useEffect, useState } from 'react'
import { getAiAnchor } from '../constants/vehicleFitPositions'
import { api } from '../lib/api'
import SafeImage from './SafeImage'

// "장착해보기" - 선택한 부품이 내 차량에 장착된 모습(합성 이미지)을 보여준다. 기존 2D 위치 미리보기와 별개.
// 상태 조회는 무료(API 호출 없음)이고, 실제 생성은 버튼을 눌렀을 때만 요청한다. 실패해도 기존 FitRoom은 그대로다.
// 화면에는 "AI"라는 말을 쓰지 않는다 - 서버가 주는 안내 문구도 여기서 사용자용 문구로 바꿔 보여준다.
const STATUS_TEXT = {
  READY: '이 부품을 장착한 모습을 볼 수 있어요.',
  CACHED: '이전에 만든 장착 모습이 있어요.',
  NOT_CONFIGURED: '장착 모습 보기가 아직 준비되지 않았어요. 위치 미리보기는 그대로 볼 수 있어요.',
  REFERENCE_MISSING: '이 부품은 아직 장착 모습을 지원하지 않아요. 위치 미리보기로 확인해주세요.',
}

// 서버 문구(예: "AI 이미지를 만들지 못했어요")에서 기술 용어만 걷어낸다.
const plain = (message) => (message ?? '').replace(/AI\s?/g, '')

function AiFitPanel({ vehicle, myVehicleId, activeParts, onShowResult, onShowBasic, viewMode }) {
  const [selectedId, setSelectedId] = useState(null)
  const [status, setStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  const selected = activeParts.find((p) => p.partId === selectedId) ?? activeParts[0] ?? null
  const anchor = getAiAnchor(vehicle, selected)
  const anchorQuery = anchor ? `&anchorX=${anchor.x.toFixed(1)}&anchorY=${anchor.y.toFixed(1)}` : ''
  const selectedPartId = selected?.partId ?? null

  useEffect(() => {
    if (!selectedPartId) {
      setStatus(null)
      return
    }
    let cancelled = false
    setStatusLoading(true)
    setError(null)
    api
      .get(`/api/ai-fit/status?partId=${selectedPartId}&myVehicleId=${myVehicleId}${anchorQuery}`)
      .then((res) => !cancelled && setStatus(res))
      .catch((err) => !cancelled && setStatus({ canGenerate: false, code: 'ERROR', message: err.message }))
      .finally(() => !cancelled && setStatusLoading(false))
    return () => {
      cancelled = true
    }
  }, [selectedPartId, myVehicleId, anchorQuery])

  if (!selected) return null

  const handleGenerate = async () => {
    if (status?.code === 'CACHED' && status.cachedImageUrl) {
      onShowResult({ imageUrl: status.cachedImageUrl, cached: true, part: selected })
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const res = await api.post('/api/ai-fit', {
        partId: selected.partId,
        myVehicleId: Number(myVehicleId),
        anchorX: anchor?.x ?? null,
        anchorY: anchor?.y ?? null,
      })
      setStatus({ canGenerate: true, code: 'CACHED', message: '방금 만든 장착 모습이 있어요.', cachedImageUrl: res.imageUrl })
      onShowResult({ imageUrl: res.imageUrl, cached: res.cached, part: selected })
    } catch (err) {
      setError(plain(err.message))
    } finally {
      setGenerating(false)
    }
  }

  const canClick = status?.canGenerate && !generating && !statusLoading

  return (
    <div className="mt-6 rounded-lg border border-ridefit-border bg-ridefit-bg p-4 text-left" data-testid="ai-fit-panel">
      <p className="mb-3 text-sm font-semibold text-ridefit-text">장착한 모습 보기</p>

      {activeParts.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {activeParts.map((p) => (
            <button
              key={p.partId}
              type="button"
              onClick={() => setSelectedId(p.partId)}
              className={`rounded-full px-2.5 py-1 text-xs transition ${
                p.partId === selected.partId
                  ? 'bg-ridefit-primary text-white'
                  : 'border border-ridefit-border text-ridefit-text-secondary hover:border-ridefit-primary'
              }`}
            >
              {p.category}
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center gap-3">
        <SafeImage
          src={selected.imageUrl}
          alt={selected.name}
          className="h-12 w-12 shrink-0 rounded-md border border-ridefit-border bg-white object-contain p-0.5"
          fallbackClassName="h-12 w-12 shrink-0 rounded-md border border-ridefit-border text-[9px] leading-tight"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ridefit-text">{selected.name}</p>
          <p className="text-xs text-ridefit-text-secondary">
            {statusLoading ? '확인 중...' : (STATUS_TEXT[status?.code] ?? plain(status?.message))}
          </p>
        </div>
      </div>

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
          onClick={handleGenerate}
          disabled={!canClick}
          className="rounded-lg bg-ridefit-primary px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="ai-fit-button"
        >
          {generating ? '장착하는 중... (최대 1~2분)' : status?.code === 'CACHED' ? '장착 모습 보기' : '장착해보기'}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-ridefit-danger" data-testid="ai-fit-error">
          {error}
        </p>
      )}
      <p className="mt-3 text-[11px] text-ridefit-text-secondary">
        장착 모습은 참고용 합성 이미지이며 실제 장착 상태와 차이가 있을 수 있어요. 버튼을 눌렀을 때만 만들어지고, 같은 조합은 저장된 결과를 다시 보여줘요.
      </p>
    </div>
  )
}

export default AiFitPanel
