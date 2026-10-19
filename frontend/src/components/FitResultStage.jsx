import { AlertTriangle, Maximize2, RefreshCw, Wand2 } from 'lucide-react'
import { getFitLayout, getVehicleStageAspectRatio } from '../constants/vehicleFitPositions'
import VehicleFitStage from './VehicleFitStage'

const formatAt = (iso) =>
  iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

// FitRoom 왼쪽 무대(2D). 보여주는 것은 딱 두 가지다.
//  1) 입혀보기 결과 이미지(fit.result.imageUrl) - [입혀보기]로 만든 PNG / 저장된 결과 / AI 결과
//  2) 원본 차량 사진(입혀보기 결과가 없을 때, 또는 [원본] 비교 중)
// 부품을 선택만 한 상태에서는 원본 그대로 두고 "아직 입혀보기 전"을 알린다. 선택이 바뀌면 이전 결과를 흐리게 하고 [다시 입혀보기]를 띄운다
// (이전 이미지를 새 선택이 반영된 것처럼 보여주지 않는다). 2D 배치가 없는 차량(레이아웃 없음)은 합성할 수 없어 선택한 부품의 부착 위치만 표시한다.
function FitResultStage({ vehicle, fit, selectedParts, showOriginal, conflictPartIds, onZoomResult, onZoomStage }) {
  const layout = getFitLayout(vehicle)
  const r = fit.result
  const imageUrl = !showOriginal && r?.imageUrl ? r.imageUrl : null
  const dim = !!imageUrl && (fit.stale || fit.running)
  // 장착 이미지가 없는 선택 부품(레이아웃 없는 차량이면 전부)은 결과 이미지가 없을 때 원본 위에 부착 위치(배지)만 표시한다 - 입혀본 이미지가 아니라 위치 안내.
  const pinParts = !showOriginal && !imageUrl ? fit.plan.excluded : []

  const zoomButton = (onClick, label) => (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-2 top-2 z-[60] flex items-center gap-1 rounded-full border border-ridefit-border bg-ridefit-bg/85 px-2.5 py-1.5 text-xs font-medium text-ridefit-text shadow-lg backdrop-blur transition hover:border-ridefit-primary hover:text-ridefit-primary"
      aria-label={label}
      data-testid={imageUrl ? 'fit-result-zoom' : 'fit-stage-zoom'}
    >
      <Maximize2 aria-hidden="true" className="h-3.5 w-3.5" />크게 보기
    </button>
  )

  return (
    <div className="relative" data-testid="fit-result-stage" data-state={showOriginal ? 'original' : r ? `${r.kind}-${r.status}${fit.stale ? '-stale' : ''}` : 'none'}>
      {imageUrl ? (
        <button type="button" onClick={onZoomResult} className="block w-full cursor-zoom-in" aria-label="입혀보기 결과 크게 보기">
          {/* 합성 PNG는 무대와 같은 여백을 둔 같은 종횡비라 위치 미리보기/360°와 차량 크기가 같다. */}
          <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: getVehicleStageAspectRatio(vehicle) }}>
            <img
              src={imageUrl}
              alt={`${r.title} 입혀보기 결과`}
              className={`absolute inset-0 block h-full w-full select-none object-contain transition-opacity ${dim ? 'opacity-35' : ''}`}
              draggable={false}
              data-testid="fit-result-image"
              data-kind={r.kind}
              data-part-ids={r.partIds.join(',')}
            />
          </div>
        </button>
      ) : layout ? (
        <button type="button" onClick={onZoomStage} className="block w-full cursor-zoom-in" aria-label="차량 크게 보기" data-testid="fit-stage-zoom-area">
          <VehicleFitStage vehicle={vehicle} parts={pinParts} conflictPartIds={conflictPartIds} />
        </button>
      ) : (
        <VehicleFitStage vehicle={vehicle} parts={pinParts} conflictPartIds={conflictPartIds} />
      )}
      {(imageUrl || layout) && zoomButton(imageUrl ? onZoomResult : onZoomStage, imageUrl ? '입혀보기 결과 크게 보기' : '차량 크게 보기')}

      {/* 상태 덮개: 합성 중 / 이전 선택 기준 결과 / 실패. 원본 비교 중에는 띄우지 않는다. */}
      {!showOriginal && fit.running && (
        <div className="absolute inset-0 z-[55] flex items-center justify-center" aria-live="polite" data-testid="fit-compose-running">
          <p className="flex items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-sm font-semibold text-white">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
            {r?.kind === 'new' ? '선택한 부품을 입혀보는 중...' : '저장된 결과를 불러오는 중...'}
          </p>
        </div>
      )}
      {!showOriginal && fit.stale && !fit.running && r?.status === 'done' && (
        <div className="absolute inset-0 z-[55] flex items-center justify-center p-3" data-testid="fit-result-stale">
          <div className="max-w-xs rounded-lg border border-ridefit-warning-border bg-ridefit-bg/95 px-4 py-3 text-center shadow-xl">
            <p className="text-xs text-ridefit-text">선택한 부품이 바뀌었어요.<br />흐린 이미지는 <b>이전 선택</b>으로 만든 결과예요.</p>
            <button
              type="button"
              onClick={fit.compose}
              disabled={!fit.canCompose}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-ridefit-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
              data-testid="fit-result-recompose"
            >
              <Wand2 aria-hidden="true" className="h-3.5 w-3.5" />다시 입혀보기
            </button>
            {!fit.canCompose && fit.reasonText && <p className="mt-1.5 text-[11px] text-ridefit-text-secondary">{fit.reasonText}</p>}
          </div>
        </div>
      )}
      {!showOriginal && r?.status === 'error' && (
        <div className="absolute inset-0 z-[55] flex items-center justify-center p-3" role="alert" data-testid="fit-result-error">
          <div className="max-w-xs rounded-lg border border-ridefit-danger-border bg-ridefit-bg/95 px-4 py-3 text-center shadow-xl">
            <p className="text-xs text-ridefit-danger">
              <AlertTriangle aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />
              {r.kind === 'new' ? '입혀보지 못했어요.' : '저장된 결과를 열지 못했어요.'} {r.error}
            </p>
            {r.kind === 'new' && (
              <button
                type="button"
                onClick={fit.compose}
                disabled={!fit.canCompose}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-ridefit-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
                data-testid="fit-result-retry"
              >
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />다시 시도
              </button>
            )}
            {r.kind !== 'new' && (
              <p className="mt-1 text-[11px] text-ridefit-text-secondary">목록에서 다시 열거나 [입혀보기]로 새로 만들 수 있어요.</p>
            )}
          </div>
        </div>
      )}

      <ResultStatusLine vehicle={vehicle} fit={fit} selectedCount={selectedParts.length} showOriginal={showOriginal} />
    </div>
  )
}

// 무대 아래 한 줄: 지금 왼쪽에 보이는 것이 무엇인지(원본 / 입혀보기 전 / 새로 합성 / 저장된 결과 / AI 결과).
function ResultStatusLine({ vehicle, fit, selectedCount, showOriginal }) {
  const layout = getFitLayout(vehicle)
  const r = fit.result
  let tone = 'text-ridefit-text-secondary'
  let text
  if (showOriginal) {
    text = '원본 차량(입혀보기 전)'
  } else if (!layout) {
    text = selectedCount > 0
      ? `부품 ${selectedCount}개 · 위치만 표시(이 차량은 2D 입혀보기 미지원)`
      : '순정 상태 · 이 차량은 2D 입혀보기 미지원(위치만 표시)'
  } else if (!r && fit.plan.reason === 'no-image') {
    text = `부품 ${selectedCount}개 · 장착 이미지가 없어 위치만 표시돼요`
  } else if (!r) {
    if (selectedCount > 0) {
      tone = 'text-ridefit-primary font-semibold'
      text = `부품 ${selectedCount}개 선택 · [입혀보기]를 눌러 적용하세요`
    } else {
      text = '순정 상태'
    }
  } else if (r.status === 'running') {
    text = r.kind === 'new' ? '입혀보는 중...' : '저장된 결과를 불러오는 중...'
  } else if (r.status === 'error') {
    tone = 'text-ridefit-danger'
    text = r.kind === 'new' ? '입혀보기에 실패해 결과가 없어요.' : '저장된 결과 이미지를 열지 못했어요.'
  } else if (fit.stale) {
    tone = 'text-ridefit-warning'
    text = `이전 선택의 결과예요(${r.title}) · 지금 선택은 아직 반영 전`
  } else if (r.kind === 'new') {
    tone = 'text-ridefit-success'
    text = `2D 미리보기${r.approx ? ' · 간이 미리보기 포함' : ''} · 저장 전`
  } else if (r.kind === 'saved') {
    tone = 'text-ridefit-success'
    text = `저장된 결과${r.createdAt ? ` · ${formatAt(r.createdAt)}` : ''}`
  } else {
    text = `참고용 생성 이미지${r.cached ? '(저장된 결과)' : ''} · 실제 장착 모습과 다를 수 있어요`
  }
  return (
    <p className={`mt-2 text-center text-xs ${tone}`} data-testid="fit-result-status" aria-live="polite">
      {text}
    </p>
  )
}

export default FitResultStage
