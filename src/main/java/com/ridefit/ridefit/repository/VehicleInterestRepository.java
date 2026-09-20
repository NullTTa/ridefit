package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.VehicleInterest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VehicleInterestRepository extends JpaRepository<VehicleInterest, Long> {

    List<VehicleInterest> findByMemberIdOrderByCreatedAtDesc(Long memberId);

    Optional<VehicleInterest> findByMemberIdAndVehicleModelId(Long memberId, Long vehicleModelId);

    boolean existsByMemberIdAndVehicleModelId(Long memberId, Long vehicleModelId);

    void deleteByMemberId(Long memberId);
}
