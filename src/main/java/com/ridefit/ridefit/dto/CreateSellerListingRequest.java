package com.ridefit.ridefit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

// price는 확인된 경우에만 보낸다(모르면 null → 화면에 "가격 확인 필요"). 0/음수는 거부한다.
// thumbnailUrl은 판매처의 원본 이미지 URL - 서버가 내부 저장을 시도하고, 실패하면 원본 URL만 보존한다.
public record CreateSellerListingRequest(
        @NotBlank @Size(max = 255, message = "URL/이름은 255자 이하만 저장할 수 있어요. 더 짧은 주소를 사용해주세요.") String sellerName, @Positive Integer price, @Size(max = 255, message = "URL/이름은 255자 이하만 저장할 수 있어요. 더 짧은 주소를 사용해주세요.") String thumbnailUrl,
        @NotBlank @Size(max = 255, message = "URL/이름은 255자 이하만 저장할 수 있어요. 더 짧은 주소를 사용해주세요.") String sourceUrl, @Size(max = 255, message = "URL/이름은 255자 이하만 저장할 수 있어요. 더 짧은 주소를 사용해주세요.") String productName,
        @Size(max = 255, message = "URL/이름은 255자 이하만 저장할 수 있어요. 더 짧은 주소를 사용해주세요.") String externalProductId) {
}
