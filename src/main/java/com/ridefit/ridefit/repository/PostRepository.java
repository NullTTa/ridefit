package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.Post;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface PostRepository extends JpaRepository<Post, Long> {

    Page<Post> findAllByOrderByCreatedAtDesc(Pageable pageable);

    // category/topic/q는 "필터 없음"을 빈 문자열로 넘긴다. 정렬은 Pageable의 Sort로 결정한다.
    @Query("""
            select p from Post p
            where (:category = '' or p.category = :category)
              and (:topic = '' or p.topic = :topic)
              and (:q = '' or lower(p.title) like lower(concat('%', :q, '%')))
            """)
    Page<Post> search(@Param("category") String category, @Param("topic") String topic,
                      @Param("q") String q, Pageable pageable);

    @Query("select p.category, count(p) from Post p group by p.category")
    List<Object[]> countGroupedByCategory();

    List<Post> findByCategoryIsNull();

    boolean existsByTitle(String title);

    @Modifying
    @Query("update Post p set p.viewCount = p.viewCount + 1 where p.id = :id")
    int incrementViewCount(@Param("id") Long id);

    List<Post> findByAuthorId(Long authorId);

    long countByInstalledPartId(Long partId);

    List<Post> findByInstalledPartIdOrderByCreatedAtDesc(Long partId);

    long countByInstalledPartIdAndRatingIsNotNull(Long partId);

    long countByInstalledPartIdAndCompatibleFeedback(Long partId, String compatibleFeedback);

    long countByInstalledPartIdAndImageUrlIsNotNull(Long partId);

    @Query("select avg(p.rating) from Post p where p.installedPart.id = :partId and p.rating is not null")
    Double findAverageRatingByInstalledPartId(@Param("partId") Long partId);

    // 커뮤니티 목록의 댓글 수를 한 번에 가져오기 위한 집계. 결과: [postId, count]
    @Query("select c.post.id, count(c) from Comment c where c.post.id in :ids group by c.post.id")
    List<Object[]> countCommentsByPostIds(@Param("ids") Collection<Long> ids);
}
