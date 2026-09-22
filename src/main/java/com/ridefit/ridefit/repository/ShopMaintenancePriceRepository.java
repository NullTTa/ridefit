package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.ShopMaintenancePrice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ShopMaintenancePriceRepository extends JpaRepository<ShopMaintenancePrice, Long> {

    List<ShopMaintenancePrice> findByShopId(Long shopId);

    Optional<ShopMaintenancePrice> findByShop_IdAndService_Name(Long shopId, String serviceName);
}
