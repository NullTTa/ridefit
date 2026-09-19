package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Post;

import java.time.LocalDateTime;

public record PostSummaryResponse(Long id, String title, String authorName, LocalDateTime createdAt) {

    public static PostSummaryResponse from(Post post) {
        return new PostSummaryResponse(post.getId(), post.getTitle(), post.getAuthor().getName(), post.getCreatedAt());
    }
}
