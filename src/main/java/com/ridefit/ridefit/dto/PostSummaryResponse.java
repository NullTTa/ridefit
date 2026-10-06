package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Post;
import com.ridefit.ridefit.domain.PostCategory;

import java.time.LocalDateTime;

// 커뮤니티 목록 카드 하나. 조회수/추천수는 Post의 실제 카운터, 댓글 수는 Comment 테이블 집계 값이다.
// imageUrl: 글에 실제로 첨부된 사진(없으면 null) - 카드 썸네일은 이 값이 있을 때만 보여준다.
public record PostSummaryResponse(
        Long id, String title, String authorName, LocalDateTime createdAt,
        String category, String categoryLabel, String topic,
        int viewCount, int likeCount, long commentCount, boolean hasImage, String imageUrl) {

    public static PostSummaryResponse from(Post post, long commentCount) {
        String authorName = post.getAuthor() == null ? "탈퇴한 사용자" : post.getAuthor().getName();
        PostCategory category = PostCategory.parse(post.getCategory()).orElse(PostCategory.FREE);
        return new PostSummaryResponse(
                post.getId(), post.getTitle(), authorName, post.getCreatedAt(),
                category.name(), category.label(), post.getTopic(),
                post.getViewCount(), post.getLikeCount(), commentCount,
                post.getImageUrl() != null && !post.getImageUrl().isBlank(),
                post.getImageUrl() != null && !post.getImageUrl().isBlank() ? post.getImageUrl() : null);
    }
}
