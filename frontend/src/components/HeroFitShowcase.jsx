import { useState } from 'react'
import { VEHICLE_FIT_LAYOUTS } from '../constants/vehicleFitPositions'

// 홈 히어로 "내 바이크 꾸미기": 가운데 대표 차량(Super Cub 110), 주변 부품 카드.
// 카드를 누르면(또는 마우스를 올리면) 그 부품이 바이크에 장착된 모습으로 바뀐다 - 상품 나열이 아니라 "조합해보는" 경험.
//
// 이미지 원칙(AI 생성 결과 사용 안 함, 어색한 합성을 억지로 보여주지 않음):
//  - 실제 장착 모습은 로컬에서 만든 완성 합성 이미지만 쓴다. 지금 자연스러운 것은 머플러 하나뿐이다
//    (public/assets/hero/supercub-v2-muffler.png: 순정 머플러를 지우고 실제 상품 사진을 같은 각도로 합성, 1829x950,
//    차량 원본 위로 OY=90px 여백).
//  - 사이드백/윈드스크린(상품 사진 촬영 각도가 차량과 달라 2D 합성이 어색함 - supercub-v2-*-sidebag*.png 파일은 남겨두고 쓰지 않음),
//    리어 캐리어(3/4 각도 제품 사진이라 순정 짐대 위에 떠 보임)는 사진을 얹지 않고
//    FitRoom과 같은 방식(장착 지점 점 + "장착 이미지 준비 중")으로만 보여준다.
//  - 차량 사진과 장착 지점 좌표는 FitRoom과 같은 VEHICLE_FIT_LAYOUTS를 읽기만 한다.
const VEHICLE_IMAGE = '/assets/vehicles/super-cub-110.png'
const LAYOUT = VEHICLE_FIT_LAYOUTS[VEHICLE_IMAGE]
const OY = 90
const STAGE = { width: LAYOUT.width, height: LAYOUT.height + OY }

// composite: 이 부품이 장착된 완성 이미지(없으면 장착 이미지 준비 중). slot: 카드 위치(위/아래 줄, 대략 장착 부위 쪽).
const PARTS = [
  { key: 'carrier', category: '캐리어', name: '리어 캐리어', thumb: '/assets/parts/cub110-rear-carrier.png', slot: 'top' },
  { key: 'screen', category: '스크린', name: '윈드스크린', thumb: '/assets/parts/h2c-cub110-windscreen.png', slot: 'top' },
  {
    key: 'muffler',
    category: '머플러',
    name: '스테인리스 머플러',
    thumb: '/assets/parts/cub110-stainless-exhaust.png',
    composite: '/assets/hero/supercub-v2-muffler.png',
    slot: 'bottom',
  },
  { key: 'sidebag', category: '사이드백', name: '사이드백', thumb: '/assets/parts/saddlebag-pair-lace.png', slot: 'bottom' },
]
const DEFAULT_FITTED = ['muffler']

const pct = (v, total) => `${(v / total) * 100}%`

function PartCard({ part, fitted, focused, onToggle, onFocus, onBlur }) {
  const ready = Boolean(part.composite)
  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={onFocus}
      onMouseLeave={onBlur}
      onFocus={onFocus}
      onBlur={onBlur}
      aria-pressed={ready ? fitted : undefined}
      data-testid={`hero-part-${part.key}`}
      data-fitted={fitted}
      className={`flex min-w-0 items-center gap-2 rounded-xl border px-2 py-2 text-left transition sm:gap-3 sm:px-3 ${
        fitted
          ? 'border-ridefit-primary bg-ridefit-primary/15 shadow-[0_0_0_1px_rgba(59,130,246,0.4)]'
          : focused
            ? 'border-ridefit-primary/70 bg-ridefit-bg'
            : 'border-ridefit-border bg-ridefit-bg/80 hover:border-ridefit-primary/60'
      }`}
    >
      <img
        src={part.thumb}
        alt=""
        aria-hidden="true"
        className="h-9 w-9 shrink-0 rounded-md bg-white object-contain p-0.5 sm:h-11 sm:w-11"
        draggable={false}
      />
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-ridefit-text sm:text-sm">{part.name}</span>
        <span className={`block truncate text-[10px] sm:text-[11px] ${fitted ? 'text-ridefit-primary' : 'text-ridefit-text-secondary'}`}>
          {!ready ? '장착 이미지 준비 중' : fitted ? '✓ 장착됨 · 눌러서 빼기' : '눌러서 장착하기'}
        </span>
      </span>
    </button>
  )
}

function HeroFitShowcase({ className = '' }) {
  const [fitted, setFitted] = useState(() => new Set(DEFAULT_FITTED))
  // 마우스를 올리거나 포커스한 부품: 장착 가능하면 미리 장착된 모습으로, 아니면 장착 지점만 표시.
  const [focusedKey, setFocusedKey] = useState(null)

  const toggle = (part) => {
    if (!part.composite) {
      setFocusedKey(part.key)
      return
    }
    // 누른 뒤에는 미리보기(포커스) 대신 실제 장착 상태를 보여준다 - 모바일 탭에서 빼기가 바로 보이도록.
    setFocusedKey(null)
    setFitted((prev) => {
      const next = new Set(prev)
      next.has(part.key) ? next.delete(part.key) : next.add(part.key)
      return next
    })
  }

  const focused = PARTS.find((p) => p.key === focusedKey) ?? null
  const showComposite = (p) => p.composite && (fitted.has(p.key) || focusedKey === p.key)
  const fittedNames = PARTS.filter((p) => p.composite && fitted.has(p.key)).map((p) => p.name)
  const caption = focused && !focused.composite
    ? `${focused.name} - 장착 이미지 준비 중이에요`
    : fittedNames.length > 0
      ? `${fittedNames.join(' + ')} 장착`
      : '순정 상태'

  const row = (slot) => (
    <div className="grid w-full grid-cols-2 gap-2 sm:gap-3">
      {PARTS.filter((p) => p.slot === slot).map((p) => (
        <PartCard
          key={p.key}
          part={p}
          fitted={Boolean(p.composite) && fitted.has(p.key)}
          focused={focusedKey === p.key}
          onToggle={() => toggle(p)}
          onFocus={() => setFocusedKey(p.key)}
          onBlur={() => setFocusedKey((k) => (k === p.key ? null : k))}
        />
      ))}
    </div>
  )

  const anchor = focused && !focused.composite ? LAYOUT.anchors[focused.category] : null

  return (
    <div className={`flex w-full flex-col items-center gap-3 ${className}`} data-testid="hero-fit-showcase">
      {row('top')}

      <div className="relative w-full" style={{ aspectRatio: `${STAGE.width} / ${STAGE.height}` }} data-testid="hero-stage">
        <img
          src={VEHICLE_IMAGE}
          alt="Honda Super Cub 110"
          className="absolute left-0 w-full select-none"
          style={{ top: pct(OY, STAGE.height), height: pct(LAYOUT.height, STAGE.height) }}
          draggable={false}
        />
        {PARTS.filter((p) => p.composite).map((p) => (
          <img
            key={p.key}
            src={p.composite}
            alt=""
            aria-hidden="true"
            draggable={false}
            data-testid={`hero-composite-${p.key}`}
            data-visible={Boolean(showComposite(p))}
            className="absolute inset-0 h-full w-full select-none transition-opacity duration-500"
            style={{ opacity: showComposite(p) ? 1 : 0 }}
          />
        ))}

        {/* 장착 이미지가 없는 부품: 상품 사진을 얹지 않고 장착 지점 + 안내만 */}
        {anchor && (
          <>
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${STAGE.width} ${STAGE.height}`} preserveAspectRatio="none">
              <circle cx={anchor.x} cy={anchor.y + OY} r="12" fill="#3B82F6" />
              <circle cx={anchor.x} cy={anchor.y + OY} r="12" fill="none" stroke="#3B82F6" strokeWidth="2" vectorEffect="non-scaling-stroke">
                <animate attributeName="r" from="12" to="40" dur="1.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.9" to="0" dur="1.2s" repeatCount="indefinite" />
              </circle>
            </svg>
            <span
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full border border-ridefit-border bg-ridefit-bg/90 px-2 py-0.5 text-[10px] font-semibold text-ridefit-text shadow-lg backdrop-blur sm:text-xs"
              style={{
                left: pct(Math.min(Math.max(anchor.x, 260), STAGE.width - 260), STAGE.width),
                top: pct(anchor.y + OY - 30, STAGE.height),
              }}
              data-testid="hero-pending-label"
            >
              {focused.name} · 장착 이미지 준비 중
            </span>
          </>
        )}
      </div>

      <p className="h-5 text-center text-xs font-medium text-ridefit-text-secondary sm:text-sm" aria-live="polite" data-testid="hero-caption">
        {caption}
      </p>

      {row('bottom')}
    </div>
  )
}

export default HeroFitShowcase
