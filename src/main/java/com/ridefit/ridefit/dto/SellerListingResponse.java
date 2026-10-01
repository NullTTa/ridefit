package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.SellerListing;

import java.time.LocalDateTime;

// price가 null이면 "가격 확인 필요"로 표시해야 한다(0원 표시 금지).
// sample=true는 실제로 존재할 수 없는 예약 도메인(.test)의 예시 판매처 - 링크/최저가 비교 대상이 아니다.
// lowestPrice는 "가격이 확인된 실제 판매처가 2곳 이상"이라 비교가 성립할 때만 true가 될 수 있다.
public record SellerListingResponse(
        Long id, String sellerName, Integer price, String thumbnailUrl, String sourceUrl, boolean lowestPrice,
        String productName, String originalImageUrl, String externalProductId, LocalDateTime checkedAt,
        LocalDateTime createdAt, boolean sample,
        // 화면 표시용 상품명(없으면 null -> productName을 그대로 표시). productName은 판매처 원본.
        String displayName) {

    public static SellerListingResponse from(SellerListing listing, boolean lowestPrice) {
        return new SellerListingResponse(
                listing.getId(), listing.getSellerName(), listing.getPrice(), listing.getThumbnailUrl(),
                listing.getSourceUrl(), lowestPrice, listing.getProductName(), listing.getOriginalImageUrl(),
                listing.getExternalProductId(), listing.getCheckedAt(), listing.getCreatedAt(), listing.isSample(),
                listing.getDisplayName());
    }
}
