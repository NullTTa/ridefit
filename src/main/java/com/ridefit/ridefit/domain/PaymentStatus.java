package com.ridefit.ridefit.domain;

// 결제 상태. READY = 서버가 금액을 확정하고 결제창을 띄우기 직전(아직 돈이 나가지 않음),
// PAID = Toss 승인 완료, FAILED = 승인 실패/금액 불일치 등, CANCELED = 사용자가 결제창을 닫는 등 결제를 그만둠.
public enum PaymentStatus {
    READY, PAID, FAILED, CANCELED
}
