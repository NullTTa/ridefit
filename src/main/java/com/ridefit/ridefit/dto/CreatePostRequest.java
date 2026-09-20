package com.ridefit.ridefit.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record CreatePostRequest(
        @NotBlank String title, @NotBlank String content, Long installedPartId, Long myVehicleId,
        String compatibleFeedback, String imageUrl, String videoUrl,
        @Min(1) @Max(5) Integer rating) {
}
