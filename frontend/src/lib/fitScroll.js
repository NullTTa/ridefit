// FitRoom 데스크톱(lg~) 독립 스크롤 영역에 쓰는 ref 콜백들(React 19 ref cleanup 사용). FitRoom과 FitRoom 왼쪽/오른쪽 패널 컴포넌트가 같이 쓴다.
// 데스크톱(lg~) 독립 스크롤 영역용 ref: 영역이 그 방향으로 더 스크롤할 수 없을 때(내용이 짧거나 끝에 닿음) 휠이 페이지로 넘어가지 않게 막는다.
// CSS overscroll-behavior: contain은 스크롤할 내용이 없는 영역에서는 휠을 페이지로 넘기므로(Chrome), 그 경우만 JS로 막는다.
// 영역 안에서 스크롤할 수 있으면 막지 않는다(기본 스크롤 그대로). 모바일 등 lg 미만에서는 아무것도 하지 않는다.
export const LG_QUERY = '(min-width: 1024px)'
export function containWheel(el) {
  if (!el) return undefined
  const onWheel = (e) => {
    if (e.ctrlKey || !window.matchMedia(LG_QUERY).matches) return
    // 이 영역 안의 다른 스크롤 영역(가로 스크롤 칩 등)이 휠을 쓸 수 있으면 그쪽에 맡긴다.
    for (let node = e.target; node && node !== el; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(node).overflowY)) return
    }
    const atTop = el.scrollTop <= 0
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
    if ((e.deltaY > 0 && atBottom) || (e.deltaY < 0 && atTop)) e.preventDefault()
  }
  el.addEventListener('wheel', onWheel, { passive: false })
  return () => el.removeEventListener('wheel', onWheel)
}

// 데스크톱(lg~)에서 한 줄로 가로 스크롤되는 카테고리 칩 줄: 세로 휠을 가로 이동으로 바꾼다(마우스 휠만으로 칩을 넘겨 볼 수 있게).
// 칩 줄이 가로로 더 갈 수 없는 쪽이면 막지 않는다(목록 박스가 평소처럼 스크롤된다).
export function wheelToHorizontal(el) {
  if (!el) return undefined
  const onWheel = (e) => {
    if (e.ctrlKey || !window.matchMedia(LG_QUERY).matches || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return
    const max = el.scrollWidth - el.clientWidth
    if (max <= 1) return
    if ((e.deltaY > 0 && el.scrollLeft >= max - 1) || (e.deltaY < 0 && el.scrollLeft <= 0)) return
    el.scrollLeft += e.deltaY
    e.preventDefault()
    e.stopPropagation()
  }
  el.addEventListener('wheel', onWheel, { passive: false })
  return () => el.removeEventListener('wheel', onWheel)
}

// 데스크톱(lg~) 스크롤 박스 맨 위에 붙어 있는(sticky) 머리 영역용 ref: 그 높이만큼 부모 스크롤 박스의 scroll-padding-top을 맞춘다.
// 키보드 Tab 이동 등으로 박스 안 항목이 화면에 들어올 때 고정된 머리(차량 무대/목록 제목·칩) 밑에 가려지지 않게 한다. 높이가 바뀌면 다시 맞춘다.
export function padForSticky(el) {
  if (!el) return undefined
  const pane = el.parentElement
  const update = () => {
    pane.style.scrollPaddingTop = window.matchMedia(LG_QUERY).matches ? `${el.offsetHeight}px` : ''
  }
  const ro = new ResizeObserver(update)
  ro.observe(el)
  window.addEventListener('resize', update)
  update()
  return () => {
    ro.disconnect()
    window.removeEventListener('resize', update)
    pane.style.scrollPaddingTop = ''
  }
}
