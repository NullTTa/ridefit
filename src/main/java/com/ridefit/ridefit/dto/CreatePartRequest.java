package com.ridefit.ridefit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

// modelYearId가 있으면 그 연식 하나에만, 없고 vehicleModelId만 있으면 그 모델의 전 연식에
// 호환(Compatibility) 레코드를 만든다. 크롤링 자동인식이 모델까지만 맞히고 연식은 못 맞힌 경우를 위함.
public record CreatePartRequest(
        @NotBlank String name,
        @NotNull @Positive Integer price,
        @NotBlank String category,
        String imageUrl,
        String sourceUrl,
        Long modelYearId,
        Long vehicleModelId) {
}
