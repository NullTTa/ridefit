package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.Manufacturer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ManufacturerRepository extends JpaRepository<Manufacturer, Long> {

    Optional<Manufacturer> findByName(String name);
}
