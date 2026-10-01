// 차량 무대(위치 미리보기 / 360° / 장착 모습) 왼쪽 위에 내 차량의 연식·세대 코드를 작게 표시한다.
// DB(model_year)에 저장된 값만 쓴다 - 연식 값이 없는 레거시 연식은 "연식 미등록"으로 그대로 보여준다(추측 금지).
// vehicle: /api/my-vehicles 응답 한 건(year, chassisCode).
function vehicleYearText(vehicle) {
  if (!vehicle) return null
  const year = vehicle.year != null ? `${vehicle.year}년식` : null
  const code = vehicle.chassisCode || null
  if (!year && !code) return null
  return [code, year ?? '연식 미등록'].filter(Boolean).join(' · ')
}

function VehicleYearBadge({ vehicle, className = '' }) {
  const text = vehicleYearText(vehicle)
  if (!text) return null
  return (
    <span
      className={`pointer-events-none absolute left-2 top-2 z-50 rounded-full border border-ridefit-border bg-ridefit-bg/85 px-2 py-0.5 text-[11px] font-semibold text-ridefit-text shadow backdrop-blur ${className}`}
      data-testid="vehicle-year-badge"
    >
      {text}
    </span>
  )
}

// 사용자 사진이 아니라 차종 대표 사진을 쓰고 있을 때의 안내. 대표 사진은 차종 공통이라 연식별 외형과 다를 수 있다.
export function ModelImageNotice({ vehicle, className = '' }) {
  if (!vehicle || vehicle.photoUrl || !vehicle.modelImageUrl) return null
  return (
    <p className={`text-center text-[11px] text-ridefit-text-secondary ${className}`} data-testid="model-image-notice">
      {vehicle.vehicleModelName} 차종 대표 이미지예요. 연식에 따라 실제 외형은 다를 수 있어요.
    </p>
  )
}

export default VehicleYearBadge
