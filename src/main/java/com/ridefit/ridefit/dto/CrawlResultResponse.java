package com.ridefit.ridefit.dto;

// success=false면 크롤링(봇 차단, JS 렌더링 등)에 실패한 정상적인 상황이다.
// 프론트엔드는 이 경우 에러 화면 대신 수동 입력 폼으로 자연스럽게 전환해야 한다.
public record CrawlResultResponse(
        boolean success,
        String title,
        Integer price,
        String imageUrl,
        String category,
        Long matchedVehicleModelId,
        String matchedVehicleModelName,
        Long matchedModelYearId,
        Integer matchedYear,
        String failReason) {
}
