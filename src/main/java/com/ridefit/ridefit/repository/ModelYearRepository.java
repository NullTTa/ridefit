package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.ModelYear;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ModelYearRepository extends JpaRepository<ModelYear, Long> {

    List<ModelYear> findByVehicleModelId(Long vehicleModelId);
}
