package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.Post;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PostRepository extends JpaRepository<Post, Long> {

    Page<Post> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<Post> findByAuthorId(Long authorId);

    long countByInstalledPartId(Long partId);

    List<Post> findByInstalledPartIdOrderByCreatedAtDesc(Long partId);

    long countByInstalledPartIdAndRatingIsNotNull(Long partId);

    long countByInstalledPartIdAndCompatibleFeedback(Long partId, String compatibleFeedback);

    long countByInstalledPartIdAndImageUrlIsNotNull(Long partId);

    @Query("select avg(p.rating) from Post p where p.installedPart.id = :partId and p.rating is not null")
    Double findAverageRatingByInstalledPartId(@Param("partId") Long partId);
}
