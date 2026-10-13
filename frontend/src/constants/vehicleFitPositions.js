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
  // cub110-stainless-exhaust.png(머플러)는 이 작은 제품컷 대신 아래 overlays.머플러의 전체 캔버스
  // diff 레이어(forImage + src로 직접 지정)를 쓴다 - 순정 머플러를 가리지 못해 덮어씌운 것처럼 보이는
  // 문제가 있었다(2026-10). 여기 남겨두면 안 쓰이는데도 "이게 오버레이"처럼 보여 혼동을 주므로 뺐다.
  // cub110-rear-carrier.png(리어 확장 캐리어, 부품 2)는 오버레이를 쓰지 않는다 - 상품 사진이 위에서 비스듬히 본 3/4 각도라
  // 측면 대표 사진의 순정 짐받이 위에 다른 각도의 짐받이가 떠 있는 것처럼 겹쳐 보였다(2026-10). 같은 각도의 장착 이미지가
  // 생기기 전까지는 검증한 장착 레이어로 쓰지 않는다 - 아래 approx.photos에서 "간이 미리보기"(근사치)로만 쓴다.
  '/assets/parts/cub110-mirror.png': '/assets/parts/overlay/cub110-mirror.png',
  '/assets/parts/kitaco-rear-carrier.png': '/assets/parts/overlay/kitaco-rear-carrier.png',
  // 사이드백(한 쌍, saddlebag-pair-lace.png)은 여기 두지 않는다 - 이 이미지는 Super Cub 110 대표 사진 전용 크롭이라,
  // 아래 VEHICLE_FIT_LAYOUTS['/assets/vehicles/super-cub-110.png'].overlays.사이드백에 forImage + src로 직접 묶었다
  // (여기 두면 다른 차량 레이아웃에 사이드백 배치가 생길 때 그 차량에도 이 가방이 얹힌다).
}

// ---------- 3) 차량 사진별 레이아웃 ----------
// 좌표는 전부 "그 차량 사진의 픽셀 좌표"(width x height 기준)다. VehicleFitStage가 사진과 같은
// 종횡비의 무대를 만들고 % 로 변환하므로, 화면 크기(모바일 포함)와 무관하게 위치가 어긋나지 않는다.
// 사진을 바꾸거나 차종을 추가할 땐 이 표에 그 사진 경로로 항목을 하나 더 넣으면 된다.
//  - overlays[카테고리]: 그 카테고리 부품의 오버레이 배치(여러 개면 좌/우 미러처럼 여러 장).
//      x,y = 오버레이 중심, width = 오버레이 가로(px), rotate = 도, flipX = 좌우 반전, z = 겹침 순서.
//      높이는 오버레이 이미지 비율대로 자동.
//      (선택) src = 이 배치 전용 이미지(없으면 PART_OVERLAY_IMAGES), forImage = 이 상품 사진의 부품에만 적용,
//      under = 차량 사진 아래에 깐다, mask = 차량 사진에 거는 알파 마스크(같은 캔버스, 0인 곳의 순정 부품을 지움),
//      shadow = false면 그림자 없음, directComposite = AI 대신 이 배치 그대로 "장착 모습"을 저장한다(AiFitPanel).
//      미리 만들어 검증한 전체 캔버스 레이어(휠, Hero 레이어를 쓰는 머플러/앞바구니/사이드백)에만 붙인다.
//  - anchors[카테고리]: 오버레이 이미지가 없는 부품의 "부착 지점"(x,y, 실제 그 부품이 붙는 자리)과,
//      라벨을 그 지점에서 얼마나/어느 방향으로 짧게 띄울지(dx,dy, 픽셀). 차량 몸체를 덜 가리도록
//      여백이 있는 방향으로 밀어둔 값이다. 생략하면 기본값(짧게 위로)을 쓴다.
export const VEHICLE_FIT_LAYOUTS = {
  // Honda Super Cub 110 (투명 배경 측면 사진, 1829x860)
  '/assets/vehicles/super-cub-110.png': {
    width: 1829,
    height: 860,
    // 사진 안 차량 영역(0~1, 알파 실측). 차량이 사진 높이를 꽉 채운다(미러 끝 0.003 ~ 바퀴 1.000).
    vehicleBounds: { y0: 0.003, y1: 1.0 },
    overlays: {
      // 순정 스테인리스 머플러(Cub 110) 전용 - 작은 제품컷(297x72)을 순정 머플러 위에 그냥 얹으면
      // 마스크가 없어 순정 머플러가 뒤에 그대로 비쳐 "덮어씌운 것처럼" 보였다(위치 미리보기 2026-10
      // 버그). 홈 Hero가 이미 만들어 둔, 같은 1829x860 캔버스에 순정 머플러를 지우고 새 머플러를 그린
      // 완성 diff 레이어(hero/layers/super-cub-110-muffler.png)를 그대로 재사용한다(새 에셋 생성 없음,
      // 휠과 같은 forImage + 전체 캔버스 패턴). 이 상품 사진이 아닌 다른 머플러는 이 오버레이를 쓰지
      // 않고 기존처럼 배지(장착 이미지 준비 중)로 표시된다.
      머플러: [{
        x: 914.5, y: 430, width: 1829,
        forImage: '/assets/parts/cub110-stainless-exhaust.png',
        src: '/assets/hero/layers/super-cub-110-muffler.png',
        z: 20, directComposite: true,
      }],
      // 캐리어(리어 확장 캐리어/KITACO): 검증한 장착 레이어 없음 -> approx.photos(간이 미리보기). 있는 상품 사진이 모두 3/4 각도 제품샷이라
      // 순정 짐받이(약 x 260~620, y 295~350) 위에 다른 각도의 짐받이가 겹쳐 보였다(예전 값: x 430, y 322, width 170, flipX, z 15).
      // 이 사진과 같은 측면 각도의 캐리어 이미지(또는 장착 사진)가 생기면 그때 전체 캔버스 레이어로 넣는다.
      // 짐받이 아래 측면에 매달린 위치(짐받이 위가 아님). 뒤 쇼크 윗부분을 가린다(가방이 바깥쪽).
      // 오버레이는 원본 비율 그대로(가로/세로 같은 배율, 222x181) - width만 주고 height는 auto. 홈 Hero도 이 값을 그대로 쓴다.
      // 사이드백 121(한 쌍) 전용(forImage) - 사용자가 만든 측면 장착 이미지(AI 결과 #26, uploads/ai-fit/c74c65e1-...png)에서 가방만 잘라
      // 이 사진 좌표로 옮긴 것(새로 그린 픽셀 없음, 은색 핀 버클). 측면 사진이라 앞쪽 가방 하나만 보인다.
      // 커밋된 값(14차, 1506a9e) 그대로 - 홈 Hero/FitRoom/저장 이미지가 이 배치를 같이 쓰고, 360°는 이 이미지를 텍스처로 만든
      // saddlebag-pair-lace-v4 프레임을 쓴다. (한때 바꿨던 투영 레이어 overlay/super-cub-110-saddlebag-pair-lace/layer.png는 쓰지 않아 저장소에
      // 올리지 않았고(tools/fit-360 sidebag.mjs rep로 다시 만들 수 있음), 11차 Hero 레이어 hero/layers/super-cub-110-sidebag.png(버클 디자인이 다름)도 쓰지 않는다 - 파일은 남겨둠.)
      사이드백: [{
        x: 498, y: 450, width: 222, z: 18, directComposite: true,
        forImage: '/assets/parts/saddlebag-pair-lace.png',
        src: '/assets/parts/overlay/saddlebag-pair-lace-side.png',
      }],
      // H2C 순정 프론트 바스켓 전용 - 홈 Hero와 같은 바구니 레이어(hero/layers/super-cub-110-basket.png, 이 사진과 같은
      // 1829x860 캔버스, AI 결과 #8을 대표 사진 좌표로 맞춘 것)를 그대로 쓴다 -> Hero와 FitRoom의 바구니가 같은 모습.
      // 카드 배경(#131824)에서 테두리가 뜨지 않는 것을 확인했다(밝은 배경에서는 바구니 가장자리가 검게 보이므로 밝은 무대에는 쓰지 않는다).
      // (예전에는 360° 02 프레임을 썼는데, 360° 프레임은 대표 사진과 다른 사진이라 바구니가 앞쪽에 떠 보이고
      //  다른 사진의 레그실드 픽셀이 섞여 2D에는 쓰지 않는다. 360°는 각도별 프레임(vehicle360Parts.js)을 그대로 쓴다.)
      프론트바구니: [{
        x: 914.5, y: 430, width: 1829,
        forImage: '/assets/parts/h2c-cub110-front-basket.png',
        src: '/assets/hero/layers/super-cub-110-basket.png',
        z: 20, directComposite: true,
      }],
      // 휠(사용자 제공 '수제 튜닝 마차 휠' 상품 사진만 - forImage). 원본 휠 PNG를 이 사진의 앞/뒤 림 외곽 타원(실측)에 맞춰
      // 같은 1829x860 캔버스로 만든 레이어를 차량 "아래"(under)에 깔고, 차량 사진에는 순정 휠 안쪽만 지우는 마스크를 건다
      // (포크/디스크/캘리퍼/머플러/쇼크처럼 휠 앞에 있는 부품은 마스크에서 남겨 새 휠을 자연스럽게 가린다). AI 없음.
      // 생성: tools/wheel-fit/build_wheel_layers.py (views.json에 타원/가림 영역). 캔버스 전체라 x,y = 중앙, width = 사진 폭.
      휠: [{
        x: 914.5, y: 430, width: 1829,
        under: true, shadow: false, directComposite: true,
        forImage: '/assets/parts/supercub110-handmade-spoke-wheel.png',
        src: '/assets/parts/overlay/super-cub-110-spoke-wheel/layer.png',
        mask: '/assets/parts/overlay/super-cub-110-spoke-wheel/mask.png',
      }],
      // 순정 사진에 이미 양쪽 미러가 그려져 있어서, 같은 자리에 미러 오버레이를 또 얹으면
      // 두 개가 겹쳐 뜬 것처럼 보인다. 검증한 레이어로는 쓰지 않고, approx.photos에서 앞쪽 미러를 덮는 간이 미리보기로만 보여 준다.
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
    // 간이 미리보기(근사치) - 위 overlays(검증한 장착 레이어)가 없는 부품도 차량 위에 "보이는 변화"가 있도록 한다.
    // 실제 장착 모습을 보장하지 않으므로 화면·저장 이미지에 "간이 미리보기"로 표시한다(getPartLayerKind).
    //  - photos[상품 사진 경로]: 그 부품의 상품 사진에서 배경만 지운 레이어(approx/, 원본 사진은 그대로)를 장착 자리에 얹는다.
    //      제품컷 각도(대부분 3/4)가 이 측면 사진과 달라 떠 보일 수 있다 - 그래서 "근사치". 상품 사진 경로로만 고르므로
    //      다른 부품에 이 사진이 붙지 않는다. 미러/리어 캐리어는 예전 배경 제거 레이어(overlay/)를 그대로 쓴다.
    //      (예전에는 각도가 안 맞아 배지로만 표시했다 - 지금은 "간이"로 구분해 보여 준다.)
    //  - illustrations[카테고리]: 상품 사진이 아예 없는 부품용 단순 도형(이 사진과 같은 1829x860 캔버스 SVG, 실제 제품 모습 아님).
    //      tools 없이 손으로 그린 카테고리 실루엣이라 같은 카테고리 부품은 같은 그림을 쓴다.
    approx: {
      photos: {
        '/assets/parts/cub110-rear-carrier.png': { x: 455, y: 316, width: 300, z: 15, src: '/assets/parts/overlay/cub110-rear-carrier.png' },
        '/assets/parts/kitaco-80-539-11530.jpg': { x: 455, y: 314, width: 280, z: 15, src: '/assets/parts/approx/kitaco-80-539-11530.png' },
        '/assets/parts/cub110-mirror.png': { x: 850, y: 32, width: 104, z: 21, src: '/assets/parts/overlay/cub110-mirror.png' },
        '/assets/parts/asahi-champion-sidebag-yellow.jpg': { x: 492, y: 458, width: 220, z: 18, src: '/assets/parts/approx/asahi-champion-sidebag-yellow.png' },
        '/assets/parts/saddlebag-cupholder-buckle.png': { x: 482, y: 458, width: 260, z: 18, src: '/assets/parts/approx/saddlebag-cupholder-buckle.png' },
        '/assets/parts/h2c-cub110-windscreen.png': { x: 1137, y: 98, width: 210, z: 21, src: '/assets/parts/approx/h2c-cub110-windscreen.png' },
        '/assets/parts/universal-windscreen-lotteon.jpg': { x: 1137, y: 92, width: 190, z: 21, src: '/assets/parts/approx/universal-windscreen-lotteon.png' },
      },
      illustrations: {
        USB충전기: 'usb-charger', 너클가드: 'knuckle-guard', 핸드가드: 'hand-guard', 램프: 'lamp', 레버: 'lever',
        리어백: 'rear-bag', 리어쇼크: 'rear-shock', 배달통: 'delivery-box', 사이드백: 'side-bag', 스마트폰거치대: 'phone-mount',
        스크린: 'screen', 시트: 'seat-cover', 에어필터: 'air-filter', 엔진가드: 'engine-guard', 탑박스: 'topbox-bracket',
        풋페그: 'footpeg', 프론트바구니: 'front-basket', 프론트캐리어: 'front-carrier', 핸들바: 'grips', 핸들바가방: 'handlebar-bag',
        // 차체 커버는 이 사진의 차량 실루엣을 흐리게 만든 PNG(맨 위에 덮는다)
        보호대: { src: '/assets/parts/approx/super-cub-110/body-cover.png', z: 30 },
      },
    },
  },

  // Honda PCX (3/4 각도 대표 사진, 750x300). 옆모습이 아니라 정면 3/4 각도라 오버레이 이미지는 아직
  // 없고(제품샷 각도가 이 사진과 안 맞음), 부착 지점 배지로 표시한다. 좌표는 사진을 직접 보고 실측.
  '/assets/vehicles/pcx/main.png': {
    width: 750,
    height: 300,
    vehicleBounds: { y0: 0.013, y1: 0.92 },
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
    vehicleBounds: { y0: 0.06, y1: 0.877 },
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

  // ---- 이하 4종(2026-09-23 추가): 원본 사진에 100px 격자를 입혀 실측한 좌표. 오버레이 이미지는
  // 아직 없어서(overlays: {}) 전부 배지 anchor만 등록한다. 호환 데이터가 있는데도 사진에서 위치를
  // 확신할 수 없는 카테고리(보호대=전신 커버라 한 지점을 특정할 수 없음, Address의 스크린=실물 사진에
  // 윈드스크린이 아예 없는 네이키드 헤드라이트 차종이라 부착 지점을 확인할 수 없음)는 좌표를 만들지
  // 않고 CATEGORY_POSITION 범용 배지로 남겨둔다.

  // Suzuki Address 125 (측면 사진, 1492x1054, 앞쪽이 오른쪽)
  '/assets/vehicles/address-125/main.png': {
    width: 1492,
    height: 1054,
    overlays: {},
    anchors: {
      머플러: { x: 500, y: 740, dx: -90, dy: 60 },
      캐리어: { x: 140, y: 380, dx: -100, dy: -40 },
      미러: { x: 980, y: 75, dx: 100, dy: -40 },
      시트: { x: 480, y: 430, dx: 0, dy: -80 },
      램프: { x: 1080, y: 230, dx: 120, dy: -30 },
      휠: { x: 1280, y: 770, dx: 80, dy: 70 },
      스마트폰거치대: { x: 1000, y: 140, dx: 100, dy: -45 },
      USB충전기: { x: 920, y: 240, dx: -110, dy: 40 },
      핸들바가방: { x: 880, y: 230, dx: -120, dy: 45 },
      배달통: { x: 100, y: 340, dx: -90, dy: -30 },
      리어백: { x: 110, y: 420, dx: -95, dy: 30 },
      프론트바구니: { x: 1100, y: 160, dx: 130, dy: -40 },
    },
  },

  // Suzuki Burgman Street 125 (2026-09-23 실제 사진으로 교체 - 좌표 재실측, 측면 사진, 1678x937,
  // 앞쪽이 오른쪽). 이전 좌표는 잘못 연결됐던 Cygnus Gryphus 사진 기준이라 전부 폐기하고 새로
  // 100px 격자 실측했다.
  '/assets/vehicles/burgman-street-125/main.png': {
    width: 1678,
    height: 937,
    overlays: {},
    anchors: {
      머플러: { x: 250, y: 690, dx: -90, dy: 55 },
      캐리어: { x: 140, y: 475, dx: -100, dy: -35 },
      미러: { x: 990, y: 40, dx: 100, dy: -35 },
      시트: { x: 550, y: 380, dx: 0, dy: -75 },
      램프: { x: 1340, y: 430, dx: 120, dy: 40 },
      스마트폰거치대: { x: 1020, y: 170, dx: 100, dy: -40 },
      USB충전기: { x: 960, y: 230, dx: -110, dy: 30 },
      핸들바가방: { x: 900, y: 210, dx: -120, dy: 40 },
      배달통: { x: 115, y: 530, dx: -95, dy: -25 },
      리어백: { x: 125, y: 580, dx: -100, dy: 30 },
    },
  },

  // Yamaha Tricity 125 (측면 사진, 1672x941, 앞쪽이 오른쪽)
  '/assets/vehicles/tricity-125/main.png': {
    width: 1672,
    height: 941,
    overlays: {},
    anchors: {
      머플러: { x: 520, y: 650, dx: -90, dy: 55 },
      캐리어: { x: 230, y: 300, dx: -110, dy: -35 },
      미러: { x: 985, y: 45, dx: 100, dy: -35 },
      시트: { x: 600, y: 420, dx: 0, dy: -75 },
      스크린: { x: 1200, y: 150, dx: 120, dy: -40 },
      핸들바: { x: 960, y: 200, dx: 100, dy: 30 },
      스마트폰거치대: { x: 1000, y: 160, dx: 110, dy: -40 },
      USB충전기: { x: 940, y: 230, dx: -110, dy: 35 },
      핸들바가방: { x: 880, y: 220, dx: -120, dy: 40 },
      배달통: { x: 190, y: 340, dx: -100, dy: -30 },
      리어백: { x: 200, y: 400, dx: -105, dy: 30 },
    },
  },

  // Yamaha Cygnus Gryphus 125 (2026-09-23 신규 차량, 측면 사진, 1537x1023, 앞쪽이 오른쪽)
  // 이 차종에 실제로 연결된 호환성은 "야마하 범용 핸들바 그립 세트"/"야마하 범용 사이드미러 세트"
  // 2개뿐이라(ContentSeeder.seedExpansionVehicleParts 참고) 그 2개 카테고리만 실측해 등록한다.
  // ※ 기존 Burgman Street 125 항목의 좌표를 복사하지 않고 이 사진을 별도로 100px 격자 실측했다
  // (두 항목이 우연히 같은 값이 나오는 것은, 예전에 Burgman에 이 사진이 잘못 연결돼 있었기 때문).
  '/assets/vehicles/cygnus-gryphus-125/main.png': {
    width: 1537,
    height: 1023,
    overlays: {},
    anchors: {
      미러: { x: 1005, y: 65, dx: 100, dy: -40 },
      핸들바: { x: 940, y: 225, dx: -110, dy: 30 },
    },
  },

  // Yamaha Vino 125 (측면 사진, 1536x1024, 앞쪽이 오른쪽)
  '/assets/vehicles/vino-125/main.png': {
    width: 1536,
    height: 1024,
    overlays: {},
    anchors: {
      머플러: { x: 190, y: 790, dx: -90, dy: 55 },
      미러: { x: 905, y: 45, dx: 100, dy: -35 },
      시트: { x: 500, y: 440, dx: 0, dy: -80 },
      핸들바: { x: 925, y: 200, dx: 100, dy: 30 },
      프론트바구니: { x: 1050, y: 250, dx: 120, dy: -40 },
      스마트폰거치대: { x: 960, y: 160, dx: 110, dy: -40 },
      USB충전기: { x: 900, y: 230, dx: -110, dy: 35 },
      핸들바가방: { x: 850, y: 220, dx: -120, dy: 40 },
    },
  },
}

// 지금 화면에 보이는 차량 사진이 레이아웃이 있는 "차종 대표 사진"일 때만 레이아웃을 돌려준다.
// 사용자가 올린 개인 사진(photoUrl)은 구도를 알 수 없으므로 레이아웃 없음(=배지 fallback).
export function getFitLayout(vehicle) {
  if (!vehicle || vehicle.photoUrl) return null
  return VEHICLE_FIT_LAYOUTS[vehicle.modelImageUrl] ?? null
}

// 무대(위치 미리보기/360°)에서 차량 높이가 차지할 최대 비율. 대표 사진이 차량에 딱 맞게 잘려 있으면(Super Cub: 99.7%)
// 무대 비율 = 사진 비율이라 차량이 위아래 테두리에 닿아 확대돼 보인다 - 이 비율까지만 차지하도록 무대 가운데 기준으로 줄인다.
// 이미 여백이 있는 사진(NMAX 81.7%)은 줄이지 않는다(1 = 그대로). 위치 미리보기와 360°에 같은 값을 써야 두 화면의 차량 크기가 같다.
export const STAGE_VEHICLE_FILL = 0.86

// 차종 대표 사진 경로 기준 축소 비율(0~1). 레이아웃/실측 영역이 없으면 1.
export function getStageScaleForImage(modelImageUrl) {
  const b = VEHICLE_FIT_LAYOUTS[modelImageUrl]?.vehicleBounds
  if (!b || b.y1 <= b.y0) return 1
  return Math.min(1, STAGE_VEHICLE_FILL / (b.y1 - b.y0))
}

// 내 차량 기준. 사용자 사진(photoUrl)은 레이아웃이 없으므로 1.
export function getStageScale(vehicle) {
  if (!vehicle || vehicle.photoUrl) return 1
  return getStageScaleForImage(vehicle.modelImageUrl)
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

// 검증한 장착 레이어(overlays)만. forImage가 있는 배치는 그 상품 사진의 부품에만 쓴다(같은 카테고리의 다른 상품에 이 이미지를 붙이지 않는다).
function getRealOverlays(part, layout) {
  const placements = layout?.overlays?.[part.category]
  if (!placements) return []
  return placements
    .filter((placement) => !placement.forImage || placement.forImage === part.imageUrl)
    .map((placement) => ({ ...placement, src: placement.src ?? PART_OVERLAY_IMAGES[part.imageUrl] }))
    .filter((placement) => placement.src)
}

// 간이 미리보기 레이어(layout.approx). 상품 사진이 있으면 그 사진의 배경 제거 레이어만(없으면 간이 레이어 없음 - 다른 그림을 쓰지 않는다),
// 상품 사진이 없을 때만 카테고리 일러스트. 일러스트는 차량 사진과 같은 크기의 캔버스라 중심/폭이 사진 전체다.
function getApproxOverlays(part, layout) {
  const approx = layout?.approx
  if (!approx) return []
  if (part.imageUrl) {
    const photo = approx.photos?.[part.imageUrl]
    return photo ? [{ ...photo, approx: 'photo', directComposite: true }] : []
  }
  const illust = approx.illustrations?.[part.category]
  if (!illust) return []
  const { src, z } = typeof illust === 'string' ? { src: `/assets/parts/approx/super-cub-110/${illust}.svg`, z: 19 } : illust
  return [{ x: layout.width / 2, y: layout.height / 2, width: layout.width, z, src, approx: 'illustration', directComposite: true }]
}

// 부품 하나가 이 레이아웃에서 차량 위에 올릴 오버레이 목록. 검증한 장착 레이어가 있으면 그것만, 없으면 간이 미리보기. 둘 다 없으면 빈 배열(배지).
// 위치 미리보기(VehicleFitStage)와 저장 이미지(fitComposite)가 이 함수 하나를 같이 써서 화면과 저장 결과가 같다.
export function getPartOverlays(part, layout) {
  const real = getRealOverlays(part, layout)
  return real.length > 0 ? real : getApproxOverlays(part, layout)
}

// 장착 이미지 종류: 'layer'(검증한 장착 레이어) | 'photo'(상품 사진 기반 간이) | 'illustration'(간이 일러스트) | null(배지만)
export function getPartLayerKind(part, layout) {
  const overlays = getPartOverlays(part, layout)
  if (overlays.length === 0) return null
  return overlays[0].approx ?? 'layer'
}

// 장착한 부품들 중 차량 사진에 마스크를 거는 것(휠 교체처럼 순정 부품을 지워야 하는 경우)의 마스크 경로들.
export function getVehicleMasks(parts, layout) {
  return parts.flatMap((part) => getPartOverlays(part, layout).map((o) => o.mask).filter(Boolean))
}

// AI 대신 위치 미리보기 배치 그대로 "장착 모습"을 저장하는 부품인지(휠).
export function isDirectCompositePart(part, layout) {
  return getPartOverlays(part, layout).some((o) => o.directComposite)
}

// 여러 장의 알파 마스크를 CSS mask로(사진과 같은 object-contain 박스에 맞춤). 여러 장이면 교집합.
export function cssMaskStyle(masks) {
  if (!masks || masks.length === 0) return null
  const image = masks.map((m) => `url("${m}")`).join(', ')
  const repeat = masks.map(() => 'no-repeat').join(', ')
  const size = masks.map(() => 'contain').join(', ')
  const position = masks.map(() => 'center').join(', ')
  return {
    WebkitMaskImage: image, maskImage: image,
    WebkitMaskRepeat: repeat, maskRepeat: repeat,
    WebkitMaskSize: size, maskSize: size,
    WebkitMaskPosition: position, maskPosition: position,
    ...(masks.length > 1 ? { WebkitMaskComposite: 'source-in', maskComposite: 'intersect' } : {}),
  }
}

// FitRoom 좌표(vehicleFitPositions.js)에서 이 부품 카테고리의 장착 지점을 찾아 차량 사진 기준 0~100% 로 환산한다.
// AI 프롬프트의 "장착 위치 힌트"로만 쓰인다. 좌표가 없으면 null(AI가 카테고리 설명만으로 위치를 판단).
export function getAiAnchor(vehicle, part) {
  const layout = getFitLayout(vehicle)
  if (!layout || !part) return null
  const point = layout.overlays?.[part.category]?.[0] ?? layout.anchors?.[part.category]
  if (!point) return null
  return { x: (point.x / layout.width) * 100, y: (point.y / layout.height) * 100 }
}
