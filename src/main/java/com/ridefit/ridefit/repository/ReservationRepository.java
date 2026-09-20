package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    List<Reservation> findByMemberIdOrderByCreatedAtDesc(Long memberId);

    List<Reservation> findByMyVehicleId(Long myVehicleId);

    void deleteByMemberId(Long memberId);
}
