package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.SellerListing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SellerListingRepository extends JpaRepository<SellerListing, Long> {

    List<SellerListing> findByPartIdOrderByPriceAsc(Long partId);

    long countByPartId(Long partId);

    // 시드 중복 방지용: 같은 부품의 같은 판매처 상품 링크가 이미 있는지.
    Optional<SellerListing> findFirstByPartIdAndSourceUrl(Long partId, String sourceUrl);

    // 관리자 "판매처 가격 관리" 목록(부품 이름/가격순, 부품 필터 선택)
    @Query("select l from SellerListing l join fetch l.part p where (:partId is null or p.id = :partId) order by p.name asc, l.price asc")
    List<SellerListing> findAllForAdmin(@Param("partId") Long partId);

    // 판매처 이름 선택지(이미 등록된 판매처 이름, 중복 제거)
    @Query("select distinct l.sellerName from SellerListing l where l.sellerName is not null order by l.sellerName")
    List<String> findDistinctSellerNames();
}
