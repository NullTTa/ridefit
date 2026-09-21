package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.MaintenanceSpec;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MaintenanceSpecRepository extends JpaRepository<MaintenanceSpec, Long> {
    List<MaintenanceSpec> findByVehicleModelId(Long vehicleModelId);

    Optional<MaintenanceSpec> findByVehicleModelIdAndCategory(Long vehicleModelId, String category);
}
