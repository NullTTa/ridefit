package com.ridefit.ridefit.dto;

import jakarta.validation.constraints.NotBlank;

public record CreatePostRequest(
        @NotBlank String title, @NotBlank String content, Long installedPartId, Long myVehicleId,
        String compatibleFeedback, String imageUrl) {
}
