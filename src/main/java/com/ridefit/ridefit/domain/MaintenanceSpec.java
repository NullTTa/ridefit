package com.ridefit.ridefit.domain;

import jakarta.persistence.Column;
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

// 차종별 정비/소모품 제조사 권장값 (엔진오일부터 시작, 향후 타이어/브레이크패드/스파크플러그/배터리/체인/
// 필터/냉각수/브레이크액 등으로 category만 늘려서 확장한다). Part(커스터마이징 부품)와는 완전히 별개 개념 —
// 이 값은 "몇 km/몇 개월마다 무엇을 확인해야 하는가"를 설명하는 제조사 권장 스펙이지, 판매 상품이 아니다.
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MaintenanceSpec {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    private VehicleModel vehicleModel;

    // "ENGINE_OIL" 등. 향후 TIRE / BRAKE_PAD / SPARK_PLUG / BATTERY / CHAIN / COOLANT / BRAKE_FLUID로 확장.
    private String category;

    private String itemName;

    @Column(length = 500)
    private String specSummary;

    private Double changeVolumeL;

    private Double changeVolumeWithFilterL;

    private Integer firstIntervalKm;

    private Integer firstIntervalMonths;

    private Integer intervalKm;

    private Integer intervalMonths;

    private String sourceLabel;

    private String sourceUrl;

    // 근거 등급이 서로 다른 값이 섞여 있을 때 무엇이 공식 근거이고 무엇이 재확인이 필요한지 명시하는 caveat.
    @Column(length = 1000)
    private String note;
}
