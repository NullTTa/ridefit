package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.PurchaseOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, Long> {

    List<PurchaseOrder> findByMyVehicleId(Long myVehicleId);
}
