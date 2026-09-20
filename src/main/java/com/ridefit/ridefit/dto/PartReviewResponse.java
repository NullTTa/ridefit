package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Post;

import java.time.LocalDateTime;

public record PartReviewResponse(
        Long postId, String title, String authorName, String compatibleFeedback, Integer rating,
        String imageUrl, LocalDateTime createdAt) {

    public static PartReviewResponse from(Post post) {
        String authorName = post.getAuthor() == null ? "탈퇴한 사용자" : post.getAuthor().getName();
        return new PartReviewResponse(post.getId(), post.getTitle(), authorName, post.getCompatibleFeedback(),
                post.getRating(), post.getImageUrl(), post.getCreatedAt());
    }
}
