// 차량 이미지 위에 "장착된 부품"을 올려두는 위치/이미지 정보.
// FitRoom(부품 입혀보기)과 PartsSearch(부품 찾아보기/커스터마이징) 양쪽이 VehicleFitStage를 통해 공유한다.

// 배지(오버레이 이미지가 없는 부품)는 "부착 지점(x,y) + 짧은 연결선(dx,dy만큼 떨어진 라벨)" 형태로 그린다.
// dx,dy를 생략하면 기본값(살짝 위로 짧게)을 쓴다 - VehicleFitStage.LABEL_OFFSET 참고.

// ---------- 1) 범용 fallback (차량 전용 레이아웃이 없을 때) ----------
// 4:3 박스 안에 object-contain으로 놓인 임시 아이콘/사용자 사진 기준의 대략적인 % 좌표(0~100).
// 실제 부품 이미지가 없으므로 "이 위치에 이 부품이 붙는다"를 카테고리 배지로만 표시한다.
export const CATEGORY_POSITION = {
  머플러: { x: 14, y: 80, dy: 10 },
  캐리어: { x: 10, y: 24, dx: -8 },
  시트: { x: 44, y: 46, dy: -10 },
  미러: { x: 76, y: 4, dy: -8 },
  스크린: { x: 86, y: 16, dx: 8 },
  핸들바: { x: 80, y: 14, dy: -8 },
  램프: { x: 90, y: 26, dx: 8 },
  레버: { x: 76, y: 20, dy: -8 },
  휠: { x: 50, y: 86, dy: 8 },
  사이드백: { x: 20, y: 58, dx: -8 },
  풋페그: { x: 62, y: 70, dy: 8 },
  엔진가드: { x: 56, y: 64, dy: 8 },
  리어쇼크: { x: 30, y: 78, dy: 8 },
  프론트캐리어: { x: 88, y: 36, dx: 8 },
  탑박스: { x: 18, y: 18, dy: -8 },
  스마트폰거치대: { x: 82, y: 10, dy: -8 },
  USB충전기: { x: 70, y: 12, dx: -8 },
  배달통: { x: 12, y: 30, dx: -8 },
  리어백: { x: 16, y: 44, dx: -8 },
  핸들바가방: { x: 84, y: 20, dx: 8 },
  보호대: { x: 50, y: 92, dy: 8 },
  핸드가드: { x: 78, y: 18, dy: -8 },
  너클가드: { x: 72, y: 22, dy: -8 },
  프론트바구니: { x: 92, y: 30, dx: 8 },
  에어필터: { x: 40, y: 72, dy: 8 },
}

export const DEFAULT_POSITION = { x: 50, y: 50 }

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
//  - anchors[카테고리]: 오버레이 이미지가 없는 부품의 "부착 지점"(x,y, 실제 그 부품이 붙는 자리)과,
//      라벨을 그 지점에서 얼마나/어느 방향으로 짧게 띄울지(dx,dy, 픽셀). 차량 몸체를 덜 가리도록
//      여백이 있는 방향으로 밀어둔 값이다. 생략하면 기본값(짧게 위로)을 쓴다.
export const VEHICLE_FIT_LAYOUTS = {
  // Honda Super Cub 110 (투명 배경 측면 사진, 1829x860)
  '/assets/vehicles/super-cub-110.png': {
    width: 1829,
    height: 860,
    overlays: {
      머플러: [{ x: 528, y: 662, width: 385, rotate: 8, z: 20 }],
      // 순정 사진에 이미 캐리어가 달려 있어서, "확장 캐리어" 오버레이는 그 위에 겹쳐 보인다.
      // 오버레이 사진은 3/4 각도 제품샷이라 옆모습 사진의 실루엣과 완전히 같은 구도는 아니지만,
      // 실측한 순정 캐리어 위치(약 x 260~620, y 295~350)에 맞춰 크기/좌표를 줄이고,
      // 사진 속 장착부(짧은 다리)가 시트 쪽(오른쪽)을, 확장된 랙이 테일램프 쪽(왼쪽)을 향하도록 좌우 반전했다.
      캐리어: [{ x: 430, y: 322, width: 170, flipX: true, z: 15 }],
      // 순정 사진에 이미 양쪽 미러가 그려져 있어서, 같은 자리에 미러 오버레이를 또 얹으면
      // 두 개가 겹쳐 뜬 것처럼 보인다. 오버레이로 가리는 대신 배지로만 "미러 장착됨"을 표시한다.
    },
    anchors: {
      머플러: { x: 528, y: 662, dx: -80, dy: 60 },
      캐리어: { x: 430, y: 322, dx: -80, dy: -45 },
      시트: { x: 720, y: 330, dx: 0, dy: -75 },
      미러: { x: 1030, y: 40, dx: 160, dy: 25 },
      핸들바: { x: 930, y: 175, dx: 85, dy: -35 },
      레버: { x: 930, y: 195, dx: -95, dy: 15 },
      램프: { x: 1140, y: 160, dx: 90, dy: -25 },
      스크린: { x: 1240, y: 200, dx: 130, dy: -45 },
      휠: { x: 1300, y: 640, dx: 40, dy: 65 },
      사이드백: { x: 380, y: 440, dx: -95, dy: 20 },
      풋페그: { x: 860, y: 470, dx: -50, dy: 65 },
      엔진가드: { x: 800, y: 585, dx: 95, dy: 40 },
      리어쇼크: { x: 600, y: 580, dx: -50, dy: 65 },
      프론트캐리어: { x: 1150, y: 280, dx: 100, dy: -35 },
      탑박스: { x: 452, y: 280, dx: -35, dy: -65 },
      스마트폰거치대: { x: 1000, y: 110, dx: 90, dy: -50 },
      USB충전기: { x: 900, y: 235, dx: -110, dy: 45 },
      배달통: { x: 520, y: 250, dx: 0, dy: -75 },
      리어백: { x: 340, y: 400, dx: -115, dy: 45 },
      핸들바가방: { x: 840, y: 235, dx: -120, dy: 45 },
      보호대: { x: 700, y: 520, dx: 0, dy: 100 },
      핸드가드: { x: 985, y: 210, dx: 115, dy: 35 },
      너클가드: { x: 985, y: 150, dx: 115, dy: -35 },
      프론트바구니: { x: 1200, y: 250, dx: 145, dy: -25 },
      에어필터: { x: 660, y: 525, dx: -75, dy: 70 },
    },
  },

  // Honda PCX (3/4 각도 대표 사진, 750x300). 옆모습이 아니라 정면 3/4 각도라 오버레이 이미지는 아직
  // 없고(제품샷 각도가 이 사진과 안 맞음), 부착 지점 배지로 표시한다. 좌표는 사진을 직접 보고 실측.
  '/assets/vehicles/pcx/main.png': {
    width: 750,
    height: 300,
    overlays: {},
    anchors: {
      스크린: { x: 430, y: 45, dx: 110, dy: -40 },
      레버: { x: 345, y: 65, dx: -115, dy: -15 },
      캐리어: { x: 230, y: 95, dx: -100, dy: -35 },
      머플러: { x: 255, y: 195, dx: -95, dy: 55 },
      램프: { x: 470, y: 195, dx: 115, dy: 45 },
      스마트폰거치대: { x: 400, y: 30, dx: 100, dy: -35 },
      USB충전기: { x: 370, y: 80, dx: -110, dy: -15 },
      배달통: { x: 210, y: 80, dx: -110, dy: -30 },
      리어백: { x: 200, y: 140, dx: -115, dy: 30 },
      핸들바가방: { x: 360, y: 100, dx: -105, dy: 25 },
      보호대: { x: 400, y: 250, dx: 0, dy: 40 },
      에어필터: { x: 300, y: 230, dx: -90, dy: 45 },
    },
  },

  // Yamaha NMAX 125 (측면 대표 사진, 750x300 - 앞쪽이 오른쪽을 향함). 좌표는 사진을 직접 보고 실측.
  '/assets/vehicles/n-max-125/main.png': {
    width: 750,
    height: 300,
    overlays: {},
    anchors: {
      미러: { x: 450, y: 25, dx: 110, dy: -20 },
      핸들바: { x: 430, y: 70, dx: 100, dy: -10 },
      스크린: { x: 460, y: 40, dx: 100, dy: -35 },
      램프: { x: 495, y: 100, dx: 100, dy: 25 },
      스마트폰거치대: { x: 470, y: 55, dx: 110, dy: -30 },
      USB충전기: { x: 440, y: 90, dx: 100, dy: 15 },
      보호대: { x: 400, y: 250, dx: 0, dy: 40 },
    },
  },
}

// 지금 화면에 보이는 차량 사진이 레이아웃이 있는 "차종 대표 사진"일 때만 레이아웃을 돌려준다.
// 사용자가 올린 개인 사진(photoUrl)은 구도를 알 수 없으므로 레이아웃 없음(=배지 fallback).
export function getFitLayout(vehicle) {
  if (!vehicle || vehicle.photoUrl) return null
  return VEHICLE_FIT_LAYOUTS[vehicle.modelImageUrl] ?? null
}

// "부품 장착" 무대(VehicleFitStage)와 "360도 보기"(Vehicle360Viewer)가 같은 차량을 같은 크기로 보여주도록
// 공유하는 종횡비. 실측 결과 이 차종들은 대표 사진과 360 프레임 세트의 실제 픽셀 비율이 거의 같아서
// (예: Super Cub 110 대표사진 1829x860 ≈ 360 프레임 960x451), 대표 사진 기준 레이아웃 비율을 그대로
// 360 뷰어 컨테이너에도 적용하면 두 화면을 오갈 때 차량이 갑자기 커지거나 작아 보이지 않는다.
// 레이아웃이 없는 차종(임시 아이콘/사용자 사진)은 VehicleFitStage의 fallback 박스와 같은 4:3을 쓴다.
export function getVehicleStageAspectRatio(vehicle) {
  const layout = getFitLayout(vehicle)
  return layout ? layout.width / layout.height : 4 / 3
}

// 부품 하나가 이 레이아웃에서 차량 위에 올릴 오버레이 목록. 없으면 빈 배열.
export function getPartOverlays(part, layout) {
  const src = PART_OVERLAY_IMAGES[part.imageUrl]
  const placements = layout?.overlays?.[part.category]
  if (!src || !placements) return []
  return placements.map((placement) => ({ ...placement, src }))
}
