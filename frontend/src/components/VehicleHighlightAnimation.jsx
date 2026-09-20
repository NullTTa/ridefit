import { HERO_ANIMATION_IMAGE } from '../constants/images'

// 히어로 "부품 설계도(블루프린트)" 애니메이션.
//
// 무엇이 이미지이고 무엇이 코드인가:
//  - 이미지(실제 파일): HERO_ANIMATION_IMAGE 하나뿐 - 투명 배경 Super Cub 110 측면 사진(1829x860).
//    이 사진에 CSS drop-shadow 필터로 푸른 윤곽선을 둘러 "도면 외곽선"처럼 보이게 한다(별도 이미지 없음).
//  - 코드: 격자 배경(CSS gradient), 모서리 표시(CSS border), 지시선(SVG path, stroke 애니메이션),
//    포인트/맥동 링(CSS), 부품 이름표(HTML) - 전부 코드로 그려서 이미지 파일이 필요 없다.
//
// 좌표계: STAGE(가상 캔버스) 안에 사진을 놓고, 부품 위치는 "사진 픽셀 좌표(IMG)"로 적은 뒤 STAGE 좌표로 변환한다.
// 사진을 다른 차량으로 바꾸면 constants/images.js의 경로와 아래 IMG 크기/POINTS 좌표를 함께 다시 맞춘다.
const STAGE = { w: 2200, h: 1160 }
const IMG = { w: 1829, h: 860, x: 185, y: 150 } // STAGE 안에서 사진이 놓이는 자리

// px/py: 사진 위 부품 위치(사진 픽셀), lx: 이름표의 가로 위치(STAGE), side: 이름표가 위/아래 어느 쪽인지.
// mobile: 좁은 화면에서도 보여줄 항목 (이름표가 겹치지 않도록 일부만)
const POINTS = [
  { name: '캐리어', px: 400, py: 325, lx: 500, side: 'top', mobile: true },
  { name: '시트', px: 720, py: 330, lx: 860, side: 'top' },
  { name: '레버', px: 930, py: 190, lx: 1210, side: 'top', mobile: true },
  { name: '헤드라이트', px: 1140, py: 160, lx: 1560, side: 'top' },
  { name: '미러', px: 1200, py: 45, lx: 1900, side: 'top', mobile: true },
  { name: '머플러', px: 520, py: 645, lx: 620, side: 'bottom', mobile: true },
  { name: '엔진', px: 860, py: 635, lx: 960, side: 'bottom' },
  { name: '서스펜션', px: 1230, py: 580, lx: 1290, side: 'bottom' },
  { name: '브레이크', px: 1290, py: 690, lx: 1640, side: 'bottom', mobile: true },
]
const TOP_Y = 150 // 위쪽 이름표 지시선 끝 (STAGE y)
const BOTTOM_Y = 1015 // 아래쪽 이름표 지시선 끝
const START = 0.9 // 첫 지시선이 그려지기 시작하는 시간(초)
const STEP = 0.42 // 항목 간 간격(초)

const pct = (value, total) => `${(value / total) * 100}%`

const callouts = POINTS.map((p, i) => {
  const x = IMG.x + p.px
  const y = IMG.y + p.py
  const endY = p.side === 'top' ? TOP_Y : BOTTOM_Y
  return { ...p, x, y, endY, index: String(i + 1).padStart(2, '0'), delay: START + i * STEP }
})

function VehicleHighlightAnimation() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden p-4 sm:p-8">
      <div
        className="relative w-full max-w-3xl"
        style={{ aspectRatio: `${STAGE.w} / ${STAGE.h}` }}
        role="img"
        aria-label="차량 부품 위치 설계도"
      >
        {/* 격자 배경 + 은은한 중앙 광원 */}
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

        {/* 차량 사진 (윤곽선은 CSS 필터) */}
        <img
          src={HERO_ANIMATION_IMAGE}
          alt=""
          draggable={false}
          className="bp-fade absolute select-none"
          style={{
            '--d': '0.3s',
            left: pct(IMG.x, STAGE.w),
            top: pct(IMG.y, STAGE.h),
            width: pct(IMG.w, STAGE.w),
            height: pct(IMG.h, STAGE.h),
            filter:
              'brightness(1.35) contrast(1.05) drop-shadow(1px 0 0 rgba(96,165,250,0.85)) drop-shadow(-1px 0 0 rgba(96,165,250,0.85)) drop-shadow(0 1px 0 rgba(96,165,250,0.85)) drop-shadow(0 -1px 0 rgba(96,165,250,0.85))',
          }}
        />

        {/* 지시선 */}
        <svg
          viewBox={`0 0 ${STAGE.w} ${STAGE.h}`}
          className="absolute inset-0 h-full w-full"
          fill="none"
          aria-hidden="true"
        >
          {callouts.map((c) => (
            <path
              key={c.name}
              d={`M ${c.x} ${c.y} L ${c.lx} ${c.endY}`}
              pathLength="1"
              stroke="rgba(147,197,253,0.85)"
              strokeWidth="4"
              strokeLinecap="round"
              className={`bp-line ${c.mobile ? '' : 'max-sm:hidden'}`}
              style={{ '--d': `${c.delay}s` }}
            />
          ))}
        </svg>

        {/* 포인트 + 맥동 링 + 이름표 */}
        {callouts.map((c) => (
          <div key={c.name} className={c.mobile ? '' : 'max-sm:hidden'}>
            <span
              className="bp-ring pointer-events-none absolute h-2.5 w-2.5 rounded-full border border-ridefit-primary"
              style={{ '--d': `${c.delay}s`, left: pct(c.x, STAGE.w), top: pct(c.y, STAGE.h) }}
            />
            <span
              className="bp-dot pointer-events-none absolute h-2.5 w-2.5 rounded-full bg-ridefit-primary ring-2 ring-ridefit-bg"
              style={{ '--d': `${c.delay}s`, left: pct(c.x, STAGE.w), top: pct(c.y, STAGE.h) }}
            />
            <span
              className="bp-label pointer-events-none absolute flex items-center gap-1.5 whitespace-nowrap rounded border border-ridefit-primary/40 bg-ridefit-bg/85 px-1.5 py-0.5 text-[10px] font-medium text-ridefit-text backdrop-blur sm:px-2 sm:text-xs"
              style={{
                '--d': `${c.delay}s`,
                '--tx': '-50%',
                '--ty': c.side === 'top' ? '-100%' : '0%',
                left: pct(c.lx, STAGE.w),
                top: pct(c.endY, STAGE.h),
              }}
            >
              <span className="font-mono text-[9px] text-ridefit-primary sm:text-[10px]">{c.index}</span>
              {c.name}
            </span>
          </div>
        ))}

        {/* 도면 표제란 */}
        <div
          className="bp-fade absolute bottom-1.5 right-4 max-sm:hidden font-mono text-[9px] uppercase tracking-widest text-ridefit-primary/70 sm:text-[10px]"
          style={{ '--d': `${START + POINTS.length * STEP}s` }}
        >
          RIDEFIT · PART MAP
        </div>
      </div>
    </div>
  )
}

export default VehicleHighlightAnimation
