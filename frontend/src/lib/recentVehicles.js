// "최근 본 차량" - 비로그인 방문자도 쓸 수 있도록 브라우저 localStorage에 차종(VehicleModel) id만 저장한다.
// 서버 DB에 저장되는 값은 아니고(개인 브라우징 기록이라), 서버에는 "관심 차량"(로그인 필요)만 저장된다.
const KEY = 'ridefit-recent-vehicles'
const MAX = 8

export function getRecentVehicleIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id) => Number.isInteger(id)) : []
  } catch {
    return []
  }
}

// 가장 최근에 본 차량이 맨 앞. 이미 있으면 앞으로 끌어올린다.
export function addRecentVehicle(id) {
  const numericId = Number(id)
  if (!Number.isInteger(numericId)) return
  try {
    const next = [numericId, ...getRecentVehicleIds().filter((v) => v !== numericId)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 조용히 무시한다.
  }
}
