package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.DailyUsage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface DailyUsageRepository extends JpaRepository<DailyUsage, Long> {

    Optional<DailyUsage> findByMemberIdAndUsageDate(Long memberId, LocalDate usageDate);

    void deleteByMemberId(Long memberId);
}
