import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { HERO_BUILD } from '../constants/heroBuild'
import { VEHICLE_FIT_LAYOUTS } from '../constants/vehicleFitPositions'

// 홈 히어로: 순정 Super Cub 110 + 장착 지점 노드 2개(머플러, 사이드백).
// 노드를 누르면 그 부품이 차량에 장착된 모습으로 바뀌고, 다시 누르면 빠진다. 여러 개를 함께 켤 수 있다.
// 자동 장착/반복 애니메이션/hover 장착 없음 - 사용자가 직접 눌러야만 바뀐다.
//
// 이미지(새로 그린 픽셀 없음)
//  - 차량: vehicles/super-cub-110.png 그대로. 장착 지점 좌표는 FitRoom과 같은 VEHICLE_FIT_LAYOUTS를 읽기만 한다.
//  - 부품: heroBuild.js의 layer(기존 로컬 합성 이미지에서 원본과 달라진 픽셀만 떼어낸 같은 캔버스 크기의 투명 PNG).
//    순정 머플러를 지운 자리 등 "덮어서만은 표현 못 하는" 픽셀은 무대 배경색(STAGE_BG) 위에 합성해 둔 값이라,
//    무대 배경색을 바꾸면 레이어도 다시 만들어야 한다(WORK_LOG 11차).
//  - 예전 정적 Hero 이미지(hero/supercub-ai-muffler-sidebag-basket.png)는 파일만 남겨두고 쓰지 않는다.
const VEHICLE_IMAGE = '/assets/vehicles/super-cub-110.png'
const LAYOUT = VEHICLE_FIT_LAYOUTS[VEHICLE_IMAGE]
const STAGE_BG = '#020202'
// 차량 사진(1829x860, 미러 끝이 사진 맨 위)을 무대 위에서 OY만큼 내려 테두리에 닿지 않게 하고, 아래에는 머플러 노드 자리를 둔다.
// 좌표(장착 지점/노드)는 모두 차량 사진 좌표 + OY.
const OY = 50
const PAD_BOTTOM = 175
const STAGE = { width: LAYOUT.width, height: OY + LAYOUT.height + PAD_BOTTOM }
const vehicleTop = `${(OY / STAGE.height) * 100}%`

const pct = (v, total) => `${(v / total) * 100}%`

function HeroFitShowcase({ className = '' }) {
  // FitRoom과 같은 방식: 장착 중인 부품 묶음(Set). Hero에는 DB id가 없어서 HERO_BUILD의 partName을 키로 쓴다.
  const [activePartIds, setActivePartIds] = useState(() => new Set())

  const toggle = (partName) =>
    setActivePartIds((prev) => {
      const next = new Set(prev)
      if (next.has(partName)) next.delete(partName)
      else next.add(partName)
      return next
    })

  const fitted = HERO_BUILD.filter((p) => activePartIds.has(p.partName))

  return (
    <figure className={`flex w-full flex-col items-center gap-4 ${className}`} data-testid="hero-fit-showcase">
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
          {/* 레이어는 처음부터 모두 불러두고 opacity만 바꾼다(켜는 순간 깜빡임 없음). 머플러 -> 사이드백 순서 고정. */}
          {HERO_BUILD.map((p) => (
            <img
              key={p.partName}
              src={p.layer}
              alt=""
              aria-hidden="true"
              className="absolute left-0 w-full select-none transition-opacity duration-500 ease-out motion-reduce:transition-none"
              style={{ top: vehicleTop, opacity: activePartIds.has(p.partName) ? 1 : 0 }}
              draggable={false}
              data-testid={`hero-layer-${p.category}`}
              data-active={activePartIds.has(p.partName)}
            />
          ))}

          {/* 장착 지점 -> 부품 이름 연결선. 기본은 옅은 점선, 장착하면 실선으로 강조. */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 ${STAGE.width} ${STAGE.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {HERO_BUILD.map((p) => {
              const a = LAYOUT.anchors[p.category]
              const on = activePartIds.has(p.partName)
              return (
                <line
                  key={p.partName}
                  x1={a.x}
                  y1={a.y + OY}
                  x2={p.node.x}
                  y2={p.node.y + OY}
                  stroke={on ? '#3B82F6' : 'rgba(255,255,255,0.45)'}
                  strokeWidth={on ? 2 : 1.25}
                  strokeDasharray={on ? 'none' : '4 4'}
                  vectorEffect="non-scaling-stroke"
                  className="transition-all duration-300"
                  data-testid={`hero-line-${p.category}`}
                />
              )
            })}
          </svg>

          {HERO_BUILD.map((p) => {
            const a = LAYOUT.anchors[p.category]
            const on = activePartIds.has(p.partName)
            return (
              <div key={p.partName}>
                {/* 장착 지점 점(누르면 같은 동작) */}
                <button
                  type="button"
                  onClick={() => toggle(p.partName)}
                  aria-label={`${p.label} ${on ? '빼기' : '장착하기'}`}
                  className={`absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors duration-300 sm:h-4 sm:w-4 ${
                    on ? 'border-white bg-ridefit-primary' : 'border-white/80 bg-white/20 hover:bg-white/40'
                  }`}
                  style={{ left: pct(a.x, STAGE.width), top: pct(a.y + OY, STAGE.height) }}
                  tabIndex={-1}
                  data-testid={`hero-anchor-${p.category}`}
                />
                {/* 부품 이름 노드 */}
                <button
                  type="button"
                  onClick={() => toggle(p.partName)}
                  aria-pressed={on}
                  className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-lg transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ridefit-primary sm:px-3 sm:text-xs ${
                    on
                      ? 'border-ridefit-primary bg-ridefit-primary text-white'
                      : 'border-white/30 bg-black/70 text-white hover:border-ridefit-primary'
                  }`}
                  style={{ left: pct(p.node.x, STAGE.width), top: pct(p.node.y + OY, STAGE.height) }}
                  title={p.partName}
                  data-testid={`hero-node-${p.category}`}
                >
                  {on ? (
                    <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
                  ) : (
                    <Plus aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
                  )}
                  {p.label}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <figcaption className="flex w-full max-w-[720px] flex-col items-center gap-1 text-center" data-testid="hero-caption">
        <p className="text-sm font-semibold text-ridefit-text">Super Cub 110</p>
        <p className="text-xs text-ridefit-text-secondary" data-testid="hero-build">
          {fitted.length > 0 ? `장착: ${fitted.map((p) => p.label).join(' · ')}` : '부품 이름을 눌러 장착해보세요'}
        </p>
        <p className="text-[11px] text-ridefit-text-secondary/80">실제 상품 사진으로 만든 장착 예시 이미지</p>
      </figcaption>
    </figure>
  )
}

export default HeroFitShowcase
