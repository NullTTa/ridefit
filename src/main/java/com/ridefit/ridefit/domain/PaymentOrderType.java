package com.ridefit.ridefit.domain;

// 무엇에 대한 결제인지. PART = 부품 구매, OIL = 오일/소모품 구매(주문 품목이 전부 오일/소모품 카테고리일 때),
// SERVICE = 장착 서비스 예약(아직 별도 상품 없음 - 구조만 열어둠), RESERVATION = 정비·세차 예약.
public enum PaymentOrderType {
    PART, OIL, SERVICE, RESERVATION
}
