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
//  - 휠(수제 튜닝 마차 휠): 원본 휠 PNG를 프레임마다 실측한 앞/뒤 림 외곽 타원에 affine으로 맞춘 레이어(AI 없음,
//    tools/wheel-fit/build_wheel_layers.py). 휠은 차량 "아래"(under)에 깔고, 차량 프레임에는 그 각도의 마스크(masks[i])를 걸어
//    순정 휠 안쪽만 지운다 - 포크/디스크/머플러/체인케이스처럼 휠 앞에 있는 부품은 그대로 남아 새 휠을 가린다.
//    01(정면)/05(후면)은 휠이 옆으로 서 있어 림이 보이지 않으므로 null(순정 프레임 그대로 = 타이어만 보임).
//  - 머플러(순정 스타일 스테인리스): 상품 컷(overlay/cub110-stainless-exhaust.png)을 프레임마다 실측한 순정 머플러 축에
//    원근 변환해 얹고, 순정 머플러가 남는 자리는 뒷바퀴를 72도(스포크 5쌍) 회전 대칭으로 다시 그려 메웠다(바퀴 밖은 주변색 확산). AI 없음.
//    02~04 = 측면 레이어, 05(후면) = 상품 컷 색으로 그린 끝단(몸통 뒷면 + 꼬리관) + 차량 프레임 마스크(배경과 맞닿은 순정 테두리만 지움).
//    01(정면)/06~08(왼쪽)은 머플러(오른쪽)가 차체/엔진/바퀴에 가려 안 보여 null.
//    휠(마차 휠)과 함께 장착하면 순정 휠로 메운 픽셀이 새 휠 위에 그려지면 안 되므로 with 변형을 쓴다:
//    림 안쪽은 메우지 않고 차량 프레임 마스크로 순정 머플러를 지워, 아래에 깔린 새 휠이 그대로 보이게 한다.
//  - 사이드백(한 쌍): 홈 Hero 사이드백 이미지(overlay/saddlebag-pair-lace-side.png)의 바깥 면/뚜껑 띠 + 상품 사진의 끝 면을 잘라, 차량 좌표의 가방 상자
//    (짐받이 아래, 뒤축 기준 X -70~200mm, 높이 190~400mm, 바깥쪽 120~260mm - Hero 사이드백 위치 기준)를 프레임마다 정사영(뒷바퀴 타원으로 잰 배율/방위)한 면에
//    원근 변환해 붙였다. 왼쪽 가방은 같은 상품의 짝이라 같은 사진을 면 대응으로 좌우 반전. 차체 뒤쪽 가방은 프레임이 투명한 곳에만 그린다.
//    01(정면)은 짐받이 아래 가방이 레그실드 뒤에 가려 null. 연결 끈 덮개(짐받이 위)는 그리지 않았다.
//    제작 스크립트: tools/fit-360(muffler.mjs / sidebag.mjs, 실측값은 views-*.json, 실행 방법은 README.md).
const SC110_360 = '/assets/parts/360/super-cub-110'
const frames8 = (dir) => Array.from({ length: 8 }, (_, i) => `${SC110_360}/${dir}/${String(i + 1).padStart(2, '0')}.png`)
const wheelFrames = (dir, prefix = '') =>
  Array.from({ length: 8 }, (_, i) => (i === 0 || i === 4 ? null : `${SC110_360}/${dir}/${prefix}${String(i + 1).padStart(2, '0')}.png`))
// 일부 각도만 보이는 부품: shown = 보이는 프레임 번호(1부터). 나머지는 null(그 각도에서 안 보임을 확인).
const someFrames = (dir, shown, prefix = '', override = {}) =>
  Array.from({ length: 8 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0')
    if (override[i + 1] !== undefined) return override[i + 1] && `${SC110_360}/${dir}/${override[i + 1]}`
    return shown.includes(i + 1) ? `${SC110_360}/${dir}/${prefix}${n}.png` : null
  })
const SPOKE_WHEEL = '슈퍼커브110 수제 튜닝 마차 휠 (21~25년식)'

export const VEHICLE_360_PART_LAYERS = {
  '/assets/vehicles/super-cub-110.png': {
    'H2C 슈퍼커브 110 순정 프론트 바스켓 (21년~) [APK1MAL61000TA]': { frames: frames8('h2c-front-basket') },
    [SPOKE_WHEEL]: {
      frames: wheelFrames('spoke-wheel'),
      masks: wheelFrames('spoke-wheel', 'mask-'),
      under: true,
    },
    '순정 스타일 스테인리스 머플러 (Cub 110)': {
      frames: someFrames('stainless-muffler', [2, 3, 4, 5]),
      masks: someFrames('stainless-muffler', [5], 'mask-'),
      variants: [
        {
          with: SPOKE_WHEEL,
          frames: someFrames('stainless-muffler', [2, 3, 4], 'wheel-', { 5: '05.png' }),
          masks: someFrames('stainless-muffler', [2, 3, 4], 'wheel-mask-', { 5: 'mask-05.png' }),
        },
      ],
    },
    '사이드백 대용량 짐받이 트렁크 가방 오토바이 겸용 (한 쌍)': {
      // v3: 커밋된 홈 Hero 사이드백(overlay/saddlebag-pair-lace-side.png, 대표 사진 498,450 / 가로 222)과 같은 디자인·자리.
      // 그 이미지를 면 텍스처로 쓰고, 가방 상자를 대표 사진 투영이 Hero 가방과 IoU 0.93이 되게 잡았다
      // (뒤축 기준 X -70~200, 높이 190~400, 바깥 120~260mm). 예전 v1(처음 상자)·v2(상품 사진 텍스처라 버클이 다름)는 저장소에 올리지 않았다(tools/fit-360 README의 값으로 다시 만들 수 있음).
      // v4: v3와 같은 상자/바깥 면·뚜껑(Hero 이미지), 앞/뒤 끝 면만 실제 상품 사진(saddlebag-pair-lace.png)의 끝 면으로 -
      //   Hero 이미지는 측면이라 끝 면이 30px 띠뿐이어서 05(후면)/04/06에서 검은 판처럼 보였다. 끝 면에는 버클이 없어 디자인 차이 없음. v3도 저장소에는 올리지 않음.
      frames: someFrames('saddlebag-pair-lace-v4', [2, 3, 4, 5, 6, 7, 8]),
    },
  },
}

// 이 차종/부품의 프레임별 레이어(완성된 경우에만). 없거나 일부 각도만 있으면 null.
export function get360PartLayer(modelImageUrl, partName, frameCount) {
  return get360PartLayerInfo(modelImageUrl, partName, frameCount)?.frames ?? null
}

// 레이어 + (있으면) 차량 프레임 마스크/아래 깔기 정보. { frames, masks?, under? } 또는 null.
// activeNames: 함께 장착한 부품 이름들 - variants[].with 부품이 함께 장착돼 있으면 그 변형(frames/masks)을 쓴다.
export function get360PartLayerInfo(modelImageUrl, partName, frameCount, activeNames = []) {
  const base = VEHICLE_360_PART_LAYERS[modelImageUrl]?.[partName]
  const variant = base?.variants?.find((v) => activeNames.includes(v.with))
  const entry = variant ? { ...base, ...variant } : base
  if (!entry || !Array.isArray(entry.frames) || entry.frames.length !== frameCount) return null
  for (let i = 0; i < frameCount; i++) if (entry.frames[i] === undefined) return null
  if (entry.masks && entry.masks.length !== frameCount) return null
  return { frames: entry.frames, masks: entry.masks ?? null, under: !!entry.under }
}
