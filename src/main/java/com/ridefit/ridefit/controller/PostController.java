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
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

    private final PostService postService;
    private final CurrentMember currentMember;

    // category: VETERAN | NEWBIE | FREE, sort: latest | popular | views
    @GetMapping
    public Page<PostSummaryResponse> list(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String topic,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return postService.list(category, topic, sort, q, page, size);
    }

    @GetMapping("/categories")
    public List<PostService.CategoryInfo> categories() {
        return postService.categories();
    }

    @GetMapping("/{postId}")
    public PostDetailResponse detail(@PathVariable Long postId) {
        return postService.detail(postId, currentMember.idOrNull());
    }

    @PostMapping("/{postId}/view")
    public ResponseEntity<Void> view(@PathVariable Long postId) {
        postService.increaseView(postId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{postId}/like")
    public PostService.LikeResult like(@PathVariable Long postId) {
        return postService.toggleLike(postId, currentMember.id());
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
