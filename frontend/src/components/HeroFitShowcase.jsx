import { Check } from 'lucide-react'
import { HERO_BUILD } from '../constants/heroBuild'

// 홈 히어로(발표용 쇼케이스): 들어오자마자 "RIDEFIT으로 꾸민 완성된 Super Cub 110"을 보여준다.
// 클릭/노드/연결선/장착 애니메이션 없음 - 직접 꾸며보기는 CTA "부품 입혀보기"(FitRoom)로 이어진다.
//
// 이미지: public/assets/hero/supercub-ai-muffler-sidebag-basket.png (473x335, AI Fit 결과 resultId=9 의 사본, 원본은 uploads/ai-fit 에 그대로)
//  - 바탕: hero/supercub-v2-muffler-sidebag.png (같은 Super Cub 110 사진 + 실제 상품 사진으로 로컬 합성한 스테인리스 머플러·사이드백 121)
//  - 그 위에 Magic Hour(flux-2-klein, 640px)로 앞바구니 118(체커 무늬를 지운 정리본 reference)만 추가 장착.
//  - AI가 직접 그린 사이드백은 두 번 다 실제 장착 방식과 달라(짐받이 위 탑백 / 바구니 안 가방) 쓰지 않았다(WORK_LOG 9차).
//  - 배경이 검정(0~4)이라 같은 검정 "스튜디오" 판 위에 둔다. 해상도가 작아(긴 변 473px) 표시 폭을 제한해 과하게 키우지 않는다.
// AI 결과를 360 Viewer/FitRoom overlay에 쓰지 않는다(Hero 쇼케이스 전용).
const HERO_IMAGE = '/assets/hero/supercub-ai-muffler-sidebag-basket.png'
const BUILD = HERO_BUILD.map((b) => b.label)

function HeroFitShowcase({ className = '' }) {
  return (
    <figure className={`flex w-full flex-col items-center gap-4 ${className}`} data-testid="hero-fit-showcase">
      <div className="relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-white/10 bg-[#020202] shadow-2xl shadow-black/50">
        <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-ridefit-text-secondary">
          RIDEFIT Custom
        </span>
        <img
          src={HERO_IMAGE}
          alt="스테인리스 머플러, 사이드백, 앞바구니를 장착한 Honda Super Cub 110"
          width={473}
          height={335}
          className="block h-auto w-full select-none"
          draggable={false}
          data-testid="hero-image"
        />
      </div>

      <figcaption className="flex w-full max-w-[560px] flex-col items-center gap-2 text-center" data-testid="hero-caption">
        <p className="text-sm font-semibold text-ridefit-text">Honda Super Cub 110 · 현재 구성</p>
        <ul className="flex flex-wrap justify-center gap-2" data-testid="hero-build">
          {BUILD.map((name) => (
            <li
              key={name}
              className="flex items-center gap-1.5 rounded-full border border-ridefit-primary/40 bg-ridefit-primary/10 px-3 py-1 text-xs font-medium text-ridefit-text"
            >
              <Check aria-hidden="true" className="h-3.5 w-3.5 text-ridefit-primary" strokeWidth={2.5} />
              {name}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-ridefit-text-secondary/80">실제 상품 사진과 AI 합성으로 만든 장착 예시 이미지</p>
      </figcaption>
    </figure>
  )
}

export default HeroFitShowcase
