package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Part;

public record PartDetailResponse(
        Long id, String category, String name, Integer price, String imageUrl, String sourceUrl,
        String installVideoUrl, PartPopularityStats stats, String imageSourceUrl, boolean aiReferenceReady,
        // 부품 메타데이터(확인된 부품만 값이 있고 나머지는 null -> 화면에 "정보 없음")
        String partNumber, String brand, String partType) {

    public static PartDetailResponse from(Part part, PartPopularityStats stats) {
        return new PartDetailResponse(
                part.getId(), part.getCategory(), part.getName(), part.getPrice(), part.getImageUrl(),
                part.getSourceUrl(), part.getInstallVideoUrl(), stats, part.getImageSourceUrl(),
                part.getAiReferenceImageUrl() != null, part.getPartNumber(), part.getBrand(),
                part.getPartType() == null ? null : part.getPartType().name());
    }
}
