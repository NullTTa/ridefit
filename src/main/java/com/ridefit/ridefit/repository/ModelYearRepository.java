package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.ModelYear;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ModelYearRepository extends JpaRepository<ModelYear, Long> {

    List<ModelYear> findByVehicleModelId(Long vehicleModelId);

    Optional<ModelYear> findByVehicleModelIdAndYear(Long vehicleModelId, Integer year);
}
