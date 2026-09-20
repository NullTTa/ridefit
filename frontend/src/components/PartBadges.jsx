import { BADGE_META } from '../constants/badges'

// badges가 비어있으면 아무 것도 렌더링하지 않는다 - 실제 데이터가 없으면 배지도 없는 게 맞다.
function PartBadges({ badges }) {
  if (!badges || badges.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((key) => {
        const meta = BADGE_META[key]
        if (!meta) return null
        return (
          <span
            key={key}
            className="rounded-full bg-black/30 px-2 py-0.5 text-xs font-semibold backdrop-blur"
          >
            {meta.emoji} {meta.label}
          </span>
        )
      })}
    </div>
  )
}

export default PartBadges
