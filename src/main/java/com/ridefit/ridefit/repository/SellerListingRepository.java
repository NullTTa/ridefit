package com.ridefit.ridefit.repository;

import com.ridefit.ridefit.domain.SellerListing;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SellerListingRepository extends JpaRepository<SellerListing, Long> {

    List<SellerListing> findByPartIdOrderByPriceAsc(Long partId);
}
