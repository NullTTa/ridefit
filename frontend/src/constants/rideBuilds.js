// RIDEFIT에서 만든 장착 이미지(부품 입혀보기/Hero 결과)와 그 구성. 커뮤니티 글에 이 이미지가 붙어 있으면
// 카드에서 "RIDEFIT 장착 미리보기" 배지와 구성(차량 · 부품)을 함께 보여준다. 실제로 만든 이미지만 등록한다.
export const RIDEFIT_BUILD_IMAGES = {
  // AI 장착 결과 #9(머플러·사이드백 로컬 합성본 위에 앞바구니 118 장착)의 사본 - Hero 완성 모습과 같은 구성
  '/assets/hero/supercub-ai-muffler-sidebag-basket.png': {
    vehicle: 'Super Cub 110',
    parts: ['스테인리스 머플러', '앞바구니', '사이드백'],
  },
}

export function rideBuildOf(imageUrl) {
  return (imageUrl && RIDEFIT_BUILD_IMAGES[imageUrl]) || null
}
