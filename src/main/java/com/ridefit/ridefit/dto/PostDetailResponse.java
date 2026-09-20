package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Post;
import com.ridefit.ridefit.domain.PostCategory;

import java.time.LocalDateTime;
import java.util.List;

public record PostDetailResponse(
        Long id, String title, String content, String authorName, LocalDateTime createdAt,
        Long installedPartId, String installedPartName, String compatibleFeedback, Integer rating,
        String imageUrl, String videoUrl, String installVideoUrl, List<CommentResponse> comments,
        String category, String categoryLabel, String topic, int viewCount, int likeCount, boolean liked) {

    public static PostDetailResponse from(Post post, List<CommentResponse> comments, boolean liked) {
        String authorName = post.getAuthor() == null ? "탈퇴한 사용자" : post.getAuthor().getName();
        PostCategory category = PostCategory.parse(post.getCategory()).orElse(PostCategory.FREE);
        return new PostDetailResponse(
                post.getId(),
                post.getTitle(),
                post.getContent(),
                authorName,
                post.getCreatedAt(),
                post.getInstalledPart() == null ? null : post.getInstalledPart().getId(),
                post.getInstalledPart() == null ? null : post.getInstalledPart().getName(),
                post.getCompatibleFeedback(),
                post.getRating(),
                post.getImageUrl(),
                post.getVideoUrl(),
                post.getInstalledPart() == null ? null : post.getInstalledPart().getInstallVideoUrl(),
                comments,
                category.name(), category.label(), post.getTopic(),
                post.getViewCount(), post.getLikeCount(), liked);
    }
}
