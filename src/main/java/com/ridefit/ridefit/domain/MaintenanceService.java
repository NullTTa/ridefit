package com.ridefit.ridefit.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// 정비/세차 "서비스 종류"의 공통 카탈로그(기본 점검, 엔진오일 교환 등). ServiceShop.menus에 들어있는
// 문자열과 이름으로 매칭된다. 매장마다 실제로 파는 가격은 이 엔티티가 아니라 ShopMaintenancePrice에 있다 -
// 같은 "엔진오일 교환"이어도 매장마다 가격이 다르기 때문에, 가격을 여기 두지 않고 분리했다.
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MaintenanceService {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String name;

    @Column(length = 300)
    private String description;

    private Integer durationMinutes;
}
