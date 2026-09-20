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
import jakarta.persistence.Lob;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.OneToOne;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.HashMap;
import java.util.Map;

// 차종(VehicleModel)의 "성향/스펙 프로필". 성향 테스트와 유사 차량 추천이 이 데이터를 그대로 사용한다.
// VehicleModel 자체는 건드리지 않고 1:1로 덧붙여서, 프로필이 없는 차종도 기존 기능은 그대로 동작한다.
//
// - displacementCc / bodyStyle: 배기량, 차체 형태 (제조사 공개 스펙 기준으로 시드)
// - priceTier: 1(입문·저렴) ~ 4(300cc급 고가). 실제 판매가가 아니라 "등록된 차종끼리의 상대 분류"다.
// - traitScores: 성향 8개(Trait 참고) 각각 1~5점. RIDEFIT이 정한 편집 점수이며 실측/공식 수치가 아니다.
// - dataSource: 값의 출처 표기. DEV_SEED = 개발용 초기값(실제 데이터로 교체 예정)
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VehicleProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(unique = true)
    private VehicleModel vehicleModel;

    private Integer displacementCc;

    private String bodyStyle;

    private Integer priceTier;

    @Builder.Default
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "vehicle_profile_trait", joinColumns = @JoinColumn(name = "profile_id"))
    @MapKeyColumn(name = "trait")
    @Column(name = "score")
    private Map<String, Integer> traitScores = new HashMap<>();

    @Column(length = 500)
    private String summary;

    // 줄바꿈(\n)으로 구분된 목록
    @Lob
    private String pros;

    @Lob
    private String cons;

    private String dataSource;
}
