package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.PartConflict;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PartConflictRepository extends JpaRepository<PartConflict, Long> {

    @Query("select pc from PartConflict pc where pc.partA.id in :partIds or pc.partB.id in :partIds")
    List<PartConflict> findByPartIdsInvolved(@Param("partIds") List<Long> partIds);
}
