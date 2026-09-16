package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.Member;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberRepository extends JpaRepository<Member, Long> {
}
