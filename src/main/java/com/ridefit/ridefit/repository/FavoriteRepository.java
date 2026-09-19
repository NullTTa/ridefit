package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.Favorite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FavoriteRepository extends JpaRepository<Favorite, Long> {

    List<Favorite> findByMemberIdOrderByCreatedAtDesc(Long memberId);

    Optional<Favorite> findByMemberIdAndPartId(Long memberId, Long partId);

    boolean existsByMemberIdAndPartId(Long memberId, Long partId);

    void deleteByMemberIdAndPartId(Long memberId, Long partId);

    void deleteByMemberId(Long memberId);
}
