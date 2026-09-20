package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.VehicleModel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VehicleModelRepository extends JpaRepository<VehicleModel, Long> {

    List<VehicleModel> findByManufacturerId(Long manufacturerId);

    Optional<VehicleModel> findByManufacturerIdAndName(Long manufacturerId, String name);
}
