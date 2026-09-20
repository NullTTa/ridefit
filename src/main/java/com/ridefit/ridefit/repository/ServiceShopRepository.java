package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.ServiceShop;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ServiceShopRepository extends JpaRepository<ServiceShop, Long> {

    List<ServiceShop> findByTypeOrderByIdAsc(String type);

    Optional<ServiceShop> findByName(String name);
}
