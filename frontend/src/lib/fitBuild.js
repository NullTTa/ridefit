// "현재 구성": 부품 입혀보기(FitRoom)에서 사용자가 직접 켜 둔 부품 id 목록(차량별).
// 이 브라우저에만 저장되는 편의 기능이다(다른 기기/계정과 공유되지 않음, 저장 실패해도 화면은 그대로 동작).
// 내 차고는 이 값을 "현재 구성"으로 보여주고, FitRoom은 다시 들어왔을 때 이어서 보여준다.
const key = (myVehicleId) => `ridefit-fit-build-v1-${myVehicleId}`

export function loadFitBuild(myVehicleId) {
  try {
    const raw = localStorage.getItem(key(myVehicleId))
    const ids = raw ? JSON.parse(raw) : []
    return Array.isArray(ids) ? ids.filter((id) => Number.isInteger(id)) : []
  } catch {
    return []
  }
}

export function saveFitBuild(myVehicleId, partIds) {
  try {
    localStorage.setItem(key(myVehicleId), JSON.stringify([...partIds]))
  } catch {
    // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등) - 무시
  }
}
