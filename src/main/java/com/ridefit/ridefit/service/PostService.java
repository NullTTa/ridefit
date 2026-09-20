package com.ridefit.ridefit.service;

import com.ridefit.ridefit.domain.Comment;
import com.ridefit.ridefit.domain.Member;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.Post;
import com.ridefit.ridefit.domain.PostCategory;
import com.ridefit.ridefit.domain.PostLike;
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
import com.ridefit.ridefit.repository.PostLikeRepository;
import com.ridefit.ridefit.repository.PostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PostService {

    private static final int MAX_PAGE_SIZE = 50;

    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final MemberRepository memberRepository;
    private final PartRepository partRepository;
    private final MyVehicleRepository myVehicleRepository;
    private final PostLikeRepository postLikeRepository;

    // sort: latest(기본) | popular(추천순) | views(조회순). category/topic/q가 비어 있으면 필터 없음.
    @Transactional(readOnly = true)
    public Page<PostSummaryResponse> list(String category, String topic, String sort, String q, int page, int size) {
        String categoryFilter = PostCategory.parse(category).map(PostCategory::name).orElse("");
        Sort order = switch (sort == null ? "latest" : sort) {
            case "popular" -> Sort.by(Sort.Order.desc("likeCount"), Sort.Order.desc("createdAt"));
            case "views" -> Sort.by(Sort.Order.desc("viewCount"), Sort.Order.desc("createdAt"));
            default -> Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
        };
        PageRequest pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(MAX_PAGE_SIZE, size)), order);

        Page<Post> posts = postRepository.search(
                categoryFilter, topic == null ? "" : topic.trim(), q == null ? "" : q.trim(), pageable);

        List<Long> ids = posts.getContent().stream().map(Post::getId).toList();
        Map<Long, Long> commentCounts = new HashMap<>();
        if (!ids.isEmpty()) {
            for (Object[] row : postRepository.countCommentsByPostIds(ids)) {
                commentCounts.put((Long) row[0], (Long) row[1]);
            }
        }
        return posts.map(p -> PostSummaryResponse.from(p, commentCounts.getOrDefault(p.getId(), 0L)));
    }

    // 섹션별 게시글 수. category가 없는 예전 글은 자유게시판으로 센다.
    @Transactional(readOnly = true)
    public List<CategoryInfo> categories() {
        Map<String, Long> counts = new HashMap<>();
        for (Object[] row : postRepository.countGroupedByCategory()) {
            String key = PostCategory.parse((String) row[0]).orElse(PostCategory.FREE).name();
            counts.merge(key, (Long) row[1], Long::sum);
        }
        return java.util.Arrays.stream(PostCategory.values())
                .map(c -> new CategoryInfo(c.name(), c.label(), c.description(), c.topics(), counts.getOrDefault(c.name(), 0L)))
                .toList();
    }

    @Transactional(readOnly = true)
    public PostDetailResponse detail(Long postId, Long viewerId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));
        var comments = commentRepository.findByPostIdOrderByCreatedAtAsc(postId).stream()
                .map(CommentResponse::from).toList();
        boolean liked = viewerId != null && postLikeRepository.existsByPostIdAndMemberId(postId, viewerId);
        return PostDetailResponse.from(post, comments, liked);
    }

    @Transactional
    public PostDetailResponse create(CreatePostRequest request, Long memberId) {
        Member author = memberRepository.getReferenceById(memberId);

        Part installedPart = null;
        if (request.installedPartId() != null) {
            installedPart = partRepository.findById(request.installedPartId())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "선택한 부품을 찾을 수 없습니다."));
        }

        PostCategory category = PostCategory.parse(request.category()).orElse(PostCategory.FREE);
        String topic = request.topic() != null && category.topics().contains(request.topic()) ? request.topic() : null;

        Post post = Post.builder()
                .author(author)
                .title(request.title())
                .content(request.content())
                .installedPart(installedPart)
                .myVehicle(request.myVehicleId() == null ? null : myVehicleRepository.findById(request.myVehicleId()).orElse(null))
                .compatibleFeedback(request.compatibleFeedback())
                .imageUrl(request.imageUrl())
                .videoUrl(request.videoUrl())
                // installedPart가 없는데 rating만 있는 건 의미가 없어서 무시한다.
                .rating(installedPart == null ? null : request.rating())
                .category(category.name())
                .topic(topic)
                .createdAt(LocalDateTime.now())
                .build();
        Post saved = postRepository.save(post);
        return detail(saved.getId(), memberId);
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

    // 상세 화면이 열릴 때 프론트가 한 번 호출한다. (GET 상세 조회에 넣으면 새로고침/미리보기마다 무한정 늘어나서 분리)
    @Transactional
    public void increaseView(Long postId) {
        if (postRepository.incrementViewCount(postId) == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다.");
        }
    }

    // 추천 토글. 회원당 게시글 1개에 한 번만 가능하고, 다시 누르면 취소된다.
    @Transactional
    public LikeResult toggleLike(Long postId, Long memberId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));

        var existing = postLikeRepository.findByPostIdAndMemberId(postId, memberId);
        boolean liked;
        if (existing.isPresent()) {
            postLikeRepository.delete(existing.get());
            liked = false;
        } else {
            postLikeRepository.save(PostLike.builder()
                    .post(post).member(memberRepository.getReferenceById(memberId)).createdAt(LocalDateTime.now()).build());
            liked = true;
        }
        postLikeRepository.flush();
        post.setLikeCount((int) postLikeRepository.countByPostId(postId));
        return new LikeResult(liked, post.getLikeCount());
    }

    public record CategoryInfo(String code, String label, String description, List<String> topics, long postCount) {
    }

    public record LikeResult(boolean liked, int likeCount) {
    }
}
