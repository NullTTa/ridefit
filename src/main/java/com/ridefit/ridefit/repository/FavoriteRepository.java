package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.Favorite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FavoriteRepository extends JpaRepository<Favorite, Long> {

    List<Favorite> findByMemberIdOrderByCreatedAtDesc(Long memberId);

    Optional<Favorite> findByMemberIdAndPartId(Long memberId, Long partId);

    boolean existsByMemberIdAndPartId(Long memberId, Long partId);

    void deleteByMemberIdAndPartId(Long memberId, Long partId);

    void deleteByMemberId(Long memberId);

    // 차량별 저장 부품
    List<Favorite> findByMemberIdAndMyVehicleIdOrderByCreatedAtDesc(Long memberId, Long myVehicleId);

    boolean existsByMemberIdAndMyVehicleIdAndPartId(Long memberId, Long myVehicleId, Long partId);

    void deleteByMemberIdAndMyVehicleIdAndPartId(Long memberId, Long myVehicleId, Long partId);

    void deleteByMyVehicleId(Long myVehicleId);

    // 차량 구분 없이 저장된 예전 즐겨찾기(myVehicle null)
    List<Favorite> findByMemberIdAndMyVehicleIsNullOrderByCreatedAtDesc(Long memberId);

    boolean existsByMemberIdAndMyVehicleIsNullAndPartId(Long memberId, Long partId);

    void deleteByMemberIdAndMyVehicleIsNullAndPartId(Long memberId, Long partId);
}
