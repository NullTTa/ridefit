package com.ridefit.ridefit.domain;

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

// 예약 1건에 담긴 서비스 1개. 사용자가 여러 서비스를 동시에 선택할 수 있어서 Reservation:ReservationItem = 1:N이다.
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReservationItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    private Reservation reservation;

    @ManyToOne(fetch = FetchType.LAZY)
    private MaintenanceService service;

    private String serviceName;

    // 매장 기본가(ShopMaintenancePrice) + 오일 옵션 추가금까지 서버가 확정한 최종 금액(원). 매칭 가격이 없으면 null.
    private Integer price;

    @Enumerated(EnumType.STRING)
    private EngineOilType oilType;
}
