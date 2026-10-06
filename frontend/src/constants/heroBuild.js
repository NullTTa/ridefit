// 홈 Hero에서 장착해볼 수 있는 부품(머플러 + 사이드백). 앞바구니/캐리어/윈드스크린은 Hero 차량 사진과 같은 각도의
// 자연스러운 장착 이미지가 없어서 넣지 않는다(WORK_LOG 11차 후보 평가).
// partName은 DB 부품 이름 그대로(시드 이름) - "부품 입혀보기"(?build=hero)로 넘어가면 FitRoom이 이 이름으로 호환 후보를 찾아 켠다
// (DB마다 id가 달라질 수 있어 id 대신 이름을 쓴다. 호환되지 않는 차량이면 켜지 않는다).
//
// Hero 전용 값
//  - category: VEHICLE_FIT_LAYOUTS(vehicleFitPositions.js) anchors의 키 - 장착 지점 좌표를 FitRoom과 같은 값으로 읽는다.
//  - layer: vehicles/super-cub-110.png(1829x860)와 같은 캔버스의 투명 레이어. 기존 로컬 합성 이미지
//    (hero/supercub-v2-muffler.png, hero/supercub-v2-muffler-sidebag.png)에서 원본 차량과 달라진 픽셀만 떼어냈다.
//    머플러 -> 사이드백 순서로 겹치면 supercub-v2-muffler-sidebag.png와 같은 모습이 된다(순서 중요).
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
    label: '사이드백',
    partName: '사이드백 대용량 짐받이 트렁크 가방 오토바이 겸용 (한 쌍)',
    category: '사이드백',
    layer: '/assets/hero/layers/super-cub-110-sidebag.png',
    node: { x: 300, y: 130 },
  },
]
