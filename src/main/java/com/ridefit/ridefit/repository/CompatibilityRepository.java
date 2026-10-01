package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.Compatibility;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CompatibilityRepository extends JpaRepository<Compatibility, Long> {

    List<Compatibility> findByModelYearId(Long modelYearId);

    Optional<Compatibility> findByPartIdAndModelYearId(Long partId, Long modelYearId);

    // 카테고리(머플러, 캐리어 ...) 단위로 호환 차종을 모아볼 때 사용 (부품 정보 페이지).
    @Query("select c from Compatibility c join fetch c.part p join fetch c.modelYear my join fetch my.vehicleModel m "
            + "join fetch m.manufacturer where p.category = :category")
    List<Compatibility> findByPartCategory(@Param("category") String category);

    // 부품별 호환 차량(차종/연식/세대 코드) 목록 - 부품 상세의 "호환 차량", 부품 카드의 "적용 연식"에 사용.
    @Query("select c from Compatibility c join fetch c.part p join fetch c.modelYear my join fetch my.vehicleModel m "
            + "join fetch m.manufacturer where p.id in :partIds")
    List<Compatibility> findByPartIdInWithModel(@Param("partIds") Collection<Long> partIds);
}
