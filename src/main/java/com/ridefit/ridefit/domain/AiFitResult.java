package com.ridefit.ridefit.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

// "AI로 장착해보기"로 실제 생성에 성공한 결과. 같은 입력(차량 이미지 + 부품 참조 이미지 + 모델/품질/프롬프트
// 버전 + 장착 위치)이면 cacheKey가 같으므로 API를 다시 호출하지 않고 이 결과를 재사용한다(비용 절감).
// 실패한 요청은 저장하지 않는다(로그만 남김).
@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"cacheKey"}))
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

    @ManyToOne(fetch = FetchType.LAZY)
    private Part part;

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
