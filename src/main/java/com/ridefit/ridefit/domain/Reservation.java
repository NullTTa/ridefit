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

// RIDEFIT 서비스 안에서 신청하는 예약. 실제 업체 시스템으로 전달되거나 결제가 일어나지는 않는다.
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Reservation {

    public static final String STATUS_REQUESTED = "REQUESTED";
    public static final String STATUS_CANCELED = "CANCELED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    private ServiceShop shop;

    @ManyToOne(fetch = FetchType.LAZY)
    private MyVehicle myVehicle;

    // 이 예약에 담긴 서비스 목록(여러 개 동시 선택 가능).
    @OneToMany(mappedBy = "reservation", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ReservationItem> items = new ArrayList<>();

    // 서버가 각 항목의 price를 합산해 확정한 총액(원). 항목 중 가격 미확정(null)이 하나라도 있으면 null.
    private Integer totalPrice;

    private LocalDateTime preferredAt;

    private String memo;

    private String status;

    private LocalDateTime createdAt;
}
