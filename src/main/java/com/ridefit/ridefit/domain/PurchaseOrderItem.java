package com.ridefit.ridefit.domain;

import jakarta.persistence.Entity;
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

// 주문 품목 1줄. 주문 시점의 이름/단가를 같이 남겨 두어 나중에 부품 정보가 바뀌어도 결제 내역이 그대로 보이게 한다.
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PurchaseOrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    private PurchaseOrder order;

    @ManyToOne(fetch = FetchType.LAZY)
    private Part part;

    private String partName;

    private String category;

    private Integer unitPrice;

    private Integer quantity;

    private Integer lineAmount;
}
