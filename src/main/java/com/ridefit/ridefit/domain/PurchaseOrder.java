package com.ridefit.ridefit.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

// 부품/오일 구매 주문. 금액(totalAmount)은 서버가 DB의 부품 가격(RIDEFIT 판매 가격) x 수량으로 확정한 값이다
// (외부 판매처 가격은 참고용이라 쓰지 않는다). 결제가 승인되면 PAID가 된다.
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PurchaseOrder {

    public static final String STATUS_PENDING_PAYMENT = "PENDING_PAYMENT";
    public static final String STATUS_PAID = "PAID";
    public static final String STATUS_PAYMENT_FAILED = "PAYMENT_FAILED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    private Member member;

    // 이 주문을 어느 내 차량 기준으로 샀는지(선택) - 호환 확인 맥락 보존용.
    @ManyToOne(fetch = FetchType.LAZY)
    private MyVehicle myVehicle;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<PurchaseOrderItem> items = new ArrayList<>();

    private Integer totalAmount;

    private String status;

    private LocalDateTime createdAt;

    private LocalDateTime paidAt;
}
