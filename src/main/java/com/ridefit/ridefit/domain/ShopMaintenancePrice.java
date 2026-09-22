package com.ridefit.ridefit.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// 매장(ServiceShop) + 서비스(MaintenanceService) 조합별 고정 가격. 여기 저장된 값만이 "진짜" 가격이고,
// 예약 생성 시 이 테이블을 조회해서 서버가 최종 금액을 확정한다 - 클라이언트가 보낸 가격은 절대 그대로 쓰지 않는다
// (ReservationController 참고, Toss Payments 등 실제 결제 연동 시에도 같은 원칙을 그대로 따르면 된다).
@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"shop_id", "service_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShopMaintenancePrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    private ServiceShop shop;

    @ManyToOne(fetch = FetchType.LAZY)
    private MaintenanceService service;

    // 원 단위 고정 가격. 요청마다 랜덤 생성하지 않고 여기 저장된 값을 그대로 반환한다.
    private Integer price;
}
