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

import java.time.LocalDateTime;

// RIDEFIT 안에서만 동작하는 "가상 예약". 실제 업체에 전달되거나 결제가 일어나지 않는다.
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

    private String serviceName;

    private LocalDateTime preferredAt;

    private String memo;

    private String status;

    private LocalDateTime createdAt;
}
