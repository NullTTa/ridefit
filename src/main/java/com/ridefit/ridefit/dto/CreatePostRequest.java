package com.ridefit.ridefit.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

// category/topic은 선택값이다(없으면 자유게시판). category는 PostCategory 이름, topic은 그 섹션의 주제 중 하나여야 한다.
public record CreatePostRequest(
        @NotBlank String title, @NotBlank String content, Long installedPartId, Long myVehicleId,
        String compatibleFeedback, String imageUrl, String videoUrl,
        @Min(1) @Max(5) Integer rating, String category, String topic) {
}
