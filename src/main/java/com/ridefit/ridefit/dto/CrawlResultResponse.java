package com.ridefit.ridefit.dto;

// success=false면 크롤링(봇 차단, JS 렌더링, 공식 API 필요 등)에 실패한 정상적인 상황이다.
// 프론트엔드는 이 경우 에러 화면 대신 수동 입력 폼으로 자연스럽게 전환해야 한다.
//
// price는 페이지에 구조화된 가격(JSON-LD offers / product:price 메타)이 원화(KRW)로 명시돼 있을 때만 채운다.
// 본문 텍스트에서 "숫자+원"을 추측하지 않는다(배송비/할인 전 가격을 잘못 집는 문제).
// dataSource: 상품명/이미지를 어디서 읽었는지("JSON-LD" / "Open Graph" / "meta") - 관리자 확인용.
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
        String failReason,
        String sellerName,
        String brand,
        String externalProductId,
        String dataSource,
        String finalUrl) {

    public static CrawlResultResponse failure(String reason, String sellerName) {
        return new CrawlResultResponse(false, null, null, null, null, null, null, null, null, reason,
                sellerName, null, null, null, null);
    }
}
