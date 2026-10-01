package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.SellerListing;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SellerListingRepository extends JpaRepository<SellerListing, Long> {

    List<SellerListing> findByPartIdOrderByPriceAsc(Long partId);

    long countByPartId(Long partId);

    // 시드 중복 방지용: 같은 부품의 같은 판매처 상품 링크가 이미 있는지.
    Optional<SellerListing> findFirstByPartIdAndSourceUrl(Long partId, String sourceUrl);
}
