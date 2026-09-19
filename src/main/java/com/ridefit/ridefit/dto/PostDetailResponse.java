package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Post;

import java.time.LocalDateTime;
import java.util.List;

public record PostDetailResponse(
        Long id, String title, String content, String authorName, LocalDateTime createdAt,
        Long installedPartId, String installedPartName, String compatibleFeedback, String imageUrl,
        List<CommentResponse> comments) {

    public static PostDetailResponse from(Post post, List<CommentResponse> comments) {
        String authorName = post.getAuthor() == null ? "탈퇴한 사용자" : post.getAuthor().getName();
        return new PostDetailResponse(
                post.getId(),
                post.getTitle(),
                post.getContent(),
                authorName,
                post.getCreatedAt(),
                post.getInstalledPart() == null ? null : post.getInstalledPart().getId(),
                post.getInstalledPart() == null ? null : post.getInstalledPart().getName(),
                post.getCompatibleFeedback(),
                post.getImageUrl(),
                comments);
    }
}
