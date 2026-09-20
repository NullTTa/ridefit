package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.GuideArticle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GuideArticleRepository extends JpaRepository<GuideArticle, Long> {

    Optional<GuideArticle> findBySlug(String slug);

    List<GuideArticle> findByTypeOrderBySortOrderAscIdAsc(String type);

    List<GuideArticle> findAllByOrderBySortOrderAscIdAsc();

    List<GuideArticle> findByPartCategory(String partCategory);
}
