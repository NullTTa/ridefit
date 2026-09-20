package com.ridefit.ridefit.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// 부품 정보 / 소모품 정보 / DIY 가이드를 하나의 구조로 담는 정보 글.
// 본문(body)은 섹션 배열을 담은 JSON 문자열이라, 새 항목은 resources/seed/guide-articles.json에 추가하면 된다.
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GuideArticle {

    public static final String TYPE_PART = "PART";
    public static final String TYPE_CONSUMABLE = "CONSUMABLE";
    public static final String TYPE_DIY = "DIY";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String slug;

    // PART | CONSUMABLE | DIY
    private String type;

    private String title;

    @Column(length = 500)
    private String summary;

    // Part.category와 연결되는 값. 있으면 "호환 가능한 차량"과 카탈로그 부품을 DB에서 바로 이어서 보여준다.
    private String partCategory;

    // 적용 대상. MOTORCYCLE / CAR 를 쉼표로 나열한다 (예: 요소수는 "CAR").
    private String appliesTo;

    // 오토바이에는 해당하지 않을 수 있는 항목에 붙이는 안내 문구 (예: 냉각수 - 수냉식만, 요소수 - 디젤 자동차 전용)
    @Column(length = 500)
    private String applicabilityNote;

    // DIY 전용
    private String difficulty;

    private Integer estimatedMinutes;

    // 안전상 전문가 점검이 필요한 작업이면 true (화면에 경고 배너 노출)
    @Builder.Default
    private boolean professionalRecommended = false;

    private String emoji;

    private Integer sortOrder;

    @Lob
    private String body;

    // EDITORIAL: 편집 콘텐츠. 실제 값 검수 후 교체 가능
    private String dataSource;
}
