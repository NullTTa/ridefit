package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.Compatibility;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CompatibilityRepository extends JpaRepository<Compatibility, Long> {

    List<Compatibility> findByModelYearId(Long modelYearId);
}
