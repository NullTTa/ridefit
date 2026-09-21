// 차량 이미지 위에 "장착된 부품" 배지를 올려둘 대략적인 위치(%, top/left 기준).
// FitRoom(장착 시뮬레이션)과 PartsSearch(부품 찾아보기/커스터마이징) 양쪽에서 공유한다.
// 실제 부품 컷아웃 이미지가 없는 동안은 카테고리 단위 좌표로 "이 위치에 이 부품이 붙는다"만 표시한다.
export const CATEGORY_POSITION = {
  머플러: { top: '80%', left: '14%' },
  캐리어: { top: '24%', left: '10%' },
  시트: { top: '46%', left: '44%' },
  미러: { top: '4%', left: '76%' },
  스크린: { top: '16%', left: '86%' },
  핸들바: { top: '14%', left: '80%' },
  램프: { top: '26%', left: '90%' },
  레버: { top: '20%', left: '76%' },
  휠: { top: '86%', left: '50%' },
}

export const DEFAULT_POSITION = { top: '50%', left: '50%' }
