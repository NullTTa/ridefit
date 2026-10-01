package com.ridefit.ridefit.domain;

// 부품 구분. 근거가 확인된 부품에만 넣고, 모르면 null(화면에는 "정보 없음")로 둔다 - 이름만 보고 추정해 채우지 않는다.
//  OEM: 차량 제조사(계열사 포함) 순정/순정 액세서리, AFTERMARKET: 다른 제조사의 차종 전용품, UNIVERSAL: 여러 차종 겸용 범용품.
public enum PartType {
    OEM,
    AFTERMARKET,
    UNIVERSAL
}
