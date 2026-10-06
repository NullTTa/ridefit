// 홈 Hero에서 자동으로 순서대로 장착되는 부품(머플러 -> 앞바구니 -> 사이드백, 반복). 캐리어/윈드스크린은 Hero 차량 사진과 같은 각도의
// 자연스러운 장착 이미지가 없어서 넣지 않는다.
// partName은 DB 부품 이름 그대로(시드 이름) - "부품 입혀보기"(?build=hero)로 넘어가면 FitRoom이 이 이름으로 호환 후보를 찾아 켠다
// (DB마다 id가 달라질 수 있어 id 대신 이름을 쓴다. 호환되지 않는 차량이면 켜지 않는다).
//
// Hero 전용 값
//  - category: VEHICLE_FIT_LAYOUTS(vehicleFitPositions.js) anchors의 키 - 장착 지점 좌표를 FitRoom과 같은 값으로 읽는다.
//  - layer: vehicles/super-cub-110.png(1829x860)와 같은 캔버스의 투명 레이어(새로 그린 픽셀 없음).
//      머플러: 로컬 합성본(hero/supercub-v2-muffler.png)에서 원본과 달라진 픽셀만.
//      앞바구니: AI 결과 #8(uploads/ai-fit/f3be4626-...png, 머플러 합성본 위에 앞바구니 118만 추가)을 대표 사진 좌표로 맞춰 바구니 주변만.
//        (원본 해상도가 낮아 바구니만 조금 부드럽다. 배경이 검정이라 Hero 무대 배경 #020202 위에서만 자연스럽다.)
//  - overlayPartImage: 레이어 대신 FitRoom 오버레이를 그대로 쓰는 부품(사이드백). PART_OVERLAY_IMAGES[이 경로] 이미지를
//      VEHICLE_FIT_LAYOUTS의 같은 카테고리 배치(중심/가로, 비율 유지)로 얹는다 -> FitRoom과 Hero의 사이드백이 항상 같은 모습.
//    배열 순서 = 장착 순서 = 겹치는 순서(머플러 -> 앞바구니 -> 사이드백).
//  - node: 부품 이름 버튼 위치(같은 1829x860 좌표, 차량 바깥 여백까지 포함).
export const HERO_BUILD = [
  {
    label: '머플러',
    partName: '순정 스타일 스테인리스 머플러 (Cub 110)',
    category: '머플러',
    layer: '/assets/hero/layers/super-cub-110-muffler.png',
    node: { x: 430, y: 935 },
  },
  {
    label: '앞바구니',
    partName: 'H2C 슈퍼커브 110 순정 프론트 바스켓 (21년~) [APK1MAL61000TA]',
    category: '프론트바구니',
    layer: '/assets/hero/layers/super-cub-110-basket.png',
    node: { x: 1560, y: 90 },
  },
  {
    label: '사이드백',
    partName: '사이드백 대용량 짐받이 트렁크 가방 오토바이 겸용 (한 쌍)',
    category: '사이드백',
    overlayPartImage: '/assets/parts/saddlebag-pair-lace.png',
    node: { x: 300, y: 130 },
  },
]
