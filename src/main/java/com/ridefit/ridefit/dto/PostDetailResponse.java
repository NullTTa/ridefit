package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Post;

import java.time.LocalDateTime;
import java.util.List;

public record PostDetailResponse(
        Long id, String title, String content, String authorName, LocalDateTime createdAt,
        Long installedPartId, String installedPartName, String compatibleFeedback,
        List<CommentResponse> comments) {

    public static PostDetailResponse from(Post post, List<CommentResponse> comments) {
        return new PostDetailResponse(
                post.getId(),
                post.getTitle(),
                post.getContent(),
                post.getAuthor().getName(),
                post.getCreatedAt(),
                post.getInstalledPart() == null ? null : post.getInstalledPart().getId(),
                post.getInstalledPart() == null ? null : post.getInstalledPart().getName(),
                post.getCompatibleFeedback(),
                comments);
    }
}
