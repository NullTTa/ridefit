import { Check, Heart, X } from 'lucide-react'
import { displayImageUrl } from '../constants/productImages'
import { wheelToHorizontal } from '../lib/fitScroll'
import { compatDisplay } from '../lib/compatStatus'
import SafeImage from './SafeImage'

// FitRoom 왼쪽(차량 미리보기 아래) 패널 2개. 둘 다 상태를 따로 갖지 않는다 - FitRoom의 activePartIds(장착)와
// savedPartIds(즐겨찾기, DB /api/me/favorites)를 그대로 보여주고, 버튼은 FitRoom의 togglePart / toggleSaved를 부른다.
// 그래서 오른쪽 목록·차량 무대·저장 기능과 항상 같은 상태이고, 같은 자리 교체/실행 취소 규칙도 그대로 적용된다.

const thumb = (part, size = 'h-10 w-10') => (
  <SafeImage
    src={displayImageUrl(part.imageUrl)}
    alt=""
    className={`${size} shrink-0 rounded border border-ridefit-border bg-white object-contain p-0.5`}
    fallbackClassName={`${size} shrink-0 rounded border border-ridefit-border text-[8px] leading-tight`}
    fallbackText="이미지 없음"
  />
)

// 현재 장착 중: 지금 차량에 얹은 부품 + 개별 [빼기]. 많아지면 패널 안에서만 스크롤한다.
export function FitEquippedPanel({ activeParts, onRemove }) {
  return (
    <section className="mt-4 rounded-lg border border-ridefit-border bg-ridefit-bg p-3 text-left" data-testid="fit-equipped-panel" aria-labelledby="fit-equipped-title">
      <p id="fit-equipped-title" className="mb-2 px-1 text-sm font-semibold text-ridefit-text">
        현재 장착 중 <span className="font-normal text-ridefit-text-secondary">({activeParts.length})</span>
      </p>
      {activeParts.length === 0 ? (
        <p className="rounded-md border border-dashed border-ridefit-border px-3 py-3 text-xs text-ridefit-text-secondary" data-testid="fit-equipped-empty">
          아직 장착한 부품이 없어요. 오른쪽 부품 목록이나 아래 즐겨찾기에서 [장착]을 눌러 보세요.
        </p>
      ) : (
        <ul className="fit-scroll flex max-h-48 flex-col gap-1.5 overflow-y-auto overscroll-contain pr-1">
          {activeParts.map((p) => (
            <li key={p.partId} className="flex items-center gap-2 rounded-md border border-ridefit-primary/30 bg-ridefit-card px-2 py-1.5" data-testid={`fit-equipped-${p.partId}`}>
              {thumb(p, 'h-9 w-9')}
              <span className="min-w-0 flex-1">
                <span className="wrap-name block text-xs font-medium text-ridefit-text">{p.name}</span>
                <span className="block text-[11px] text-ridefit-text-secondary">
                  <Check aria-hidden="true" className="mr-0.5 inline h-3 w-3 text-ridefit-primary" />장착 중 · {p.category} · {compatDisplay(p.status, p.note).label}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onRemove(p.partId)}
                className="shrink-0 rounded-md border border-ridefit-border px-2.5 py-1 text-[11px] font-semibold text-ridefit-text-secondary transition hover:border-ridefit-danger hover:text-ridefit-danger"
                aria-label={`${p.name} 빼기`}
                data-testid={`fit-equipped-remove-${p.partId}`}
              >
                빼기
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// 즐겨찾기 부품(이 차량에 ♡ 저장한 부품): 가로로 넘기는 카드. 카드마다 장착 상태(글자 + 테두리)와 [장착]/[빼기], 즐겨찾기 해제.
// items: [{ partId, name, imageUrl, category, compatible, active }]. compatible=false(이 차량 호환 후보가 아님)면 장착 버튼을 막고 이유를 보여준다.
// 즐겨찾기 해제는 장착 상태를 바꾸지 않는다(이미 장착 중이면 그대로 장착돼 있다).
export function FitFavoritesPanel({ items, onToggleEquip, onUnfavorite, error }) {
  return (
    <section className="mt-4 rounded-lg border border-ridefit-border bg-ridefit-bg p-3 text-left" data-testid="fit-favorites-panel" aria-labelledby="fit-favorites-title">
      <p id="fit-favorites-title" className="mb-2 px-1 text-sm font-semibold text-ridefit-text">
        즐겨찾기 부품 <span className="font-normal text-ridefit-text-secondary">({items.length})</span>
      </p>
      {error && (
        <p className="mb-2 rounded-md border border-ridefit-danger-border bg-ridefit-danger-bg px-2.5 py-1.5 text-[11px] text-ridefit-danger" role="alert">
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-ridefit-border px-3 py-3 text-xs text-ridefit-text-secondary" data-testid="fit-favorites-empty">
          즐겨찾기한 부품이 없어요. 오른쪽 부품 목록에서 [♡ 저장하기]를 누르면 여기에 모여요.
        </p>
      ) : (
        <ul className="fit-scroll -mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2" ref={wheelToHorizontal} aria-label="즐겨찾기 부품 목록">
          {items.map((it) => (
            <li
              key={it.partId}
              className={`relative flex w-36 shrink-0 flex-col gap-1.5 rounded-md border bg-ridefit-card p-2 ${
                it.active ? 'border-ridefit-primary ring-1 ring-ridefit-primary/60' : 'border-ridefit-border'
              }`}
              data-testid={`fit-fav-${it.partId}`}
              data-active={it.active ? 'true' : 'false'}
            >
              <button
                type="button"
                onClick={() => onUnfavorite(it.partId)}
                className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-ridefit-warning transition hover:text-ridefit-danger"
                aria-label={`${it.name} 즐겨찾기 해제`}
                title="즐겨찾기 해제 (장착 상태는 그대로)"
                data-testid={`fit-fav-unsave-${it.partId}`}
              >
                <Heart aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor" />
              </button>
              {thumb(it, 'h-16 w-full')}
              <span className="wrap-name min-h-[2rem] text-[11px] font-medium leading-4 text-ridefit-text">{it.name}</span>
              <span className={`text-[11px] ${it.active ? 'font-semibold text-ridefit-primary' : 'text-ridefit-text-secondary'}`}>
                {!it.compatible ? '호환 확인 안 됨' : it.active ? <><Check aria-hidden="true" className="mr-0.5 inline h-3 w-3" />장착 중</> : '미장착'}
              </span>
              {it.compatible ? (
                <button
                  type="button"
                  onClick={() => onToggleEquip(it.partId)}
                  aria-pressed={it.active}
                  aria-label={`${it.name} ${it.active ? '빼기' : '장착'}`}
                  className={`mt-auto rounded-md px-2 py-1 text-xs font-semibold transition ${
                    it.active
                      ? 'border border-ridefit-primary text-ridefit-primary hover:bg-ridefit-primary/15'
                      : 'bg-ridefit-primary text-white hover:brightness-110'
                  }`}
                  data-testid={`fit-fav-toggle-${it.partId}`}
                >
                  {it.active ? <><X aria-hidden="true" className="mr-0.5 inline h-3 w-3" />빼기</> : '장착'}
                </button>
              ) : (
                <p className="mt-auto text-[10px] leading-snug text-ridefit-text-secondary" data-testid={`fit-fav-incompatible-${it.partId}`}>
                  이 차량과 호환이 확인되지 않아 장착할 수 없어요.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
