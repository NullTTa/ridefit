import { useEffect, useState } from 'react'
import { VEHICLE_FIT_LAYOUTS } from '../constants/vehicleFitPositions'

// 홈 히어로 "부품 장착 쇼케이스": 대표 차량(Super Cub 110)에 부품을 하나씩 넣는 과정을 자동 재생한다.
//   기본 차량 -> (머플러 안내 -> 장착) -> (사이드백 안내 -> 장착) -> (윈드스크린 안내 -> 장착) -> 마무리 -> 반복
//
// 이미지 원칙(AI 생성 호출 없음, 가짜 합성 이미지 없음):
//  - 차량 사진과 장착점 좌표는 FitRoom과 같은 VEHICLE_FIT_LAYOUTS를 읽기만 한다(값/동작 변경 없음).
//  - 각 단계는 미리 만들어 둔 "완성 합성 이미지"(public/assets/hero/supercub-v2-*.png)로 전환한다. 세 장 모두 같은
//    차량 원본(1829x860)을 위로 OY=90px 여백을 둔 1829x950 캔버스에 같은 위치로 놓고, 프로젝트의 실제 상품 사진
//    (스테인리스 머플러 / part 121 사이드백 / part 119 H2C 윈드스크린)을 로컬 OpenCV·Pillow로 합성했다
//    (순정 머플러 제거 + 흡입구 조임 밴드, 같은 사진 속 크롬/가죽 밝기에 맞춘 재조명, 접촉 그림자, 사이드백 요크,
//    윈드스크린은 실제 고정판을 양쪽 미러 스템 뿌리에 맞춘 3/4 원근 + 헤드라이트·방향지시등·핸들 커버 앞가림).
//    뒤 단계 이미지는 앞 단계 위에 부품만
//    더 얹은 것이라 차량/앞 부품 픽셀이 동일하다(AI 생성 없음). 여백은 실제 높이의 윈드스크린이 잘리지 않게 하기 위함.
const VEHICLE_IMAGE = '/assets/vehicles/super-cub-110.png'
const LAYOUT = VEHICLE_FIT_LAYOUTS[VEHICLE_IMAGE]
// 무대(합성 이미지) 크기: 차량 사진 위로 OY 만큼 여백. 라벨/점 좌표는 무대 기준(= 차량 좌표 + OY).
const OY = 90
const STAGE = { width: LAYOUT.width, height: LAYOUT.height + OY }

// category: FitRoom 좌표 키 / thumb: 실제 상품 사진(하단 부품 칩) / composite: 이 단계까지 장착된 완성 이미지
// label: 안내 라벨 위치(차량 사진 픽셀 좌표) - 차량 몸체를 가리지 않는 여백 쪽으로 둔다.
// anchor: (선택) 가이드 점 위치(차량 사진 픽셀 좌표). 없으면 FitRoom 좌표(LAYOUT.anchors[category])를 쓴다.
const STEPS = [
  {
    key: 'muffler',
    category: '머플러',
    name: '머플러',
    prompt: '머플러를 넣어보세요',
    thumb: '/assets/parts/cub110-stainless-exhaust.png',
    composite: '/assets/hero/supercub-v2-muffler.png',
    label: { x: 250, y: 790 },
  },
  {
    key: 'sidebag',
    category: '사이드백',
    name: '사이드백',
    prompt: '사이드백도 넣어보세요',
    thumb: '/assets/parts/saddlebag-pair-lace.png',
    composite: '/assets/hero/supercub-v2-muffler-sidebag.png',
    // FitRoom 사이드백 장착점은 테일램프 근처라, Hero에서만 합성 이미지 속 가방 가운데를 가리키게 한다.
    anchor: { x: 470, y: 425 },
    label: { x: 250, y: 230 },
  },
  {
    key: 'screen',
    category: '스크린',
    name: '윈드스크린',
    prompt: '윈드스크린도 추가해보세요',
    thumb: '/assets/parts/h2c-cub110-windscreen.png',
    composite: '/assets/hero/supercub-v2-muffler-sidebag-windscreen.png',
    // FitRoom의 스크린 장착점(헤드라이트 오른쪽 아래)은 합성 이미지의 실제 윈드스크린 위치와 달라서,
    // Hero에서만 합성 이미지 속 윈드스크린 면을 가리키게 한다(FitRoom 좌표는 그대로).
    anchor: { x: 1040, y: 25 },
    label: { x: 1560, y: 40 },
  },
]

// 재생 순서. step: 지금 다루는 부품(-1 = 아직 없음), phase: intro | guide | fit | final | reset
const TIMELINE = [
  { step: -1, phase: 'intro', ms: 1900 },
  ...STEPS.flatMap((_, i) => [
    { step: i, phase: 'guide', ms: 1500 },
    { step: i, phase: 'fit', ms: 1700 },
  ]),
  { step: STEPS.length - 1, phase: 'final', ms: 3000 },
  { step: -1, phase: 'reset', ms: 700 },
]

const CAPTION = {
  intro: '원하는 부품을 넣어보세요.',
  final: '내 바이크에 직접 장착해보세요.',
}

const pct = (v, total) => `${(v / total) * 100}%`
const stageAnchor = (s) => {
  const a = s.anchor ?? LAYOUT.anchors[s.category]
  return { x: a.x, y: a.y + OY }
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e) => setReduced(e.matches)
    q.addEventListener('change', onChange)
    return () => q.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function HeroFitShowcase({ className = '' }) {
  const reducedMotion = usePrefersReducedMotion()
  const [ready, setReady] = useState(false)
  const [tick, setTick] = useState(0)

  // 차량 사진이 뜬 뒤에 시작한다(로딩이 늦어도 3초 뒤엔 시작 - 무한 대기 방지).
  useEffect(() => {
    let done = false
    const start = () => { if (!done) { done = true; setReady(true) } }
    const img = new Image()
    img.onload = start
    img.onerror = start
    img.src = VEHICLE_IMAGE
    // 완성 합성 이미지도 미리 받아 둔다(첫 전환 때 늦게 뜨지 않도록).
    STEPS.forEach((s) => { if (s.composite) new Image().src = s.composite })
    const t = setTimeout(start, 3000)
    return () => { done = true; clearTimeout(t) }
  }, [])

  useEffect(() => {
    if (!ready || reducedMotion) return
    const id = setTimeout(() => setTick((t) => (t + 1) % TIMELINE.length), TIMELINE[tick].ms)
    return () => clearTimeout(id)
  }, [ready, reducedMotion, tick])

  // 움직임을 줄이는 설정이면 최종 상태만 정지 화면으로 보여준다.
  const frame = reducedMotion ? { step: STEPS.length - 1, phase: 'final' } : TIMELINE[tick]
  const isFitted = (i) => frame.phase !== 'reset' && frame.phase !== 'intro'
    && (i < frame.step || (i === frame.step && frame.phase !== 'guide'))
  const activeStep = frame.phase === 'guide' || frame.phase === 'fit' ? STEPS[frame.step] : null

  const caption = activeStep
    ? (frame.phase === 'guide' ? activeStep.prompt : `${activeStep.name} 장착`)
    : (CAPTION[frame.phase] ?? CAPTION.intro)

  return (
    <div className={`flex w-full flex-col items-center ${className}`} data-testid="hero-fit-showcase" data-phase={frame.phase} data-step={frame.step}>
      {/* 단계 안내 문구 - 이미지와 겹치지 않게 무대 위에 따로 둔다 */}
      <p className="mb-3 h-7 text-center text-base font-semibold text-ridefit-text transition-opacity duration-300 sm:text-lg" aria-live="polite" data-testid="hero-caption">
        {caption}
      </p>

      <div
        className={`relative w-full transition-opacity duration-500 ${ready && frame.phase !== 'reset' ? 'opacity-100' : 'opacity-0'}`}
        style={{ aspectRatio: `${STAGE.width} / ${STAGE.height}` }}
      >
        <img
          src={VEHICLE_IMAGE}
          alt="Honda Super Cub 110"
          className="absolute left-0 w-full select-none"
          style={{ top: pct(OY, STAGE.height), height: pct(LAYOUT.height, STAGE.height) }}
          draggable={false}
        />

        {/* 완성 합성 이미지: 장착된 단계의 이미지는 계속 보이고(뒤 단계가 위에 쌓임), 새 단계만 서서히 나타난다 */}
        {STEPS.map((s, i) => s.composite && (
          <img
            key={`composite-${s.key}`}
            src={s.composite}
            alt=""
            aria-hidden="true"
            draggable={false}
            data-testid={`hero-composite-${s.key}`}
            data-visible={isFitted(i)}
            className="absolute inset-0 z-[25] h-full w-full select-none transition-opacity duration-700"
            style={{ opacity: isFitted(i) ? 1 : 0 }}
          />
        ))}

        {/* 가이드 라인(지금 단계) + 장착 위치 점 */}
        <svg className="pointer-events-none absolute inset-0 z-30 h-full w-full" viewBox={`0 0 ${STAGE.width} ${STAGE.height}`} preserveAspectRatio="none">
          {STEPS.map((s, i) => {
            const a = stageAnchor(s)
            const ly = s.label.y + OY
            const active = activeStep?.key === s.key
            const len = Math.hypot(s.label.x - a.x, ly - a.y)
            return (
              <g key={s.key} style={{ opacity: active || isFitted(i) ? 1 : 0, transition: 'opacity 400ms' }}>
                <line
                  x1={a.x} y1={a.y} x2={s.label.x} y2={ly}
                  stroke="#3B82F6" strokeWidth="1.5" strokeOpacity={active ? 0.9 : 0.35}
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray={len}
                  strokeDashoffset={active || isFitted(i) ? 0 : len}
                  style={{ transition: 'stroke-dashoffset 700ms ease-out, stroke-opacity 400ms' }}
                />
                <circle cx={a.x} cy={a.y} r={active ? 13 : 9} fill="#3B82F6" fillOpacity={active ? 1 : 0.7} style={{ transition: 'r 300ms' }} />
                {active && frame.phase === 'guide' && (
                  <circle cx={a.x} cy={a.y} r="13" fill="none" stroke="#3B82F6" strokeWidth="2" vectorEffect="non-scaling-stroke">
                    <animate attributeName="r" from="13" to="42" dur="1.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.9" to="0" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            )
          })}
        </svg>

        {/* 부품 이름표(라인 끝) */}
        {STEPS.map((s, i) => {
          const active = activeStep?.key === s.key
          const fitted = isFitted(i)
          return (
            <span
              key={`label-${s.key}`}
              className={`pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-lg backdrop-blur transition-all duration-300 sm:px-2.5 sm:text-xs ${
                active ? 'border-ridefit-primary bg-ridefit-primary text-white' : 'border-ridefit-border bg-ridefit-bg/85 text-ridefit-text'
              }`}
              style={{ left: pct(s.label.x, STAGE.width), top: pct(s.label.y + OY, STAGE.height), opacity: active || fitted ? 1 : 0 }}
              data-testid={`hero-label-${s.key}`}
            >
              {fitted ? '✓ ' : ''}
              {s.name}
            </span>
          )
        })}
      </div>

      {/* 넣어볼 부품(실제 상품 사진) - 장착된 것은 체크, 지금 단계는 강조 */}
      <ol className="mt-4 flex w-full max-w-md justify-center gap-1.5 sm:gap-3" data-testid="hero-part-chips">
        {STEPS.map((s, i) => {
          const active = activeStep?.key === s.key
          const fitted = isFitted(i)
          return (
            <li
              key={s.key}
              className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border px-1.5 py-1.5 transition-colors duration-300 sm:gap-2 sm:px-2 ${
                active ? 'border-ridefit-primary bg-ridefit-primary/10' : fitted ? 'border-ridefit-border bg-ridefit-card' : 'border-ridefit-border/60 bg-ridefit-card/60'
              }`}
            >
              <img src={s.thumb} alt="" aria-hidden="true" className="h-6 w-6 shrink-0 rounded bg-white object-contain p-0.5 sm:h-8 sm:w-8" />
              <span className={`min-w-0 truncate text-[11px] font-medium sm:text-xs ${active || fitted ? 'text-ridefit-text' : 'text-ridefit-text-secondary'}`}>
                {fitted ? '✓ ' : ''}
                {s.name}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default HeroFitShowcase
