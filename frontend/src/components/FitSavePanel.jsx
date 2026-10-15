import { ChevronDown, Layers, RotateCcw, Save, Trash2, Wand2 } from 'lucide-react'
import SafeImage from './SafeImage'

const formatSavedAt = (iso) =>
  new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

// FitRoom 합성 바 + 내 저장 목록. 상태는 FitRoom이 부른 useFitComposite(lib/useFitComposite.js) 하나뿐이다.
//  - [입혀보기]: 지금 선택한 부품을 차량 사진에 그린 이미지 한 장을 만든다(2D, AI 없음). 선택만 바꿔서는 이미지가 바뀌지 않는다.
//  - [저장하기]: 화면에 보이는 그 합성 이미지 + 부품 목록을 내 저장 목록(내 차고)에 저장한다(POST /api/ai-fit/composite).
//  - [초기화]: 선택한 부품을 모두 빼고 입혀보기 결과를 지운다(실행 취소로 되돌릴 수 있음). 저장된 결과는 지우지 않는다.

const btn = 'inline-flex shrink-0 items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm'

function SaveButton({ fit, testid = 'fit-save-current' }) {
  const saved = fit.upToDate && fit.result.kind !== 'new'
  return (
    <button
      type="button"
      onClick={fit.save}
      disabled={!fit.canSave}
      className={`${btn} border border-ridefit-primary text-ridefit-primary hover:bg-ridefit-primary/10`}
      title={fit.stale ? '선택이 바뀌었어요. 다시 입혀본 뒤 저장할 수 있어요.' : !fit.result ? '먼저 [입혀보기]를 눌러 주세요.' : undefined}
      data-testid={testid}
    >
      <Save aria-hidden="true" className="h-4 w-4" />
      {fit.saving ? '저장하는 중...' : saved ? '저장됨' : '저장하기'}
    </button>
  )
}

// 차량 무대 바로 아래(데스크톱에서는 고정된 미리보기 안): 선택 요약 + [초기화] [입혀보기] [저장하기] + [내 목록 ↓]
export function FitComposeBar({ fit, selectedCount, onReset, savedCount = 0, onJumpToList }) {
  const { plan, approxIds, result, running, upToDate, note, reasonText } = fit
  const includedNames = plan.included.map((p) => `${p.name}${approxIds.has(p.partId) ? ' (간이)' : ''}`).join(', ')
  const composeLabel = running ? '입혀보는 중...' : upToDate ? '입혀보기 완료' : result ? '다시 입혀보기' : '입혀보기'
  return (
    <div className="mt-3 rounded-lg border border-ridefit-primary/40 bg-ridefit-bg px-3 py-2" data-testid="fit-save-panel">
      <p
        className="fit-scroll wrap-name min-w-0 text-[11px] leading-snug text-ridefit-text-secondary lg:max-h-[4.125em] lg:overflow-y-auto"
        data-testid="fit-save-included"
      >
        {selectedCount === 0 ? (
          '오른쪽 목록에서 부품을 [선택]한 뒤 [입혀보기]를 누르면 차량 이미지에 적용돼요.'
        ) : reasonText ? (
          reasonText
        ) : (
          <>
            <span className="font-semibold text-ridefit-text">선택 {selectedCount}개</span> · 입혀볼 부품: <span className="text-ridefit-text">{includedNames}</span>
            {plan.excluded.length > 0 && <span> · 위치 표시만(이미지 없음): {plan.excluded.map((p) => p.name).join(', ')}</span>}
          </>
        )}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        {onJumpToList && (
          <button
            type="button"
            onClick={onJumpToList}
            className="mr-auto inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-ridefit-border px-2 py-2 text-[11px] font-semibold text-ridefit-text-secondary transition hover:border-ridefit-primary hover:text-ridefit-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ridefit-primary"
            aria-label={`내 저장 목록으로 이동 (${savedCount}개)`}
            title="내 저장 목록으로 이동"
            data-testid="fit-jump-saved"
          >
            내 목록 {savedCount}
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          disabled={selectedCount === 0 && !result}
          className={`${btn} border border-ridefit-border text-ridefit-text-secondary hover:border-ridefit-danger hover:text-ridefit-danger`}
          title="선택한 부품을 모두 빼고 입혀보기 결과를 지워요(저장된 결과는 지우지 않아요). 실행 취소로 되돌릴 수 있어요."
          data-testid="fit-reset"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />초기화
        </button>
        <button
          type="button"
          onClick={fit.compose}
          disabled={!fit.canCompose || upToDate}
          aria-busy={running}
          className={`${btn} bg-ridefit-primary text-white shadow-lg shadow-ridefit-primary/20 hover:brightness-110 disabled:shadow-none`}
          data-testid="fit-compose"
        >
          {running ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
          ) : (
            <Wand2 aria-hidden="true" className="h-4 w-4" />
          )}
          {composeLabel}
        </button>
        <SaveButton fit={fit} />
      </div>
      {note && (
        <p className={`mt-1.5 text-xs ${note.kind === 'error' ? 'text-ridefit-danger' : 'text-ridefit-primary'}`} role={note.kind === 'error' ? 'alert' : 'status'} data-testid="fit-save-note">
          {note.text}
        </p>
      )}
    </div>
  )
}

// 부품 목록 머리·선택한 부품 패널에 두는 [입혀보기] 버튼. 차량 무대 옆 버튼과 같은 동작(지금 선택 전체를 입혀보고 결과 위치로 이동).
// 누를 수 없으면(선택 없음/지원 안 하는 차량·부품) 비활성 + 이유를 툴팁과 aria-description으로 알린다.
export function FitTryButton({ fit, onComposeAndShow, testid, className = '' }) {
  const { running, upToDate, result } = fit
  const label = running ? '입혀보는 중...' : upToDate ? '입혀보기 완료' : result ? '다시 입혀보기' : '입혀보기'
  return (
    <button
      type="button"
      onClick={onComposeAndShow}
      disabled={running || upToDate || !fit.canCompose}
      aria-busy={running}
      title={!fit.canCompose && !running && fit.reasonText ? fit.reasonText : undefined}
      className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-full bg-ridefit-primary px-3 py-1 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      data-testid={testid}
    >
      <Wand2 aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

// 모바일/태블릿 전용: 부품 목록을 내려 차량 무대가 화면 밖에 있을 때 화면 아래에 붙는 [입혀보기] 바.
// 누르면 합성하고 차량 무대로 스크롤해 결과를 바로 보여준다.
export function FitComposeDock({ fit, selectedCount, visible, onComposeAndShow }) {
  if (!visible) return null
  const { running, upToDate, stale, result } = fit
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ridefit-border bg-ridefit-card/95 px-4 py-2.5 backdrop-blur lg:hidden" data-testid="fit-compose-dock">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <p className="min-w-0 text-xs text-ridefit-text-secondary">
          <Layers aria-hidden="true" className="mr-1 inline h-3.5 w-3.5 text-ridefit-primary" />
          선택 <span className="font-semibold text-ridefit-text">{selectedCount}개</span>
          {selectedCount === 0 ? ' · 부품을 선택하면 입혀볼 수 있어요' : upToDate ? ' · 입혀보기 완료' : stale ? ' · 선택이 바뀜' : result ? '' : ' · 아직 입혀보기 전'}
        </p>
        <button
          type="button"
          onClick={onComposeAndShow}
          disabled={running || (!fit.canCompose && !upToDate)}
          title={!upToDate && fit.reasonText ? fit.reasonText : undefined}
          className={`${btn} bg-ridefit-primary text-white hover:brightness-110`}
          data-testid="fit-compose-dock-button"
        >
          <Wand2 aria-hidden="true" className="h-4 w-4" />
          {running ? '입혀보는 중...' : upToDate ? '결과 보기' : '입혀보기'}
        </button>
      </div>
    </div>
  )
}

// 내 저장 목록: 썸네일 + 부품 + 저장 시각, 항목 클릭 = 저장된 이미지와 그때 부품 불러오기(onOpen), 휴지통 = 삭제 확인(onDelete).
// 많아져도 미리보기/부품 목록을 밀어내지 않게 높이를 제한하고 이 안에서만 스크롤한다.
export default function FitSavedList({ fit, savedResults, activeResultId, onOpen, onDelete }) {
  return (
    <section className="mt-4 rounded-lg border border-ridefit-border bg-ridefit-bg p-3 text-left" data-testid="ai-fit-history">
      <p className="mb-2 px-1 text-sm font-semibold text-ridefit-text">
        내 저장 목록 <span className="font-normal text-ridefit-text-secondary">({savedResults.length})</span>
      </p>
      {savedResults.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-ridefit-border px-3 py-4" data-testid="fit-saved-results-empty">
          <p className="text-xs text-ridefit-text-secondary">아직 저장한 입혀보기 결과가 없어요. 부품을 선택하고 [입혀보기] → [저장하기]를 눌러 보세요.</p>
          {fit.canSave && <SaveButton fit={fit} testid="fit-save-current-empty" />}
        </div>
      ) : (
        <ul className="fit-scroll flex max-h-64 flex-col gap-2 overflow-y-auto overscroll-contain pr-1" data-testid="fit-saved-results">
          {savedResults.map((r) => {
            const title = r.partNames.join(' + ')
            const active = r.id === activeResultId
            return (
              <li
                key={r.id}
                className={`flex items-stretch gap-1 rounded-md border bg-ridefit-card transition ${
                  active ? 'border-ridefit-primary ring-1 ring-ridefit-primary' : 'border-ridefit-border hover:border-ridefit-primary/60'
                }`}
              >
                {/* 좁은 화면: [썸네일 | 저장 시각·부품 수] 아래에 부품 이름을 전체 폭으로. sm 이상: 썸네일 왼쪽, 오른쪽에 이름 + 저장 시각. */}
                <button
                  type="button"
                  onClick={() => onOpen(r)}
                  className="grid min-w-0 flex-1 grid-cols-[5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 p-2 text-left [grid-template-areas:'thumb_meta'_'title_title'] sm:[grid-template-areas:'thumb_title'_'thumb_meta'] sm:gap-y-0.5"
                  title={`${title} - 눌러서 저장된 이미지와 그때 부품 불러오기`}
                  aria-pressed={active}
                  data-testid={`ai-fit-history-${r.id}`}
                >
                  <SafeImage
                    src={r.imageUrl}
                    alt={`${title} 입혀보기 결과`}
                    className="aspect-[4/3] w-20 shrink-0 rounded bg-ridefit-bg object-contain [grid-area:thumb]"
                    fallbackClassName="aspect-[4/3] w-20 shrink-0 rounded text-[9px] [grid-area:thumb]"
                    fallbackText="이미지 없음"
                  />
                  <span className="wrap-name block min-w-0 self-end text-xs font-medium text-ridefit-text [grid-area:title] max-sm:self-start">{title}</span>
                  <span className="block min-w-0 self-start text-[11px] text-ridefit-text-secondary [grid-area:meta] max-sm:self-center">
                    {formatSavedAt(r.createdAt)} 저장 · 부품 {r.partIds.length}개{r.model !== 'direct-composite' && ' · 생성 이미지'}
                    {r.myVehicleId == null && ' · 같은 차종 예전 결과'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(r)}
                  className="flex w-9 shrink-0 items-center justify-center rounded-r-md text-ridefit-text-secondary transition hover:bg-ridefit-danger/10 hover:text-ridefit-danger"
                  aria-label={`${title} 입혀보기 결과 삭제`}
                  title="이 저장 결과 삭제"
                  data-testid={`ai-fit-history-delete-${r.id}`}
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
