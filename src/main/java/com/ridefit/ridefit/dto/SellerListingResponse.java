package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.SellerListing;

public record SellerListingResponse(
        Long id, String sellerName, Integer price, String thumbnailUrl, String sourceUrl, boolean lowestPrice) {

    public static SellerListingResponse from(SellerListing listing, boolean lowestPrice) {
        return new SellerListingResponse(
                listing.getId(), listing.getSellerName(), listing.getPrice(), listing.getThumbnailUrl(),
                listing.getSourceUrl(), lowestPrice);
    }
}
