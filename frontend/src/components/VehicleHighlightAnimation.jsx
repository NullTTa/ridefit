import { HERO_ANIMATION_IMAGE } from '../constants/images'

// 실제 등록된 Super Cub 110 사진(정측면, 앞이 오른쪽)을 기준으로 라벨 위치를 잡아뒀다.
// 다른 차량 사진으로 바꾸면 constants/images.js의 HERO_ANIMATION_IMAGE만 바꾸면 되고,
// 라벨 위치가 안 맞으면 이 배열의 top/left만 다시 조정하면 된다.
const LABELS = [
  { name: '머플러', top: '82%', left: '14%' },
  { name: '캐리어', top: '30%', left: '12%' },
  { name: '브레이크 레버', top: '18%', left: '78%' },
  { name: '헤드라이트', top: '14%', left: '62%' },
  { name: '미러', top: '2%', left: '70%' },
]
const CYCLE_SECONDS = 8
const STEP = CYCLE_SECONDS / LABELS.length

function VehicleHighlightAnimation() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div className="absolute h-72 w-72 rounded-full bg-ridefit-primary/10 blur-3xl" aria-hidden="true" />

      <img
        src={HERO_ANIMATION_IMAGE}
        alt="RIDEFIT"
        className="relative w-2/3 max-w-sm animate-vehicle-pulse select-none"
        draggable={false}
      />

      {LABELS.map((label, index) => (
        <div
          key={label.name}
          className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 opacity-0 animate-label-cycle"
          style={{ top: label.top, left: label.left, animationDelay: `${index * STEP}s` }}
        >
          <span
            className="h-3 w-3 rounded-full bg-ridefit-primary opacity-0 animate-hotspot-glow"
            style={{ animationDelay: `${index * STEP}s` }}
          />
          <span className="whitespace-nowrap rounded-full border border-ridefit-primary/40 bg-ridefit-bg/80 px-3 py-1 text-xs font-medium text-ridefit-text backdrop-blur">
            {label.name}
          </span>
        </div>
      ))}
    </div>
  )
}

export default VehicleHighlightAnimation
