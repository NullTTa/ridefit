package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.MyVehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MyVehicleRepository extends JpaRepository<MyVehicle, Long> {

    List<MyVehicle> findByMemberId(Long memberId);
}
