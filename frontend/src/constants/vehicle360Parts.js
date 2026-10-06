// 360 Viewer 부품 레이어(차종 대표 사진 경로 -> 부품 이름 -> 프레임별 투명 PNG).
// 부품 키는 DB 시드 이름 그대로다(DB마다 id가 달라질 수 있어 heroBuild.js와 같이 이름으로 맞춘다).
//
// 원칙
//  - 레이어는 그 차종 360 프레임과 "같은 캔버스 크기"의 투명 PNG다(Super Cub 110: 1497x704). 그래서 차량 프레임과
//    같은 위치/같은 보정(transform)으로 겹치기만 하면 각도가 어긋나지 않는다(frameIndex 하나로 차량+부품을 같이 고른다).
//  - frames[i]: i번째 프레임(0부터)의 레이어 경로. null = "그 각도에서는 부품이 보이지 않음"(예: 좌측면에서 우측 머플러)을
//    확인했다는 뜻이다. 아직 만들지 않은 각도는 배열에 넣지 않는다(undefined).
//  - 8개 각도가 전부 "경로 또는 null"로 채워진 부품만 360 준비됨으로 본다. 일부 각도만 있으면 회전 중 부품이
//    나타났다 사라지므로 준비되지 않은 것으로 취급하고 화면에 "360° 장착 이미지 준비 중"으로 알린다.
//  - AI 합성 결과 한 장을 여기에 넣지 않는다(각도별 레이어만).
//
// Super Cub 110(2025 JA59 포함, 같은 360 프레임 사용)
//  - 앞바구니(H2C 118): 01~04, 06~08은 각 프레임 앞부분 크롭(흰 배경)에 Magic Hour로 바구니만 장착한 결과를
//    원래 크롭 크기로 되돌려(정렬 오차 0) 흰 배경 대비 알파를 복원해 바구니만 떼어낸 레이어(WORK_LOG 10차).
//    05(후면)는 AI가 바구니를 미등 쪽에 잘못 그려 쓰지 않고, 01(정면) 바구니를 차량 중심선 기준 좌우 반전 +
//    차체가 가리는 부분 제거로 만들었다(뒤에서 보면 앞바구니는 차체 너머에 있다).
const SC110_360 = '/assets/parts/360/super-cub-110'
const frames8 = (dir) => Array.from({ length: 8 }, (_, i) => `${SC110_360}/${dir}/${String(i + 1).padStart(2, '0')}.png`)

export const VEHICLE_360_PART_LAYERS = {
  '/assets/vehicles/super-cub-110.png': {
    'H2C 슈퍼커브 110 순정 프론트 바스켓 (21년~) [APK1MAL61000TA]': { frames: frames8('h2c-front-basket') },
  },
}

// 이 차종/부품의 프레임별 레이어(완성된 경우에만). 없거나 일부 각도만 있으면 null.
export function get360PartLayer(modelImageUrl, partName, frameCount) {
  const entry = VEHICLE_360_PART_LAYERS[modelImageUrl]?.[partName]
  if (!entry || !Array.isArray(entry.frames) || entry.frames.length !== frameCount) return null
  for (let i = 0; i < frameCount; i++) if (entry.frames[i] === undefined) return null
  return entry.frames
}
