// 차종별 360도(이미지 시퀀스) 프레임 목록. vehicleFitPositions.js의 VEHICLE_FIT_LAYOUTS와 같은 패턴으로
// vehicleModelId가 아니라 그 차종 대표 사진 경로(modelImageUrl)를 키로 쓴다 - DB를 건드리지 않는 순수
// frontend asset mapping이다(예외적으로 PCX는 대표 이미지 자체가 없었어서 DataSeeder에 modelImage(pcx, ...)
// 한 줄만 추가했다 - 기존 "모델 대표 이미지" 구조를 그대로 재사용한 것이지 360 전용 DB 필드를 새로 만들지 않았다).
//
// 실제 촬영된 각도별 사진(01~08, 45도 간격)을 그대로 매핑한다 - 복제/왜곡 없음. 두 세트 다 파일명 순서를
// 실제 화면으로 하나씩 열어 확인한 결과 01(정면)->...->08(정면 직전, 반대쪽 3/4)이 어긋남 없이 이어져서
// 파일명 순서를 그대로 썼다. 년식별 이미지는 없으므로 모든 연식이 이 차종 공통 세트를 그대로 쓴다
// (나중에 연식별 사진이 생기면 이 매핑을 modelImageUrl 대신 modelYear 단위로 넓히면 된다).
//
// 8장 -> 12/16/24/36장으로 늘려도 Vehicle360Viewer 쪽 코드는 그대로 동작한다(배열 길이만 본다).
export const VEHICLE_360_FRAMES = {
  '/assets/vehicles/super-cub-110.png': Array.from(
    { length: 8 },
    (_, i) => `/assets/vehicles/super-cub-110/360/${String(i + 1).padStart(2, '0')}.png`,
  ),
  '/assets/vehicles/pcx/main.png': Array.from(
    { length: 8 },
    (_, i) => `/assets/vehicles/pcx/360/${String(i + 1).padStart(2, '0')}.png`,
  ),
  '/assets/vehicles/n-max-125/main.png': Array.from(
    { length: 8 },
    (_, i) => `/assets/vehicles/n-max-125/360/${String(i + 1).padStart(2, '0')}.png`,
  ),
}

// 차종 대표 사진(위치 미리보기에 쓰는 사진)과 같은 각도의 프레임 번호(0부터). 360 보기를 이 프레임부터
// 시작해야 위치 미리보기 -> 360 전환 때 차량이 정면(폭이 좁은 각도)으로 바뀌며 작아 보이지 않는다.
// 확인 방법: 대표 사진과 프레임을 나란히 놓고 각도를 비교 + 투명 영역(bbox) 측정.
//  - Super Cub 110: 대표 사진 = 우측 앞 3/4 -> 02.png (01=정면, 03=우측면)
//  - PCX: 대표 사진의 차량 영역이 02.png와 픽셀 단위로 같다(같은 사진)
//  - NMAX 125: 대표 사진의 차량 영역이 03.png와 픽셀 단위로 같다(같은 사진)
const VEHICLE_360_START_INDEX = {
  '/assets/vehicles/super-cub-110.png': 1,
  '/assets/vehicles/pcx/main.png': 1,
  '/assets/vehicles/n-max-125/main.png': 2,
}

// modelImageUrl(차종 대표 사진 경로) 기준. 등록이 없으면 0(첫 프레임).
export function getVehicle360StartIndex(modelImageUrl) {
  return VEHICLE_360_START_INDEX[modelImageUrl] ?? 0
}

// 사용자가 올린 개인 사진(photoUrl)은 각도 정보가 없으므로 360 미지원 -> null.
// 등록된 프레임이 없는 차종도 null -> 호출부에서 기존 정적 이미지로 자연스럽게 폴백한다.
export function getVehicle360Frames(vehicle) {
  if (!vehicle || vehicle.photoUrl) return null
  return VEHICLE_360_FRAMES[vehicle.modelImageUrl] ?? null
}
