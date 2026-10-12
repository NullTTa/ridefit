// 부품 카테고리(DB Part.category, 소분류 - 예: "머플러", "탑박스")를 화면에 보여줄 "대분류"로 묶는
// 순수 표시(presentation)용 매핑이다. DB의 category 값/호환성 데이터/검색·관리자 CRUD는 전부 지금의
// 소분류 문자열을 그대로 쓰고 바뀌지 않는다 - 이 파일은 PartsSearch/FitRoom의 카테고리 필터를
// "대분류 -> 소분류" 2단으로 보여주기 위한 것뿐이다(DB 마이그레이션 없음, 2026-10).
//
// 2026-10 기준 실제 /api/parts 응답에 등장하는 26개 소분류를 모두 담았다. 그룹 순서 = 화면에 보일 순서.
// 새 카테고리가 생겨 이 목록에 없으면 groupLabelOf가 자동으로 "기타"로 묶는다(화면에서 사라지지 않음).
export const PART_CATEGORY_GROUPS = [
  { label: '배기계', categories: ['머플러'] },
  { label: '외장·보호', categories: ['보호대', '엔진가드', '너클가드', '핸드가드', '휠 스티커'] },
  {
    label: '수납·적재',
    categories: ['캐리어', '프론트캐리어', '탑박스', '프론트바구니', '사이드백', '배달통', '리어백', '핸들바가방'],
  },
  { label: '핸들·조작계', categories: ['핸들바', '레버', '풋페그', '미러'] },
  { label: '조명·전기', categories: ['램프', 'USB충전기', '스마트폰거치대'] },
  { label: '휠·타이어', categories: ['휠'] },
  { label: '시트·편의', categories: ['시트', '스크린'] },
  // 현재 분류 체계에 깔끔히 들어맞지 않는 소분류(에어필터=엔진 소모품, 리어쇼크=서스펜션) + 매핑되지
  // 않은 새 카테고리가 여기 모인다(이 배열 자체에는 고정 항목만 두고, 나머지는 groupLabelOf가 채운다).
  { label: '기타', categories: ['에어필터', '리어쇼크'] },
]

const CATEGORY_TO_GROUP = new Map(PART_CATEGORY_GROUPS.flatMap((g) => g.categories.map((c) => [c, g.label])))

// 소분류 -> 대분류 라벨. 매핑이 없는 카테고리는 "기타"로(화면에서 사라지지 않게).
export function groupLabelOf(category) {
  return CATEGORY_TO_GROUP.get(category) ?? '기타'
}

// 지금 이 차량(또는 목록)에 실제로 존재하는 소분류들(allCategories)만 걸러서, 대분류 순서대로
// [대분류 라벨, 그 안의 소분류 배열] 쌍의 목록을 만든다. "기타"에 매핑 안 된 새 카테고리도 자동 포함.
export function groupCategories(allCategories) {
  const present = new Set(allCategories)
  const assigned = new Set(PART_CATEGORY_GROUPS.flatMap((g) => g.categories))
  const extras = allCategories.filter((c) => !assigned.has(c))
  return PART_CATEGORY_GROUPS.map((g) => [
    g.label,
    g.categories.filter((c) => present.has(c)).concat(g.label === '기타' ? extras : []),
  ]).filter(([, cats]) => cats.length > 0)
}
