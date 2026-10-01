// 부품 적용 연식(compatibility + model_year) 표시용 포맷. DB에 저장된 연식/세대 코드만 쓴다.
// fitments: PartFitmentResponse 배열({ year, chassisCode, ... }).

// 같은 세대 코드끼리 묶어서 "JA44 2021·2023년식" 형태로. 연식 값이 없는 레거시 연식은 "연식 미등록".
export function formatFitmentYears(fitments) {
  if (!fitments?.length) return null
  const groups = new Map()
  for (const f of fitments) {
    const key = f.chassisCode || ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(f.year)
  }
  return [...groups.entries()]
    .map(([code, years]) => {
      const known = [...new Set(years.filter((y) => y != null))].sort((a, b) => a - b)
      const text = known.length ? `${known.join('·')}년식` : '연식 미등록'
      return code ? `${code} ${text}` : text
    })
    .join(', ')
}

// 한 건: "2021년식 · JA44" (연식 없으면 "연식 미등록 · JA71")
export function formatFitment(f) {
  return [f.year != null ? `${f.year}년식` : '연식 미등록', f.chassisCode].filter(Boolean).join(' · ')
}

// 차종별로 묶기: [{ key, manufacturerName, vehicleModelName, rows: [...] }]
export function groupFitmentsByModel(fitments) {
  const map = new Map()
  for (const f of fitments ?? []) {
    if (!map.has(f.vehicleModelId)) {
      map.set(f.vehicleModelId, { key: f.vehicleModelId, manufacturerName: f.manufacturerName, vehicleModelName: f.vehicleModelName, rows: [] })
    }
    map.get(f.vehicleModelId).rows.push(f)
  }
  return [...map.values()]
}
