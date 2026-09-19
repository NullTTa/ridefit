import { VEHICLE_PLACEHOLDER_IMAGE } from '../constants/images'

// 차량 이미지는 지금은 임시 아이콘(hero.png)이고, 실제 사진으로 교체할 때
// constants/images.js 파일 하나만 바꾸면 이 컴포넌트를 포함한 모든 곳에 반영된다.
const LABELS = [
  { name: '머플러', top: '70%', left: '76%' },
  { name: '캐리어', top: '26%', left: '78%' },
  { name: '브레이크 레버', top: '48%', left: '16%' },
  { name: '윈드스크린', top: '16%', left: '44%' },
  { name: '미러', top: '20%', left: '66%' },
]
const CYCLE_SECONDS = 8
const STEP = CYCLE_SECONDS / LABELS.length

function VehicleHighlightAnimation() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div className="absolute h-72 w-72 rounded-full bg-ridefit-primary/10 blur-3xl" aria-hidden="true" />

      <img
        src={VEHICLE_PLACEHOLDER_IMAGE}
        alt="RIDEFIT"
        className="relative w-1/2 max-w-xs animate-vehicle-pulse select-none"
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
