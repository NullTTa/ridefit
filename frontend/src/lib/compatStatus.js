// 호환 판정 표시. DB의 compatibility.status는 그대로 두고, "호환가능"인데 근거 메모(note)가 비어 있으면
// 화면에서는 "호환 근거 미확인"으로 따로 보여 준다 - 근거가 있는 호환과 같은 초록 배지로 보이지 않게.
// 장착 후보 여부(호환가능/브라켓필요)는 바꾸지 않는다. 판정 데이터를 고치는 것이 아니라 표시만 구분한다.
export const UNVERIFIED_LABEL = '호환 근거 미확인'
export const UNVERIFIED_HINT = '호환 근거가 아직 등록되지 않았어요. 구매 전에 판매처나 제조사에 장착 가능 여부를 확인해 주세요.'

export function compatDisplay(status, note) {
  const unverified = status === '호환가능' && !(typeof note === 'string' && note.trim())
  return { status, unverified, key: unverified ? 'unverified' : status, label: unverified ? UNVERIFIED_LABEL : status }
}

// 글자색(목록 한 줄 표시용)
export const COMPAT_TEXT = {
  호환가능: 'text-ridefit-success',
  브라켓필요: 'text-ridefit-warning',
  호환불가: 'text-ridefit-danger',
  unverified: 'text-ridefit-text-secondary',
}

// 테두리 배지(부품 상세의 호환 차량 목록)
export const COMPAT_CHIP = {
  호환가능: 'border-ridefit-success-border bg-ridefit-success-bg text-ridefit-success',
  브라켓필요: 'border-ridefit-warning-border bg-ridefit-warning-bg text-ridefit-warning',
  호환불가: 'border-ridefit-danger-border bg-ridefit-danger-bg text-ridefit-danger',
  unverified: 'border-dashed border-ridefit-border bg-transparent text-ridefit-text-secondary',
}
