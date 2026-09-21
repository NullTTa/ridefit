// 차량 이미지 위에 "장착된 부품"을 올려두는 위치/이미지 정보.
// FitRoom(부품 입혀보기)과 PartsSearch(부품 찾아보기/커스터마이징) 양쪽이 VehicleFitStage를 통해 공유한다.

// ---------- 1) 범용 fallback (차량 전용 레이아웃이 없을 때) ----------
// 4:3 박스 안에 object-contain으로 놓인 임시 아이콘/사용자 사진 기준의 대략적인 % 좌표.
// 실제 부품 이미지가 없으므로 "이 위치에 이 부품이 붙는다"를 카테고리 배지로만 표시한다.
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

// ---------- 2) 부품 사진 -> 차량 위에 얹는 "투명 배경" 오버레이 이미지 ----------
// 키는 DB(Part.imageUrl)에 들어 있는 상품 사진 경로. 상품 사진은 흰 배경/포장 상자가 있어서
// 그대로 얹으면 차량을 가리기 때문에, 배경만 프로그램으로 제거한 투명 PNG(overlay/)를 따로 둔다
// (흰 배경 flood-fill 제거 + 미러는 포장 상자에서 오른쪽 미러 한 개만 잘라냄. AI 생성/합성 아님).
// 여기에 없는 부품은 "오버레이 이미지 없음" -> 카테고리 배지 fallback.
export const PART_OVERLAY_IMAGES = {
  '/assets/parts/cub110-stainless-exhaust.png': '/assets/parts/overlay/cub110-stainless-exhaust.png',
  '/assets/parts/cub110-rear-carrier.png': '/assets/parts/overlay/cub110-rear-carrier.png',
  '/assets/parts/cub110-mirror.png': '/assets/parts/overlay/cub110-mirror.png',
  '/assets/parts/kitaco-rear-carrier.png': '/assets/parts/overlay/kitaco-rear-carrier.png',
}

// ---------- 3) 차량 사진별 레이아웃 ----------
// 좌표는 전부 "그 차량 사진의 픽셀 좌표"(width x height 기준)다. VehicleFitStage가 사진과 같은
// 종횡비의 무대를 만들고 % 로 변환하므로, 화면 크기(모바일 포함)와 무관하게 위치가 어긋나지 않는다.
// 사진을 바꾸거나 차종을 추가할 땐 이 표에 그 사진 경로로 항목을 하나 더 넣으면 된다.
//  - overlays[카테고리]: 그 카테고리 부품의 오버레이 배치(여러 개면 좌/우 미러처럼 여러 장).
//      x,y = 오버레이 중심, width = 오버레이 가로(px), rotate = 도, flipX = 좌우 반전, z = 겹침 순서.
//      높이는 오버레이 이미지 비율대로 자동.
//  - anchors[카테고리]: 오버레이 이미지가 없는 부품의 배지가 붙을 자리.
export const VEHICLE_FIT_LAYOUTS = {
  // Honda Super Cub 110 (투명 배경 측면 사진, 1829x860)
  '/assets/vehicles/super-cub-110.png': {
    width: 1829,
    height: 860,
    overlays: {
      머플러: [{ x: 528, y: 662, width: 385, rotate: 8, z: 20 }],
      캐리어: [{ x: 452, y: 338, width: 300, z: 15 }],
      미러: [
        { x: 1200, y: 66, width: 132, z: 30 },
        { x: 862, y: 66, width: 132, flipX: true, z: 30 },
      ],
    },
    anchors: {
      머플러: { x: 528, y: 662 },
      캐리어: { x: 452, y: 338 },
      시트: { x: 720, y: 330 },
      미러: { x: 1200, y: 66 },
      핸들바: { x: 930, y: 175 },
      레버: { x: 930, y: 195 },
      램프: { x: 1140, y: 160 },
      스크린: { x: 1240, y: 200 },
      휠: { x: 1300, y: 640 },
    },
  },
}

// 지금 화면에 보이는 차량 사진이 레이아웃이 있는 "차종 대표 사진"일 때만 레이아웃을 돌려준다.
// 사용자가 올린 개인 사진(photoUrl)은 구도를 알 수 없으므로 레이아웃 없음(=배지 fallback).
export function getFitLayout(vehicle) {
  if (!vehicle || vehicle.photoUrl) return null
  return VEHICLE_FIT_LAYOUTS[vehicle.modelImageUrl] ?? null
}

// 부품 하나가 이 레이아웃에서 차량 위에 올릴 오버레이 목록. 없으면 빈 배열.
export function getPartOverlays(part, layout) {
  const src = PART_OVERLAY_IMAGES[part.imageUrl]
  const placements = layout?.overlays?.[part.category]
  if (!src || !placements) return []
  return placements.map((placement) => ({ ...placement, src }))
}
