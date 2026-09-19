package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Post;

import java.time.LocalDateTime;

public record PostSummaryResponse(Long id, String title, String authorName, LocalDateTime createdAt) {

    public static PostSummaryResponse from(Post post) {
        String authorName = post.getAuthor() == null ? "탈퇴한 사용자" : post.getAuthor().getName();
        return new PostSummaryResponse(post.getId(), post.getTitle(), authorName, post.getCreatedAt());
    }
}
