package com.ridefit.ridefit.service;

import com.ridefit.ridefit.domain.Comment;
import com.ridefit.ridefit.domain.Member;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.Post;
import com.ridefit.ridefit.dto.CommentResponse;
import com.ridefit.ridefit.dto.CreateCommentRequest;
import com.ridefit.ridefit.dto.CreatePostRequest;
import com.ridefit.ridefit.dto.PostDetailResponse;
import com.ridefit.ridefit.dto.PostSummaryResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.CommentRepository;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.PostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class PostService {

    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final MemberRepository memberRepository;
    private final PartRepository partRepository;
    private final MyVehicleRepository myVehicleRepository;

    public Page<PostSummaryResponse> list(Pageable pageable) {
        return postRepository.findAllByOrderByCreatedAtDesc(pageable).map(PostSummaryResponse::from);
    }

    public PostDetailResponse detail(Long postId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));
        var comments = commentRepository.findByPostIdOrderByCreatedAtAsc(postId).stream()
                .map(CommentResponse::from).toList();
        return PostDetailResponse.from(post, comments);
    }

    @Transactional
    public PostDetailResponse create(CreatePostRequest request, Long memberId) {
        Member author = memberRepository.getReferenceById(memberId);

        Part installedPart = null;
        if (request.installedPartId() != null) {
            installedPart = partRepository.findById(request.installedPartId())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "선택한 부품을 찾을 수 없습니다."));
        }

        Post post = Post.builder()
                .author(author)
                .title(request.title())
                .content(request.content())
                .installedPart(installedPart)
                .myVehicle(request.myVehicleId() == null ? null : myVehicleRepository.findById(request.myVehicleId()).orElse(null))
                .compatibleFeedback(request.compatibleFeedback())
                .imageUrl(request.imageUrl())
                .createdAt(LocalDateTime.now())
                .build();
        Post saved = postRepository.save(post);
        return detail(saved.getId());
    }

    @Transactional
    public CommentResponse addComment(Long postId, CreateCommentRequest request, Long memberId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));
        Member author = memberRepository.getReferenceById(memberId);

        Comment comment = Comment.builder()
                .post(post)
                .author(author)
                .content(request.content())
                .createdAt(LocalDateTime.now())
                .build();
        return CommentResponse.from(commentRepository.save(comment));
    }
}
