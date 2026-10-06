package com.ridefit.ridefit.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.List;

public class PaymentDtos {

    public record PartOrderItemRequest(@NotNull Long partId, @NotNull Integer quantity) {
    }

    // 부품/오일 구매 결제 준비. 금액 필드는 받지 않는다(서버가 DB 가격으로 계산).
    public record PartCheckoutRequest(@NotEmpty List<@Valid PartOrderItemRequest> items, Long myVehicleId) {
    }

    public record ReservationCheckoutRequest(@NotNull Long reservationId) {
    }

    // 결제창을 띄우는 데 필요한 값(전부 서버가 확정). amount는 화면 표시/결제창 금액이고, 승인 때 서버가 다시 검증한다.
    public record CheckoutResponse(String orderId, String orderName, int amount, String orderType) {
    }

    // 결제 전 주문 확인 화면용(서버 가격 기준 미리보기 - DB에 아무것도 만들지 않는다).
    public record PartQuoteResponse(Long partId, String name, String category, String imageUrl, int unitPrice,
                                    int quantity, int amount, String orderType) {
    }

    public record ConfirmRequest(@NotBlank String paymentKey, @NotBlank String orderId, @NotNull Integer amount) {
    }

    // 결제창에서 실패/취소로 돌아왔을 때(Toss failUrl의 code/message).
    public record FailRequest(@NotBlank String orderId, String code, String message) {
    }

    public record PaymentItemView(String name, String category, Integer quantity, Integer unitPrice, Integer lineAmount) {
    }

    public record ReservationView(Long reservationId, String shopName, LocalDateTime preferredAt, List<String> services,
                                  String status) {
    }

    public record PaymentView(String orderId, String orderType, String orderName, int amount, String status,
                              String method, LocalDateTime paidAt, LocalDateTime createdAt, String failureMessage,
                              List<PaymentItemView> items, ReservationView reservation) {
    }
}
