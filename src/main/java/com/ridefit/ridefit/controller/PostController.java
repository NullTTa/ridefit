package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.dto.CommentResponse;
import com.ridefit.ridefit.dto.CreateCommentRequest;
import com.ridefit.ridefit.dto.CreatePostRequest;
import com.ridefit.ridefit.dto.PostDetailResponse;
import com.ridefit.ridefit.dto.PostSummaryResponse;
import com.ridefit.ridefit.security.CurrentMember;
import com.ridefit.ridefit.service.PostService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

    private final PostService postService;
    private final CurrentMember currentMember;

    @GetMapping
    public Page<PostSummaryResponse> list(@PageableDefault(size = 10) Pageable pageable) {
        return postService.list(pageable);
    }

    @GetMapping("/{postId}")
    public PostDetailResponse detail(@PathVariable Long postId) {
        return postService.detail(postId);
    }

    @PostMapping
    public ResponseEntity<PostDetailResponse> create(@Valid @RequestBody CreatePostRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(postService.create(request, currentMember.id()));
    }

    @PostMapping("/{postId}/comments")
    public ResponseEntity<CommentResponse> addComment(
            @PathVariable Long postId, @Valid @RequestBody CreateCommentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(postService.addComment(postId, request, currentMember.id()));
    }
}
