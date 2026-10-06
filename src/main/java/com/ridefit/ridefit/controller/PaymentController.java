package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.dto.PaymentDtos.CheckoutResponse;
import com.ridefit.ridefit.dto.PaymentDtos.ConfirmRequest;
import com.ridefit.ridefit.dto.PaymentDtos.FailRequest;
import com.ridefit.ridefit.dto.PaymentDtos.PartCheckoutRequest;
import com.ridefit.ridefit.dto.PaymentDtos.PartQuoteResponse;
import com.ridefit.ridefit.dto.PaymentDtos.PaymentView;
import com.ridefit.ridefit.dto.PaymentDtos.ReservationCheckoutRequest;
import com.ridefit.ridefit.security.CurrentMember;
import com.ridefit.ridefit.service.PaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

// Toss Payments 테스트 결제 API. 모두 로그인 필요(SecurityConfig: anyRequest().authenticated()), 회원은 항상 JWT 기준(CurrentMember).
// 금액은 요청에서 받지 않거나(checkout), 받더라도 서버 계산 금액과 비교하는 데만 쓴다(confirm).
@RestController
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final CurrentMember currentMember;

    // 주문 확인 화면용 미리보기(DB에 아무것도 만들지 않음, 부품 조회수도 올리지 않음).
    @GetMapping("/api/payments/quote/part")
    public PartQuoteResponse quotePart(@RequestParam Long partId, @RequestParam(defaultValue = "1") int quantity) {
        return paymentService.quotePart(partId, quantity);
    }

    @PostMapping("/api/payments/checkout/parts")
    public CheckoutResponse checkoutParts(@Valid @RequestBody PartCheckoutRequest request) {
        return paymentService.checkoutParts(currentMember.id(), request.items(), request.myVehicleId());
    }

    @PostMapping("/api/payments/checkout/reservation")
    public CheckoutResponse checkoutReservation(@Valid @RequestBody ReservationCheckoutRequest request) {
        return paymentService.checkoutReservation(currentMember.id(), request.reservationId());
    }

    @PostMapping("/api/payments/confirm")
    public PaymentView confirm(@Valid @RequestBody ConfirmRequest request) {
        return paymentService.confirm(currentMember.id(), request.paymentKey(), request.orderId(), request.amount());
    }

    @PostMapping("/api/payments/fail")
    public PaymentView fail(@Valid @RequestBody FailRequest request) {
        return paymentService.fail(currentMember.id(), request.orderId(), request.code(), request.message());
    }

    @GetMapping("/api/me/payments")
    public List<PaymentView> myPayments() {
        return paymentService.myPayments(currentMember.id());
    }

    @GetMapping("/api/me/payments/{orderId}")
    public PaymentView detail(@PathVariable String orderId) {
        return paymentService.detail(currentMember.id(), orderId);
    }
}
