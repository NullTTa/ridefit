import { useEffect, useRef, useState } from 'react'
import { HERO_ANIMATION_IMAGE } from '../constants/images'

// 히어로 "부품 설계도(블루프린트)" 애니메이션.
//
// 연출 순서 (2026-09-22 개편): 차량이 완전히 로드되어 안정적으로 보인 뒤에야 지시선 연출이 시작되고,
// 매번 "부품 하나"만 지목한다 - 선/이름표가 뜨는 동시에 그 부품의 실제 사진이 차량 위 그 자리에
// 크게 나타나서(크로스페이드) "부품이 바뀌는" 느낌을 준다. 이건 픽셀 단위로 차량 사진에 합성하는 게
// 아니라, 지목한 자리에 실제 부품 사진을 크게 띄우는 방식이다 - 진짜 3D/AI 합성은 아니지만
// 지금 가진 실제 사진만으로 "이 부품이 이렇게 바뀐다"를 눈으로 보여주는 절충안이다.
//
// 무엇이 이미지이고 무엇이 코드인가:
//  - 이미지(실제 파일): 차량 사진 1장(HERO_ANIMATION_IMAGE) + 실제로 확보된 부품 사진 3장.
//    투명 배경으로 안 만들어진(배경 있는) 상품샷이라, 차량에 픽셀로 겹치는 대신 원형 카드로
//    깔끔하게 잘라서 보여준다 - 배경을 억지로 지우거나 AI로 새로 만들지 않았다.
//  - 코드: 격자 배경/모서리(CSS), 지시선(SVG), 포인트/이름표/부품 카드(HTML+CSS transition).
//
// 좌표계: STAGE(가상 캔버스) 안에 사진을 놓고, 부품 위치는 "사진 픽셀 좌표(IMG)"로 적은 뒤 STAGE 좌표로 변환한다.
const STAGE = { w: 2200, h: 1160 }
const IMG = { w: 1829, h: 860, x: 185, y: 150 } // STAGE 안에서 사진이 놓이는 자리

// 실제 확보된 부품 사진이 있는 3개만 다룬다(요청대로 파츠 수를 늘리지 않음).
// px/py: 사진 위 부품 위치(사진 픽셀), lx: 이름표의 가로 위치(STAGE), side: 이름표가 위/아래 어느 쪽인지.
const POINTS = [
  { name: '머플러', px: 520, py: 645, lx: 620, side: 'bottom', image: '/assets/parts/cub110-stainless-exhaust.png' },
  { name: '캐리어', px: 400, py: 325, lx: 500, side: 'top', image: '/assets/parts/cub110-rear-carrier.png' },
  { name: '미러', px: 1200, py: 45, lx: 1900, side: 'top', image: '/assets/parts/cub110-mirror.png' },
]
const TOP_Y = 150 // 위쪽 이름표 지시선 끝 (STAGE y)
const BOTTOM_Y = 1015 // 아래쪽 이름표 지시선 끝

const SETTLE_MS = 1300 // 차량이 다 뜬 뒤, 지시 연출을 시작하기 전 "차량만" 보여주는 시간
const CYCLE_MS = 4800 // 부품 1개당 순환 주기 - 눈으로 인식할 시간을 넉넉히 준다
const LOAD_TIMEOUT_MS = 4000 // 이미지 로딩이 안 끝나도 이 시간 뒤엔 그냥 시작한다(무한 대기 방지)

const pct = (value, total) => `${(value / total) * 100}%`

const callouts = POINTS.map((p, i) => {
  const x = IMG.x + p.px
  const y = IMG.y + p.py
  const endY = p.side === 'top' ? TOP_Y : BOTTOM_Y
  return { ...p, x, y, endY, index: String(i + 1).padStart(2, '0') }
})

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (e) => setReduced(e.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return reduced
}

// 주어진 이미지들이 전부 로드(성공/실패 무관하게 "정착")될 때까지 기다린다.
// 하나라도 영영 안 끝나면 애니메이션이 멈춰버리니, LOAD_TIMEOUT_MS 뒤엔 강제로 준비 완료 처리한다.
function useImagesReady(urls) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    let settledCount = 0
    const markSettled = () => {
      settledCount += 1
      if (settledCount >= urls.length && !cancelled) setReady(true)
    }

    const images = urls.map((url) => {
      const img = new Image()
      img.onload = markSettled
      img.onerror = markSettled
      img.src = url
      return img
    })

    const timeout = setTimeout(() => !cancelled && setReady(true), LOAD_TIMEOUT_MS)

    return () => {
      cancelled = true
      clearTimeout(timeout)
      images.forEach((img) => {
        img.onload = null
        img.onerror = null
      })
    }
  }, [urls])

  return ready
}

function VehicleHighlightAnimation() {
  const reducedMotion = usePrefersReducedMotion()
  const preloadUrls = useRef([HERO_ANIMATION_IMAGE, ...POINTS.map((p) => p.image)]).current
  const assetsReady = useImagesReady(preloadUrls)

  const [vehicleVisible, setVehicleVisible] = useState(false)
  const [activeIndex, setActiveIndex] = useState(null) // null = 아직 차량만 보여주는 단계

  // 차량 사진 자체는 <img onLoad>로 실제 로드 시점에 맞춰 나타난다(고정 타이머로 추측하지 않음).
  const handleVehicleLoad = () => setVehicleVisible(true)

  useEffect(() => {
    if (reducedMotion) {
      setActiveIndex(0)
      return
    }
    if (!assetsReady || !vehicleVisible) return

    // 차량이 자리 잡은 뒤 잠깐 "차량만" 보여주고서 첫 부품을 지목한다.
    const startTimer = setTimeout(() => setActiveIndex(0), SETTLE_MS)
    return () => clearTimeout(startTimer)
  }, [assetsReady, vehicleVisible, reducedMotion])

  useEffect(() => {
    if (reducedMotion || activeIndex === null) return
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % callouts.length)
    }, CYCLE_MS)
    return () => clearInterval(timer)
  }, [activeIndex, reducedMotion])

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden p-4 sm:p-8">
      <div
        className="relative w-full max-w-3xl"
        style={{ aspectRatio: `${STAGE.w} / ${STAGE.h}` }}
        role="img"
        aria-label="차량 부품 위치 설계도"
      >
        {/* 격자 배경 + 은은한 중앙 광원 - 차량 로딩과 무관하게 무대부터 먼저 자리 잡는다 */}
        <div
          className="bp-fade absolute inset-0 rounded-lg border border-ridefit-primary/20"
          style={{
            '--d': '0s',
            backgroundImage:
              'radial-gradient(ellipse at 50% 55%, rgba(59,130,246,0.12), transparent 65%),' +
              'linear-gradient(rgba(59,130,246,0.09) 1px, transparent 1px),' +
              'linear-gradient(90deg, rgba(59,130,246,0.09) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 5% 9.5%, 3.4% 5.6%',
          }}
          aria-hidden="true"
        />

        {/* 모서리 표시 */}
        {[
          'left-2 top-2 border-l border-t',
          'right-2 top-2 border-r border-t',
          'bottom-2 left-2 border-b border-l',
          'bottom-2 right-2 border-b border-r',
        ].map((position) => (
          <span
            key={position}
            className={`bp-fade absolute h-3 w-3 border-ridefit-primary/60 ${position}`}
            style={{ '--d': '0.2s' }}
            aria-hidden="true"
          />
        ))}

        {/* 차량 사진: 고정 타이머가 아니라 실제 onLoad 시점에 맞춰 나타난다(윤곽선은 CSS 필터) */}
        <img
          src={HERO_ANIMATION_IMAGE}
          alt=""
          draggable={false}
          onLoad={handleVehicleLoad}
          className="absolute select-none"
          style={{
            opacity: reducedMotion || vehicleVisible ? 1 : 0,
            transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
            transform: reducedMotion || vehicleVisible ? 'scale(1)' : 'scale(0.985)',
            left: pct(IMG.x, STAGE.w),
            top: pct(IMG.y, STAGE.h),
            width: pct(IMG.w, STAGE.w),
            height: pct(IMG.h, STAGE.h),
            filter:
              'brightness(1.35) contrast(1.05) drop-shadow(1px 0 0 rgba(96,165,250,0.85)) drop-shadow(-1px 0 0 rgba(96,165,250,0.85)) drop-shadow(0 1px 0 rgba(96,165,250,0.85)) drop-shadow(0 -1px 0 rgba(96,165,250,0.85))',
          }}
        />

        {/* 지시선: 이번에 지목한 부품 하나만 그려진다 */}
        <svg
          viewBox={`0 0 ${STAGE.w} ${STAGE.h}`}
          className="absolute inset-0 h-full w-full"
          fill="none"
          aria-hidden="true"
        >
          {callouts.map((c, i) => {
            const isActive = activeIndex === i
            return (
              <path
                key={c.name}
                d={`M ${c.x} ${c.y} L ${c.lx} ${c.endY}`}
                pathLength="1"
                stroke="rgba(147,197,253,0.85)"
                strokeWidth="4"
                strokeLinecap="round"
                className="bp-cycle-line"
                style={{ strokeDashoffset: isActive ? 0 : 1, opacity: isActive ? 1 : 0 }}
              />
            )
          })}
        </svg>

        {/* 포인트 + 맥동 링 + 이름표 + "부품이 바뀌는" 실사진 카드 */}
        {callouts.map((c, i) => {
          const isActive = activeIndex === i
          return (
            <div key={c.name}>
              {isActive && !reducedMotion && (
                <span
                  className="bp-ring pointer-events-none absolute h-2.5 w-2.5 rounded-full border border-ridefit-primary"
                  style={{ left: pct(c.x, STAGE.w), top: pct(c.y, STAGE.h) }}
                />
              )}
              <span
                className="bp-cycle-fade pointer-events-none absolute h-2.5 w-2.5 rounded-full bg-ridefit-primary ring-2 ring-ridefit-bg"
                style={{
                  left: pct(c.x, STAGE.w),
                  top: pct(c.y, STAGE.h),
                  opacity: isActive ? 1 : 0,
                  transform: `translate(-50%, -50%) scale(${isActive ? 1 : 0.4})`,
                  '--cd': '0ms',
                }}
              />
              <span
                className="bp-cycle-fade pointer-events-none absolute flex items-center gap-1.5 whitespace-nowrap rounded border border-ridefit-primary/40 bg-ridefit-bg/85 px-1.5 py-0.5 text-[10px] font-medium text-ridefit-text backdrop-blur sm:px-2 sm:text-xs"
                style={{
                  left: pct(c.lx, STAGE.w),
                  top: pct(c.endY, STAGE.h),
                  opacity: isActive ? 1 : 0,
                  transform: `translate(-50%, ${c.side === 'top' ? '-100%' : '0%'}) translateY(${isActive ? 0 : 6}px)`,
                  // 나타날 땐 선/점 다음에 살짝 늦게(캐스케이드), 사라질 땐 지연 없이 다 같이 - 안 그러면
                  // 다음 부품으로 넘어갈 때 이전 이름표만 늦게까지 남아있는 것처럼 보인다.
                  '--cd': isActive ? '250ms' : '0ms',
                }}
              >
                <span className="font-mono text-[9px] text-ridefit-primary sm:text-[10px]">{c.index}</span>
                {c.name}
              </span>

              {/* 부품 실사진 카드 - 지목한 자리 바로 위에 크게 뜬다("부품이 바뀐다"는 인상의 핵심) */}
              <span
                className="bp-cycle-fade pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-2 border-ridefit-primary bg-white shadow-[0_0_24px_rgba(59,130,246,0.45)]"
                style={{
                  left: pct(c.x, STAGE.w),
                  top: pct(c.y, STAGE.h),
                  width: '13%',
                  aspectRatio: '1 / 1',
                  opacity: isActive ? 1 : 0,
                  transform: `translate(-50%, -50%) scale(${isActive ? 1 : 0.6})`,
                  '--cd': isActive ? '150ms' : '0ms',
                }}
              >
                <img src={c.image} alt={c.name} className="h-full w-full object-cover" draggable={false} />
              </span>
            </div>
          )
        })}

        {/* 도면 표제란 */}
        <div
          className="bp-fade absolute bottom-1.5 right-4 max-sm:hidden font-mono text-[9px] uppercase tracking-widest text-ridefit-primary/70 sm:text-[10px]"
          style={{ '--d': '1.2s' }}
        >
          RIDEFIT · PART MAP
        </div>
      </div>
    </div>
  )
}

export default VehicleHighlightAnimation
