// 서버(PartPopularityService)가 실제 데이터를 기준으로 계산해서 내려주는 배지 키를
// 화면에 보여줄 이모지/문구로만 매핑한다. 프론트에서 임의로 배지를 추가하지 않는다.
export const BADGE_META = {
  HOT: { emoji: '🔥', label: '인기상품' },
  MOST_REVIEWED: { emoji: '⭐', label: '후기 많은 상품' },
  MOST_FITTED: { emoji: '❤️', label: '많이 장착해본 상품' },
  MOST_VIEWED: { emoji: '👀', label: '많이 본 상품' },
  HIGH_RATED: { emoji: '⭐', label: '높은 평점' },
}
