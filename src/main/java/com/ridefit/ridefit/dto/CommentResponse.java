package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Comment;

import java.time.LocalDateTime;

public record CommentResponse(Long id, String authorName, String content, LocalDateTime createdAt) {

    public static CommentResponse from(Comment comment) {
        String authorName = comment.getAuthor() == null ? "탈퇴한 사용자" : comment.getAuthor().getName();
        return new CommentResponse(comment.getId(), authorName, comment.getContent(), comment.getCreatedAt());
    }
}
