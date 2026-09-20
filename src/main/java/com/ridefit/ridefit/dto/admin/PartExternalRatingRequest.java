package com.ridefit.ridefit.dto.admin;

// 외부 사이트(Webike 등)에서 실제로 확인한 평점만 입력한다. 값을 임의로 추정하지 않는다.
public record PartExternalRatingRequest(Double externalRating, Integer externalRatingCount, String externalRatingSource) {
}
