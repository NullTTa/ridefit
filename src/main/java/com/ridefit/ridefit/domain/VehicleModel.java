package com.ridefit.ridefit.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.FetchType;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VehicleModel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    private Manufacturer manufacturer;

    // 세부 차체 스타일(스쿠터/네이키드/스포츠/어드벤처 등). 아래 vehicleClass와는 다른 축이다.
    private String type;

    private String name;

    // 이 모델의 대표 이미지. 관리자가 관리자 페이지에서 등록/수정하며, null이면 프론트가 임시 아이콘을 보여준다.
    private String imageUrl;

    // 커스터마이징 화면(부품 카테고리 구성, 장착 위치 등)을 분기하는 최상위 축: "MOTORCYCLE" | "CAR".
    // type(세부 차체 스타일)과 분리된 별도 필드 — 지금은 오토바이만 있지만, 자동차가 추가돼도
    // 이 필드 하나만 보고 UI를 분기하면 되도록 만든 확장 지점이다. 기존 데이터는 전부 MOTORCYCLE로 백필한다.
    @Builder.Default
    private String vehicleClass = "MOTORCYCLE";
}
