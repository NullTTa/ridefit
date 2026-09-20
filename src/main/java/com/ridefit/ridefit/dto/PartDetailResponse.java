package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Part;

public record PartDetailResponse(
        Long id, String category, String name, Integer price, String imageUrl, String sourceUrl,
        String installVideoUrl, PartPopularityStats stats) {

    public static PartDetailResponse from(Part part, PartPopularityStats stats) {
        return new PartDetailResponse(
                part.getId(), part.getCategory(), part.getName(), part.getPrice(), part.getImageUrl(),
                part.getSourceUrl(), part.getInstallVideoUrl(), stats);
    }
}
