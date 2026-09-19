package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Part;

public record PartResponse(Long id, String category, String name, Integer price, String imageUrl, String sourceUrl) {

    public static PartResponse from(Part part) {
        return new PartResponse(
                part.getId(), part.getCategory(), part.getName(), part.getPrice(), part.getImageUrl(),
                part.getSourceUrl());
    }
}
