package com.ridefit.ridefit.dto;

import java.util.List;

// 유사 차량 추천 결과. reasons는 실제로 비교에 쓴 필드(배기량/차체/가격대/성향)에서 만든 문장이다.
public record SimilarVehicleResponse(
        VehicleSummaryResponse vehicle, int similarityPercent, List<String> reasons, String basedOnName) {
}
