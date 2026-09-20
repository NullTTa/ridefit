package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.VehicleProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface VehicleProfileRepository extends JpaRepository<VehicleProfile, Long> {

    Optional<VehicleProfile> findByVehicleModelId(Long vehicleModelId);

    // 차종/제조사까지 한 번에 로딩 (추천 계산과 목록에서 N+1을 피하기 위함)
    @Query("select p from VehicleProfile p join fetch p.vehicleModel m join fetch m.manufacturer")
    List<VehicleProfile> findAllWithModel();
}
