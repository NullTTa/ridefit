package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.MaintenanceService;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MaintenanceServiceRepository extends JpaRepository<MaintenanceService, Long> {

    Optional<MaintenanceService> findByName(String name);
}
