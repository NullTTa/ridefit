import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { HERO_BUILD } from '../constants/heroBuild'
import { getPartOverlays, VEHICLE_FIT_LAYOUTS } from '../constants/vehicleFitPositions'

// 홈 히어로: 순정 Super Cub 110에 부품이 하나씩 자동으로 장착되는 짧은 쇼케이스(클릭/hover 없이 무한 반복).
//   순정 -> 머플러 연결선 -> 머플러 장착 -> 잠시 유지 -> 앞바구니 연결선 -> 앞바구니 장착 -> 유지 -> 사이드백 연결선 -> 사이드백 장착
//   -> 완성 상태를 충분히 보여줌 -> 부품과 선이 함께 서서히 사라지며 순정으로 -> 처음부터 반복
// 다음 부품의 선은 앞 부품이 장착된 뒤에만 나타나고(동시에 세 선이 나오지 않음), 앞에서 장착한 부품은 끝까지 유지된다.
// prefers-reduced-motion이면 반복하지 않고 완성 상태를 바로 보여준다.
//
// 이미지(새로 그린 픽셀 없음)
//  - 차량: vehicles/super-cub-110.png 그대로. 장착 지점 좌표는 FitRoom과 같은 VEHICLE_FIT_LAYOUTS를 읽기만 한다.
//  - 부품: heroBuild.js - 머플러/앞바구니는 같은 캔버스 크기의 투명 레이어, 사이드백은 FitRoom 오버레이를 같은 배치로(비율 유지).
//    "덮어서만은 표현 못 하는" 픽셀(순정 머플러 지운 자리, 바구니 뒤 검정 배경)은 무대 배경색(STAGE_BG) 기준이라
//    무대 배경색을 바꾸면 레이어도 다시 만들어야 한다(WORK_LOG 11차, 13차).
const VEHICLE_IMAGE = '/assets/vehicles/super-cub-110.png'
const LAYOUT = VEHICLE_FIT_LAYOUTS[VEHICLE_IMAGE]
const STAGE_BG = '#020202'
// 차량 사진(1829x860, 미러 끝이 사진 맨 위)을 무대 위에서 OY만큼 내려 테두리에 닿지 않게 하고, 아래에는 머플러 이름표 자리를 둔다.
// 좌표(장착 지점/이름표)는 모두 차량 사진 좌표 + OY.
const OY = 50
const PAD_BOTTOM = 175
const STAGE = { width: LAYOUT.width, height: OY + LAYOUT.height + PAD_BOTTOM }
const vehicleTop = `${(OY / STAGE.height) * 100}%`
const pct = (v, total) => `${(v / total) * 100}%`

// 장면 순서(ms). shown = 연결선이 보이는 부품 수, installed = 장착된 부품 수, fading = 완성 후 순정으로 돌아가는 중.
const INTRO = 1400 // 순정 상태
const LINE = 900 // 선이 그려지는 시간(그 뒤 장착)
const HOLD = 1700 // 장착 뒤 다음 선까지 유지
const FINAL = 3200 // 완성 상태 유지
const FADE = 1100 // 순정으로 서서히 돌아가는 시간
const N = HERO_BUILD.length
function buildTimeline() {
  const steps = [{ shown: 0, installed: 0, fading: false, wait: INTRO }]
  for (let i = 0; i < N; i++) {
    steps.push({ shown: i + 1, installed: i, fading: false, wait: LINE })
    steps.push({ shown: i + 1, installed: i + 1, fading: false, wait: i === N - 1 ? FINAL : HOLD })
  }
  steps.push({ shown: N, installed: N, fading: true, wait: FADE })
  return steps
}
const TIMELINE = buildTimeline()

// 사이드백처럼 FitRoom 오버레이를 그대로 쓰는 부품의 배치(중심 x,y / 가로, 차량 사진 좌표).
const overlayOf = (p) => (p.overlayPartImage ? getPartOverlays({ imageUrl: p.overlayPartImage, category: p.category }, LAYOUT)[0] ?? null : null)

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function HeroFitShowcase({ className = '' }) {
  const [reduced] = useState(prefersReducedMotion)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reduced) return undefined
    const id = setTimeout(() => setIndex((i) => (i + 1) % TIMELINE.length), TIMELINE[index].wait)
    return () => clearTimeout(id)
  }, [index, reduced])

  const scene = reduced ? { shown: N, installed: N, fading: false } : TIMELINE[index]
  const isInstalled = (i) => i < scene.installed && !scene.fading
  const caption = scene.fading
    ? '다시 순정 상태로'
    : scene.installed === N
      ? `완성: ${HERO_BUILD.map((p) => p.label).join(' · ')}`
      : scene.installed === 0
        ? scene.shown === 0
          ? '순정 Super Cub 110'
          : `${HERO_BUILD[0].label} 장착 중...`
        : `장착: ${HERO_BUILD.slice(0, scene.installed).map((p) => p.label).join(' · ')}`

  return (
    <figure
      className={`flex w-full flex-col items-center gap-4 ${className}`}
      data-testid="hero-fit-showcase"
      data-installed={scene.installed}
      data-shown={scene.shown}
      data-fading={scene.fading}
    >
      <div
        className="relative w-full max-w-[720px] overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50"
        style={{ backgroundColor: STAGE_BG }}
      >
        <div className="relative w-full" style={{ aspectRatio: `${STAGE.width} / ${STAGE.height}` }} data-testid="hero-stage">
          <img
            src={VEHICLE_IMAGE}
            alt="Honda Super Cub 110"
            className="absolute left-0 w-full select-none"
            style={{ top: vehicleTop }}
            draggable={false}
            data-testid="hero-image"
          />
          {/* 부품 이미지는 처음부터 모두 불러두고 opacity만 바꾼다(깜빡임 없음). 겹치는 순서 = 장착 순서. */}
          {HERO_BUILD.map((p, i) => {
            const o = overlayOf(p)
            const style = o
              ? {
                  left: pct(o.x, STAGE.width),
                  top: pct(o.y + OY, STAGE.height),
                  width: pct(o.width, STAGE.width),
                  height: 'auto',
                  transform: 'translate(-50%, -50%)',
                }
              : { left: 0, top: vehicleTop, width: '100%' }
            return (
              <img
                key={p.partName}
                src={o ? o.src : p.layer}
                alt=""
                aria-hidden="true"
                className="absolute select-none transition-opacity duration-700 ease-out motion-reduce:transition-none"
                style={{ ...style, opacity: isInstalled(i) ? 1 : 0 }}
                draggable={false}
                data-testid={`hero-layer-${p.category}`}
                data-active={isInstalled(i)}
              />
            )
          })}

          {/* 장착 지점 -> 부품 이름 연결선. 차례가 된 부품만 그린다: 다음 차례 = 흰 선이 한 번 그려짐, 장착됨 = 파란 실선.
              완성 뒤에는 부품과 함께 서서히 사라진다. */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full transition-opacity ease-out"
            style={{ opacity: scene.fading ? 0 : 1, transitionDuration: `${FADE - 200}ms` }}
            viewBox={`0 0 ${STAGE.width} ${STAGE.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {HERO_BUILD.map((p, i) => {
              if (i >= scene.shown) return null
              const a = LAYOUT.anchors[p.category]
              const on = i < scene.installed
              return (
                <line
                  key={p.partName}
                  x1={a.x}
                  y1={a.y + OY}
                  x2={p.node.x}
                  y2={p.node.y + OY}
                  pathLength={1}
                  strokeDasharray="1"
                  stroke={on ? '#3B82F6' : 'rgba(255,255,255,0.75)'}
                  strokeWidth={on ? 2 : 1.5}
                  vectorEffect="non-scaling-stroke"
                  className="hero-line-draw transition-[stroke] duration-500 motion-reduce:[animation:none]"
                  data-testid={`hero-line-${p.category}`}
                  data-state={on ? 'installed' : 'next'}
                />
              )
            })}
          </svg>

          {HERO_BUILD.map((p, i) => {
            if (i >= scene.shown) return null
            const a = LAYOUT.anchors[p.category]
            const on = i < scene.installed
            return (
              <div
                key={p.partName}
                className="hero-node-in transition-opacity ease-out motion-reduce:[animation:none]"
                style={{ opacity: scene.fading ? 0 : 1, transitionDuration: `${FADE - 200}ms` }}
              >
                {/* 장착 지점 점 */}
                <span
                  aria-hidden="true"
                  className={`absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors duration-500 sm:h-4 sm:w-4 ${
                    on ? 'border-white bg-ridefit-primary' : 'border-white bg-white/30 ring-4 ring-white/15'
                  }`}
                  style={{ left: pct(a.x, STAGE.width), top: pct(a.y + OY, STAGE.height) }}
                  data-testid={`hero-anchor-${p.category}`}
                />
                {/* 부품 이름표 */}
                <span
                  className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-lg transition-colors duration-500 sm:px-3 sm:text-xs ${
                    on ? 'border-ridefit-primary bg-ridefit-primary text-white' : 'border-white/60 bg-black/75 text-white'
                  }`}
                  style={{ left: pct(p.node.x, STAGE.width), top: pct(p.node.y + OY, STAGE.height) }}
                  title={p.partName}
                  data-testid={`hero-node-${p.category}`}
                  data-state={on ? 'installed' : 'next'}
                >
                  {on && <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />}
                  {p.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <figcaption className="flex w-full max-w-[720px] flex-col items-center gap-1 text-center" data-testid="hero-caption">
        <p className="text-sm font-semibold text-ridefit-text">Super Cub 110</p>
        <p className="text-xs text-ridefit-text-secondary" data-testid="hero-build" aria-live="off">
          {caption}
        </p>
        <p className="text-[11px] text-ridefit-text-secondary/80">실제 상품 사진으로 만든 장착 예시 이미지</p>
      </figcaption>
    </figure>
  )
}

export default HeroFitShowcase
