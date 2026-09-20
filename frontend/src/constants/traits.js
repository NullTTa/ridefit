// 서버(Trait enum)의 성향 축 키와 표시 이름. 차량 프로필/성향 테스트 결과가 모두 이 키를 쓴다.
export const TRAITS = [
  { key: 'COMMUTE', label: '출퇴근·생활' },
  { key: 'TOURING', label: '장거리·투어링' },
  { key: 'DESIGN', label: '디자인' },
  { key: 'PERFORMANCE', label: '속도·성능' },
  { key: 'COMFORT', label: '편안함' },
  { key: 'ECONOMY', label: '유지비' },
  { key: 'TUNING', label: '튜닝·커스텀' },
  { key: 'CITY', label: '도심 기동성' },
]

export const TRAIT_LABEL = Object.fromEntries(TRAITS.map((t) => [t.key, t.label]))
