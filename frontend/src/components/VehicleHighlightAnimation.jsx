import { HERO_ANIMATION_IMAGE } from '../constants/images'

// 실제 Super Cub 110 사진(1829x860, 정측면, 앞이 오른쪽) 픽셀을 직접 잘라 대조해서 좌표를 잡았다.
// top/left는 반드시 "이미지 자체의 실제 비율 박스(아래 aspectRatio 컨테이너)" 기준 퍼센트여야 한다 -
// 컨테이너 전체(패널) 기준으로 잡으면 이미지가 작게 중앙 정렬될 때 라벨이 엉뚱한 위치를 가리키게 된다.
// 다른 차량 사진으로 바꾸면 constants/images.js의 HERO_ANIMATION_IMAGE와 아래 IMAGE_ASPECT_RATIO,
// 라벨 좌표를 함께 다시 맞춰야 한다.
const IMAGE_ASPECT_RATIO = '1829 / 860'
const LABELS = [
  { name: '머플러', top: '74%', left: '22%' },
  { name: '캐리어', top: '38%', left: '20%' },
  { name: '브레이크 레버', top: '21%', left: '50%' },
  { name: '헤드라이트', top: '20%', left: '62%' },
  { name: '미러', top: '7%', left: '55%' },
]
const CYCLE_SECONDS = 8
const STEP = CYCLE_SECONDS / LABELS.length

function VehicleHighlightAnimation() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden p-6 sm:p-10">
      <div className="absolute h-72 w-72 rounded-full bg-ridefit-primary/10 blur-3xl" aria-hidden="true" />

      {/* 이 박스의 가로:세로 비율을 이미지 원본과 동일하게 고정해서, 이미지가 박스를 항상 꽉 채우고
          (레터박스 없음) 라벨 퍼센트 좌표가 이미지 실제 픽셀 위치와 정확히 맞도록 한다. */}
      <div className="relative w-full max-w-2xl" style={{ aspectRatio: IMAGE_ASPECT_RATIO }}>
        <img
          src={HERO_ANIMATION_IMAGE}
          alt="RIDEFIT"
          className="h-full w-full animate-vehicle-pulse select-none object-contain"
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
    </div>
  )
}

export default VehicleHighlightAnimation
