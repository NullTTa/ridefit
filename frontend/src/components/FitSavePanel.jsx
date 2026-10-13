import { ChevronDown, Save, Trash2 } from 'lucide-react'
import SafeImage from './SafeImage'

const formatSavedAt = (iso) =>
  new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

// FitRoom "현재 모습 저장" + "내 저장 목록".
// 저장은 lib/fitComposite saveFitComposite(위치 미리보기와 같은 배치를 차량 원본 해상도로 합성, AI 없음)를 그대로 쓰고,
// 목록/삭제는 FitRoom이 가진 저장 결과(GET /api/ai-fit/results)와 삭제 확인(DELETE /api/ai-fit/results/{id})을 그대로 쓴다.
// 버튼(FitSaveAction)은 차량 무대 바로 아래(데스크톱에서는 고정된 미리보기 안)에, 목록(FitSavedList)은 그 아래에 둔다 -
// 둘이 같은 저장 상태를 쓰도록 FitRoom에서 useFitSave(lib/useFitSave.js)를 한 번 부르고 결과(fitSave)를 둘 다에 넘긴다.

function SaveButton({ fitSave, testid = 'fit-save-current' }) {
  return (
    <button
      type="button"
      onClick={fitSave.save}
      disabled={!fitSave.canSave || fitSave.saving}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-ridefit-primary/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      data-testid={testid}
    >
      <Save aria-hidden="true" className="h-4 w-4" />
      {fitSave.saving ? '저장하는 중...' : '현재 모습 저장'}
    </button>
  )
}

// 차량 무대 바로 아래 한 줄: [현재 모습 저장] + 이미지에 들어가는 부품 안내(짧게).
// savedCount/onJumpToList: [내 목록 n ↓] - 고정된 미리보기 아래쪽 "내 저장 목록"까지 한 번에 내려간다(왼쪽 패널이 길어져도 바로 찾게).
export function FitSaveAction({ fitSave, savedCount = 0, onJumpToList }) {
  const { canSave, included, excluded, hasParts, note } = fitSave
  return (
    <div className="mt-3 rounded-lg border border-ridefit-primary/40 bg-ridefit-bg px-3 py-2" data-testid="fit-save-panel">
      {/* 좁은 화면: 안내 문구를 한 줄 전체 폭으로 두고 버튼은 그 아래 오른쪽에(한 줄에 두면 문구 칸이 0px까지 줄어 안 보였다).
          sm 이상: 한 줄. 부품 이름은 자르지 않고 전부 줄바꿈해 보여주되, 데스크톱 고정 영역(차량 무대 + 이 줄)이 너무 높아지지 않게
          lg에서는 세 줄 높이까지만 늘리고 그 이상은 이 칸 안에서 스크롤한다(같은 부품은 바로 아래 "현재 장착 중"에도 전부 보인다). */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <p
          className="fit-scroll wrap-name min-w-0 text-[11px] leading-snug text-ridefit-text-secondary sm:flex-1 lg:max-h-[4.125em] lg:overflow-y-auto"
          title={canSave ? [included.map((p) => p.name).join(', '), excluded.length ? `위치 표시만: ${excluded.map((p) => p.name).join(', ')}` : ''].filter(Boolean).join(' / ') : undefined}
          data-testid="fit-save-included"
        >
          {!hasParts
            ? '부품 목록에서 [장착해보기]를 누르면 차량 위에 표시되고, 지금 모습을 이미지로 저장할 수 있어요.'
            : canSave
              ? <>저장 이미지에 들어가는 부품: <span className="text-ridefit-text">{included.map((p) => p.name).join(', ')}</span></>
              : '장착 이미지가 아직 없는 부품이라 바로 저장할 수 없어요. 아래 ‘장착한 모습 만들기’를 확인해 주세요.'}
          {canSave && excluded.length > 0 && (
            <span> · 위치 표시만(이미지에 안 들어감): {excluded.map((p) => p.name).join(', ')}</span>
          )}
        </p>
        <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
        {onJumpToList && (
          <button
            type="button"
            onClick={onJumpToList}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-ridefit-border px-2 py-2 text-[11px] font-semibold text-ridefit-text-secondary transition hover:border-ridefit-primary hover:text-ridefit-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ridefit-primary"
            aria-label={`내 저장 목록으로 이동 (${savedCount}개)`}
            title="내 저장 목록으로 이동"
            data-testid="fit-jump-saved"
          >
            내 목록 {savedCount}
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
        <SaveButton fitSave={fitSave} />
        </div>
      </div>
      {note && (
        <p className={`mt-1.5 text-xs ${note.kind === 'error' ? 'text-ridefit-danger' : 'text-ridefit-primary'}`} role={note.kind === 'error' ? 'alert' : 'status'} data-testid="fit-save-note">
          {note.text}
        </p>
      )}
    </div>
  )
}

// 내 저장 목록: 썸네일 + 부품 + 저장 시각(+ 같은 차종 예전 결과 표시), 항목 클릭 = 이미지와 장착 부품 복원(onOpen), 휴지통 = 삭제 확인(onDelete).
// 많아져도 미리보기/부품 목록을 밀어내지 않게 높이를 제한하고 이 안에서만 스크롤한다.
export default function FitSavedList({ fitSave, myVehicleId, savedResults, activeResultId, onOpen, onDelete }) {
  return (
    <section className="mt-4 rounded-lg border border-ridefit-border bg-ridefit-bg p-3 text-left" data-testid="ai-fit-history">
      <p className="mb-2 px-1 text-sm font-semibold text-ridefit-text">
        내 저장 목록 <span className="font-normal text-ridefit-text-secondary">({savedResults.length})</span>
      </p>
      {savedResults.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-ridefit-border px-3 py-4" data-testid="fit-saved-results-empty">
          <p className="text-xs text-ridefit-text-secondary">아직 저장한 장착 모습이 없어요. 부품을 장착하고 [현재 모습 저장]을 눌러 보세요.</p>
          {fitSave.canSave && <SaveButton fitSave={fitSave} testid="fit-save-current-empty" />}
        </div>
      ) : (
        <ul className="fit-scroll flex max-h-64 flex-col gap-2 overflow-y-auto overscroll-contain pr-1" data-testid="fit-saved-results">
          {savedResults.map((r) => {
            const title = r.partNames.join(' + ')
            const active = r.id === activeResultId
            const thisVehicle = String(r.myVehicleId) === String(myVehicleId)
            return (
              <li
                key={r.id}
                className={`flex items-stretch gap-1 rounded-md border bg-ridefit-card transition ${
                  active ? 'border-ridefit-primary ring-1 ring-ridefit-primary' : 'border-ridefit-border hover:border-ridefit-primary/60'
                }`}
              >
                {/* 좁은 화면: [썸네일 | 저장 시각·부품 수] 아래에 부품 이름을 전체 폭으로 - 썸네일 옆 좁은 칸에 두면 긴 이름이 10줄 가까이 됐다.
                    sm 이상: 예전처럼 썸네일 왼쪽, 오른쪽에 이름 + 저장 시각. */}
                <button
                  type="button"
                  onClick={() => onOpen(r)}
                  className="grid min-w-0 flex-1 grid-cols-[5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 p-2 text-left [grid-template-areas:'thumb_meta'_'title_title'] sm:[grid-template-areas:'thumb_title'_'thumb_meta'] sm:gap-y-0.5"
                  title={`${title} - 눌러서 이 모습과 장착 부품 불러오기`}
                  aria-pressed={active}
                  data-testid={`ai-fit-history-${r.id}`}
                >
                  <SafeImage
                    src={r.imageUrl}
                    alt={`${title} 장착 모습`}
                    className="aspect-[4/3] w-20 shrink-0 rounded bg-ridefit-bg object-contain [grid-area:thumb]"
                    fallbackClassName="aspect-[4/3] w-20 shrink-0 rounded text-[9px] [grid-area:thumb]"
                    fallbackText="이미지 없음"
                  />
                  <span className="wrap-name block min-w-0 self-end text-xs font-medium text-ridefit-text [grid-area:title] max-sm:self-start">{title}</span>
                  <span className="block min-w-0 self-start text-[11px] text-ridefit-text-secondary [grid-area:meta] max-sm:self-center">
                    {formatSavedAt(r.createdAt)} 저장 · 부품 {r.partIds.length}개
                    {!thisVehicle && ' · 같은 차종 예전 결과'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(r)}
                  className="flex w-9 shrink-0 items-center justify-center rounded-r-md text-ridefit-text-secondary transition hover:bg-ridefit-danger/10 hover:text-ridefit-danger"
                  aria-label={`${title} 장착 모습 삭제`}
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
