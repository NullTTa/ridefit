package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.MyVehicle;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MyVehicleRepository extends JpaRepository<MyVehicle, Long> {
}
