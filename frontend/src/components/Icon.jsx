// UI 아이콘은 이모지 대신 Lucide(lucide-react) SVG 하나로 통일한다(같은 선 두께 2, currentColor).
// 글자 사이에 넣는 아이콘은 Ico를 쓴다 - 글자 크기(1em)를 따라가고 기준선을 맞춘다. 장식이므로 스크린리더에서는 숨긴다.
export function Ico({ as: Component, className = '', filled = false }) {
  return (
    <Component
      aria-hidden="true"
      strokeWidth={2}
      fill={filled ? 'currentColor' : 'none'}
      className={`inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em] ${className}`}
    />
  )
}
