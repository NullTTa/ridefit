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

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Part {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String category;

    private String name;

    private Integer price;

    private String imageUrl;

    // null이면 관리자/시드로 등록된 카탈로그 부품, 값이 있으면 사용자가 링크로 가져온 커스텀 부품.
    @Column(name = "source_url")
    private String sourceUrl;

    // 이 카테고리의 부품을 장착하는 방법을 보여주는 유튜브 영상 (관리자가 등록).
    private String installVideoUrl;

    // ---- 인기상품 계산용 실측 데이터 (가짜로 채우지 않음) ----
    // 부품 상세를 조회할 때마다 +1 (PartController.getPart).
    @Builder.Default
    private int viewCount = 0;

    // "부품 입혀보기"에서 이 부품을 켤 때마다 +1 (실제 장착 시도 신호).
    @Builder.Default
    private int fitSelectionCount = 0;

    // 외부 판매처의 실제 판매량. 지금은 이 수치를 안정적으로 확인할 수 있는 외부 데이터 소스가
    // 없어서 항상 null이다 - 임의로 채우지 않는다. 나중에 실제 판매량을 확인할 수 있는 연동이
    // 생기면 그때 값을 채우면 된다.
    private Integer externalSalesCount;

    // ---- 외부 사이트 평점 (RIDEFIT 자체 평점과 절대 합치지 않는다) ----
    // 자동으로 크롤링/추정하지 않는다 - 관리자가 실제 확인한 값을 직접 입력했을 때만 값이 있다.
    private Double externalRating;
    private Integer externalRatingCount;
    private String externalRatingSource; // 예: "Webike"
}
