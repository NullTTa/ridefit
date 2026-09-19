package com.ridefit.ridefit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CreateSellerListingRequest(
        @NotBlank String sellerName, @NotNull @Positive Integer price, String thumbnailUrl,
        @NotBlank String sourceUrl) {
}
