// "현재 구성": 부품 입혀보기(FitRoom)에서 사용자가 직접 켜 둔 부품 id 목록(차량별).
// 이 브라우저에만 저장되는 편의 기능이다(다른 기기/계정과 공유되지 않음, 저장 실패해도 화면은 그대로 동작).
// 내 차고는 이 값을 "현재 구성"으로 보여주고, FitRoom과 PartsSearch(부품 찾아보기) 둘 다 같은 키를 읽고 써서
// 한쪽에서 켜고 끈 부품이 다른 화면에 다시 들어와도 그대로 이어진다(2026-10, 카테고리에서 바로 장착 작업).
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

// 부품 하나를 켜거나 끈다 - 같은 카테고리(자리)에는 항상 하나만 남긴다(새로 켠 부품이 기존 것을 대신한다).
// 다른 카테고리의 장착 상태는 건드리지 않는다. FitRoom과 PartsSearch가 같은 규칙을 쓰도록 공유한다.
// prevIds: 지금 켜진 부품 id Set. parts: 이 차량의 호환 후보 전체(같은 자리 판정에 필요).
// 반환: { next: Set, turningOn: boolean, replaced: {category, from, to} | null }
export function toggleFitBuildPart(prevIds, partId, parts) {
  const next = new Set(prevIds)
  const turningOn = !next.has(partId)
  let replaced = null
  if (turningOn) {
    const part = parts.find((p) => p.partId === partId)
    const sameSlot = parts.filter((p) => p.partId !== partId && next.has(p.partId) && p.category === part?.category)
    sameSlot.forEach((p) => next.delete(p.partId))
    if (sameSlot.length > 0) {
      replaced = { category: part.category, from: sameSlot.map((p) => p.name).join(', '), to: part.name }
    }
    next.add(partId)
  } else {
    next.delete(partId)
  }
  return { next, turningOn, replaced }
}

// "저장한 구성"(이름 붙여 여러 개 보관) - 위 "현재 구성"(마지막 상태, 자동 저장 1개)과는 별개다.
// 사용자가 이름을 붙여 명시적으로 저장해야 생기고, 나중에 그 이름으로 불러오거나 지울 수 있다.
// 이 브라우저에만 저장되는 편의 기능이다(차량별, 최신 저장 순). 서버/DB를 쓰지 않으므로 기존 API를
// 하나도 바꾸지 않고 추가했다 - 로그인 여부와 무관하게 쓸 수 있다.
const presetsKey = (myVehicleId) => `ridefit-fit-presets-v1-${myVehicleId}`
const MAX_PRESETS = 20

export function listFitPresets(myVehicleId) {
  try {
    const raw = localStorage.getItem(presetsKey(myVehicleId))
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list)
      ? list.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.partIds))
      : []
  } catch {
    return []
  }
}

// 이름 + 지금 장착 중인 부품 id 목록을 새 구성으로 저장한다(맨 앞에 추가, 최대 MAX_PRESETS개까지 - 오래된 것부터 밀림).
// 이름이 빈 문자열이면 저장하지 않고 null을 돌려준다.
export function saveFitPreset(myVehicleId, name, partIds) {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return null
  const preset = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    partIds: [...partIds],
    savedAt: new Date().toISOString(),
  }
  try {
    const list = [preset, ...listFitPresets(myVehicleId)].slice(0, MAX_PRESETS)
    localStorage.setItem(presetsKey(myVehicleId), JSON.stringify(list))
    return preset
  } catch {
    return null
  }
}

// 차량을 삭제했을 때 이 브라우저에 남은 그 차량의 "현재 구성"과 "저장한 구성"을 지운다.
export function clearFitData(myVehicleId) {
  try {
    localStorage.removeItem(key(myVehicleId))
    localStorage.removeItem(presetsKey(myVehicleId))
  } catch {
    // 저장소를 쓸 수 없는 환경 - 무시
  }
}

export function deleteFitPreset(myVehicleId, presetId) {
  try {
    const list = listFitPresets(myVehicleId).filter((p) => p.id !== presetId)
    localStorage.setItem(presetsKey(myVehicleId), JSON.stringify(list))
  } catch {
    // 저장소를 쓸 수 없는 환경 - 무시(화면은 그대로 동작)
  }
}
