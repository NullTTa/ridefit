package com.ridefit.ridefit.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

// "AI로 장착해보기"로 실제 생성에 성공한 결과. 같은 입력(차량 이미지 + 부품 참조 이미지들 + 모델/품질/프롬프트
// 버전 + 장착 위치)이면 cacheKey가 같으므로 기본적으로는 API를 다시 호출하지 않고 가장 최근 결과를 재사용한다(비용 절감).
// 사용자가 "새로 다시 만들기"를 누르면 같은 cacheKey로 새 결과가 한 줄 더 쌓인다(예전 결과/파일은 지우지 않음) -
// 그래서 cacheKey는 유일값이 아니다(조회용 인덱스만 둔다).
// 실패한 요청은 저장하지 않는다(로그만 남김).
@Entity
@Table(indexes = @Index(name = "idx_ai_fit_result_cache_key", columnList = "cacheKey"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiFitResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String cacheKey;

    // 대표 부품(여러 부품을 함께 합성했으면 첫 번째). 전체 목록은 partIds.
    @ManyToOne(fetch = FetchType.LAZY)
    private Part part;

    // 함께 합성한 부품 id들(쉼표 구분, 예: "32,119"). 예전(부품 1개) 결과는 비어 있을 수 있다 -> part로 대신 본다.
    private String partIds;

    // 합성에 쓴 내 차량(my_vehicle.id). 예전 결과는 비어 있을 수 있다 -> 요청 회원 + 차종으로 대신 찾는다.
    private Long myVehicleId;

    @ManyToOne(fetch = FetchType.LAZY)
    private VehicleModel vehicleModel;

    // 합성에 실제로 사용한 원본 이미지 경로들(추적용).
    private String sourceVehicleImage;
    private String sourcePartImage;
    private String sourceProductImage;

    // 우리 서버에 저장된 결과 이미지("/uploads/ai-fit/...").
    private String generatedImage;

    private String model;
    private String quality;
    private String promptVersion;

    private Long requestedByMemberId;

    private LocalDateTime createdAt;
}
