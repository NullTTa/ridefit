package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.AiFitResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

public interface AiFitResultRepository extends JpaRepository<AiFitResult, Long> {

    Optional<AiFitResult> findByCacheKey(String cacheKey);

    long countByCreatedAtAfter(LocalDateTime since);
}
