package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.RecentPartCheck;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RecentPartCheckRepository extends JpaRepository<RecentPartCheck, Long> {

    List<RecentPartCheck> findByMemberIdOrderByCheckedAtDesc(Long memberId, Pageable pageable);

    void deleteByMemberId(Long memberId);
}
