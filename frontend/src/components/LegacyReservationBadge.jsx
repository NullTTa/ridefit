// 서비스 여러 개 선택이 생기기 전에 신청한 예약 표시(오류가 아니라 그때는 서비스 항목을 따로 저장하지 않았다는 뜻).
function LegacyReservationBadge() {
  return (
    <span
      className="mr-1.5 inline-block rounded-full border border-ridefit-border bg-ridefit-bg px-2 py-0.5 align-middle text-[11px] font-medium text-ridefit-text-secondary"
      title="서비스를 여러 개 고를 수 있게 바뀌기 전에 신청한 예약이라 서비스 항목이 저장되어 있지 않아요."
      data-testid="legacy-reservation"
    >
      예전 예약
    </span>
  )
}

export default LegacyReservationBadge
