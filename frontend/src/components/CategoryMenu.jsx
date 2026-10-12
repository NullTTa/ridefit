import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { containWheel } from '../lib/fitScroll'

const SM_QUERY = '(min-width: 640px)'
const norm = (s) => (s ?? '').toLowerCase().replace(/\s+/g, '')

// "전체 카테고리" 메뉴: 실제 카테고리(DB Part.category)를 대분류(partCategoryGroups)별로 모두 보여주고 고르게 한다.
// 이름/묶음은 바꾸지 않는다(표시만). 데스크톱(sm~)은 버튼 아래 팝오버, 모바일은 화면 아래에서 올라오는 시트.
// 팝오버는 body로 포털해 목록 박스(overflow) 안에서 잘리지 않게 하고, 메뉴 안 목록만 스크롤된다(페이지로 넘기지 않음).
// groups: [[대분류, [소분류...]]], counts: Map(소분류 -> 부품 수), group/category: 현재 선택, onSelect({ group, category }).
function CategoryMenu({ groups, counts, group, category, onSelect }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [pos, setPos] = useState(null)
  const buttonRef = useRef(null)
  const panelRef = useRef(null)
  const inputRef = useRef(null)
  const total = [...counts.values()].reduce((a, b) => a + b, 0)

  const close = (focusButton = true) => {
    setOpen(false)
    setFilter('')
    if (focusButton) buttonRef.current?.focus()
  }

  // 위치: 데스크톱은 버튼 바로 아래(화면 밖으로 나가지 않게 좌우/높이를 맞춤), 모바일은 시트라 계산하지 않는다.
  useLayoutEffect(() => {
    if (!open) return undefined
    const place = () => {
      if (!window.matchMedia(SM_QUERY).matches || !buttonRef.current) return setPos(null)
      const r = buttonRef.current.getBoundingClientRect()
      const width = Math.min(380, window.innerWidth - 16)
      const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8))
      const below = window.innerHeight - r.bottom - 12
      const top = below >= 260 ? r.bottom + 6 : Math.max(72, r.top - 6 - Math.min(420, window.innerHeight - 96))
      setPos({ top, left, width, maxHeight: below >= 260 ? Math.min(420, below) : Math.min(420, window.innerHeight - 96) })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    inputRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && close()
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return
      close(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
    // close는 매 렌더 새로 만들어지지만 열려 있는 동안 같은 동작이라 의존성에 넣지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pick = (sel) => {
    onSelect(sel)
    close()
  }
  const q = norm(filter)
  const shownGroups = groups
    .map(([label, cats]) => [label, q && !norm(label).includes(q) ? cats.filter((c) => norm(c).includes(q)) : cats])
    .filter(([, cats]) => cats.length > 0)
  const current = category ?? group

  const itemClass = (active) =>
    `flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ridefit-primary ${
      active ? 'bg-ridefit-primary/15 font-semibold text-ridefit-primary' : 'text-ridefit-text hover:bg-ridefit-bg-alt'
    }`

  const panel = open && (
    <div className="fixed inset-0 z-[70] sm:pointer-events-none" data-testid="fit-category-menu-layer">
      {/* 모바일 시트 뒤 어두운 배경(눌러서 닫기) */}
      <div className="absolute inset-0 bg-black/50 sm:hidden" aria-hidden="true" onClick={() => close(false)} />
      <div
        ref={(el) => {
          panelRef.current = el
          return containWheel(el)
        }}
        role="dialog"
        aria-label="전체 카테고리"
        className="pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-[75dvh] flex-col rounded-t-2xl border border-ridefit-border bg-ridefit-card shadow-2xl sm:inset-x-auto sm:bottom-auto sm:rounded-xl"
        style={pos ? { top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight } : undefined}
        data-testid="fit-category-menu"
      >
        <div className="flex items-center gap-2 border-b border-ridefit-border p-2.5">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ridefit-text-secondary" />
            <input
              ref={inputRef}
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="카테고리 이름으로 찾기"
              aria-label="카테고리 이름으로 찾기"
              className="w-full rounded-lg border border-ridefit-border bg-ridefit-bg py-1.5 pl-8 pr-2 text-xs text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
              data-testid="fit-category-menu-filter"
            />
          </div>
          <button
            type="button"
            onClick={() => close()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ridefit-text-secondary transition hover:bg-ridefit-bg-alt hover:text-ridefit-text"
            aria-label="카테고리 메뉴 닫기"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div className="fit-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {!q && (
            <button type="button" onClick={() => pick({ group: null, category: null })} aria-pressed={current === null} className={itemClass(current === null)}>
              <span>전체 부품</span>
              <span className="flex items-center gap-1 text-[11px] text-ridefit-text-secondary">
                {total}개{current === null && <Check aria-hidden="true" className="h-3.5 w-3.5 text-ridefit-primary" />}
              </span>
            </button>
          )}
          {shownGroups.length === 0 && (
            <p className="px-2.5 py-4 text-xs text-ridefit-text-secondary" data-testid="fit-category-menu-empty">
              ‘{filter}’와 맞는 카테고리가 없어요.
            </p>
          )}
          {shownGroups.map(([label, cats]) => {
            const groupCount = cats.reduce((a, c) => a + (counts.get(c) ?? 0), 0)
            const groupActive = category === null && group === label
            return (
              <div key={label} className="mt-2">
                <button type="button" onClick={() => pick({ group: label, category: null })} aria-pressed={groupActive} className={`${itemClass(groupActive)} font-semibold`}>
                  <span>{label} 전체</span>
                  <span className="flex items-center gap-1 text-[11px] font-normal text-ridefit-text-secondary">
                    {groupCount}개{groupActive && <Check aria-hidden="true" className="h-3.5 w-3.5 text-ridefit-primary" />}
                  </span>
                </button>
                <ul className="mt-0.5 grid grid-cols-2 gap-0.5 pl-2">
                  {cats.map((c) => (
                    <li key={c}>
                      <button
                        type="button"
                        onClick={() => pick({ group: label, category: c })}
                        aria-pressed={category === c}
                        className={itemClass(category === c)}
                        data-testid={`fit-category-option-${c}`}
                      >
                        <span className="break-keep">{c}</span>
                        <span className="flex shrink-0 items-center gap-1 text-[11px] text-ridefit-text-secondary">
                          {counts.get(c) ?? 0}{category === c && <Check aria-hidden="true" className="h-3.5 w-3.5 text-ridefit-primary" />}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ridefit-primary ${
          category || group ? 'border-ridefit-primary text-ridefit-primary' : 'border-ridefit-border text-ridefit-text hover:border-ridefit-primary'
        }`}
        data-testid="fit-category-menu-button"
      >
        전체 카테고리
        <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {panel && createPortal(panel, document.body)}
    </>
  )
}

export default CategoryMenu
