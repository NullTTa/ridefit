package com.ridefit.ridefit.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

// 주변 정비/세차 서비스 매장. 지도 연동을 염두에 두고 lat/lng를 미리 두었지만 지금은 목록형으로만 쓴다.
// sample=true는 "실제 업체가 아닌 개발용 샘플"이라는 뜻이라 화면에도 그대로 표시한다.
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServiceShop {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    // REPAIR(정비소) | OIL(오일교환) | TIRE(타이어) | WASH(세차장) | SELF_WASH(셀프세차) | SELF_REPAIR(셀프정비) | SPECIALTY(전문점)
    private String type;

    private String region;

    private String address;

    @Column(length = 500)
    private String description;

    private Double lat;

    private Double lng;

    @Builder.Default
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "service_shop_menu", joinColumns = @JoinColumn(name = "shop_id"))
    @Column(name = "menu")
    private List<String> menus = new ArrayList<>();

    @Builder.Default
    private boolean sample = true;
}
