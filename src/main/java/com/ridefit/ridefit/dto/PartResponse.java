package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Part;

public record PartResponse(
        Long id, String category, String name, Integer price, String imageUrl, String sourceUrl,
        String installVideoUrl, Double externalRating, Integer externalRatingCount, String externalRatingSource,
        String imageSourceUrl, String aiReferenceImageUrl,
        // 부품 메타데이터(확인된 부품만 값이 있고 나머지는 null)
        String partNumber, String brand, String partType) {

    public static PartResponse from(Part part) {
        return new PartResponse(
                part.getId(), part.getCategory(), part.getName(), part.getPrice(), part.getImageUrl(),
                part.getSourceUrl(), part.getInstallVideoUrl(), part.getExternalRating(),
                part.getExternalRatingCount(), part.getExternalRatingSource(), part.getImageSourceUrl(),
                part.getAiReferenceImageUrl(), part.getPartNumber(), part.getBrand(),
                part.getPartType() == null ? null : part.getPartType().name());
    }
}
