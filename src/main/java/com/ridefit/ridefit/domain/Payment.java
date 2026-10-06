package com.ridefit.ridefit.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

// Toss Payments 결제 1건. orderId는 Toss에 넘기는 주문번호(서버가 만든 고유값), amount는 서버가 DB 가격으로 확정한 금액이다.
// 승인 요청 때 프론트가 보낸 금액이 이 값과 다르면 승인하지 않는다(PaymentService).
// 부품/오일 구매면 purchaseOrder, 예약 결제면 reservation 중 하나만 채운다.
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    private Member member;

    @Column(unique = true, nullable = false, length = 64)
    private String orderId;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private PaymentOrderType orderType;

    @ManyToOne(fetch = FetchType.LAZY)
    private PurchaseOrder purchaseOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    private Reservation reservation;

    private String orderName;

    private Integer amount;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private PaymentStatus status;

    // Toss가 결제마다 발급하는 키. 같은 키로 두 번 승인되지 않도록 고유 제약.
    @Column(unique = true, length = 200)
    private String paymentKey;

    // Toss 응답의 결제수단(예: 카드, 간편결제).
    private String method;

    // 실패/취소 사유(Toss 오류 코드 또는 서버 판정 코드)와 사용자에게 보여줄 문구.
    private String failureCode;

    @Column(length = 500)
    private String failureMessage;

    private LocalDateTime paidAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
