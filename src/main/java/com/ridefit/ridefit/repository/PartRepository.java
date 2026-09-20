package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.Part;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PartRepository extends JpaRepository<Part, Long> {

    List<Part> findByCategory(String category);

    Optional<Part> findByName(String name);
}
