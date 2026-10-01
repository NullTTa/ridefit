// FitRoom 주소. partId를 붙이면 FitRoom이 그 부품을(호환될 때만) 켠 상태로 연다.
export const fitRoomPath = (myVehicleId, partId) => `/garage/${myVehicleId}/fit?partId=${partId}`
