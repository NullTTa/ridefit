package com.ridefit.ridefit.dto;

import java.util.List;

// 인기상품 관련 실측 데이터. 출처를 명확히 구분한다:
// - externalSalesCount: 외부 판매처의 실제 판매량(현재는 확인 가능한 데이터 소스가 없어 항상 null)
// - externalRating/externalRatingCount/externalRatingSource: 외부 사이트(Webike 등)의 실제 평점 -
//   관리자가 직접 확인해서 입력했을 때만 값이 있고, RIDEFIT 평점과 절대 합산하지 않는다.
// - viewCount/fitSelectionCount/reviewCount/avgRating 등: RIDEFIT 내부에서 실제로 발생한 사용자 행동
public record PartPopularityStats(
        Integer externalSalesCount,
        Double externalRating,
        Integer externalRatingCount,
        String externalRatingSource,
        long viewCount,
        long fitSelectionCount,
        long reviewCount,
        long ratingCount,
        Double avgRating,
        long positiveFeedbackCount,
        long negativeFeedbackCount,
        long photoReviewCount,
        long sellerCount,
        Integer lowestPrice,
        List<String> badges) {
}
