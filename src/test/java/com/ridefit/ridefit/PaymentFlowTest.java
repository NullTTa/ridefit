package com.ridefit.ridefit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.Payment;
import com.ridefit.ridefit.domain.PaymentStatus;
import com.ridefit.ridefit.domain.PurchaseOrder;
import com.ridefit.ridefit.domain.Reservation;
import com.ridefit.ridefit.domain.ServiceShop;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.PaymentRepository;
import com.ridefit.ridefit.repository.ReservationRepository;
import com.ridefit.ridefit.repository.ServiceShopRepository;
import com.ridefit.ridefit.repository.ShopMaintenancePriceRepository;
import com.ridefit.ridefit.service.TossPaymentsClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Toss Payments 테스트 결제 흐름(Toss API는 목으로 대신 - 실제 결제/네트워크 호출 없음).
// 금액은 서버가 DB 가격으로 계산하고, 프론트가 보낸 금액이 다르면 Toss에 요청하지 않고 FAILED로 끝나야 한다.
@SpringBootTest
@AutoConfigureMockMvc
class PaymentFlowTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private PartRepository partRepository;
    @Autowired
    private PaymentRepository paymentRepository;
    @Autowired
    private ReservationRepository reservationRepository;
    @Autowired
    private ServiceShopRepository serviceShopRepository;
    @Autowired
    private ShopMaintenancePriceRepository shopMaintenancePriceRepository;
    @Autowired
    private PlatformTransactionManager transactionManager;

    @MockitoBean
    private TossPaymentsClient tossPaymentsClient;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void testKey() {
        when(tossPaymentsClient.isConfigured()).thenReturn(true);
        when(tossPaymentsClient.isTestKey()).thenReturn(true);
    }

    @Test
    void 부품_결제는_서버_가격으로만_승인되고_변조_중복_타인_접근을_막는다() throws Exception {
        String user = login("user@ridefit.dev", "user1234!");
        String admin = login("admin@ridefit.dev", "admin1234!");
        Part part = partRepository.findByName("KITACO 캐리어").orElseThrow();
        int price = part.getPrice();

        // 미리보기: 서버 가격 x 수량(DB에 아무것도 만들지 않음)
        JsonNode quote = send(get("/api/payments/quote/part?partId=" + part.getId() + "&quantity=2"), user, 200);
        assertThat(quote.get("amount").asInt()).isEqualTo(price * 2);

        // 결제 준비: 요청에 금액이 없어도 서버가 계산한다(amount 필드를 넣어도 무시)
        JsonNode checkout = checkoutPart(user, part.getId(), 2);
        String orderId = checkout.get("orderId").asText();
        assertThat(checkout.get("amount").asInt()).isEqualTo(price * 2);
        assertThat(checkout.get("orderType").asText()).isEqualTo("PART");

        // 금액 변조(100원) -> 400, Toss 호출 없음, FAILED
        send(confirm(orderId, "pk_tampered", 100), user, 400);
        verify(tossPaymentsClient, never()).confirm(anyString(), anyString(), anyInt());
        assertThat(paymentRepository.findByOrderId(orderId).orElseThrow().getStatus()).isEqualTo(PaymentStatus.FAILED);
        // 이미 실패한 주문은 다시 승인할 수 없다
        send(confirm(orderId, "pk_retry", price * 2), user, 409);

        // 정상 결제
        String orderId2 = checkoutPart(user, part.getId(), 1).get("orderId").asText();
        when(tossPaymentsClient.confirm("pk_ok_1", orderId2, price))
                .thenReturn(new TossPaymentsClient.ConfirmResult("pk_ok_1", orderId2, "DONE", "카드", price, OffsetDateTime.now()));
        // 로그인 없이 승인 요청 -> 401
        send(confirm(orderId2, "pk_ok_1", price), null, 401);
        // 다른 회원 -> 403
        send(confirm(orderId2, "pk_ok_1", price), admin, 403);
        send(get("/api/me/payments/" + orderId2), admin, 403);
        // 없는 주문번호 -> 404
        send(confirm("RF-P-doesnotexist000000", "pk_x", price), user, 404);

        JsonNode paid = send(confirm(orderId2, "pk_ok_1", price), user, 200);
        assertThat(paid.get("status").asText()).isEqualTo("PAID");
        assertThat(paid.get("method").asText()).isEqualTo("카드");
        assertThat(paid.get("items").get(0).get("quantity").asInt()).isEqualTo(1);
        Payment saved = paymentRepository.findByOrderId(orderId2).orElseThrow();
        assertThat(saved.getPaymentKey()).isEqualTo("pk_ok_1");
        assertThat(saved.getPaidAt()).isNotNull();
        inTx(() -> assertThat(paymentRepository.findByOrderId(orderId2).orElseThrow().getPurchaseOrder().getStatus())
                .isEqualTo(PurchaseOrder.STATUS_PAID));

        // 같은 결제를 다시 확인(새로고침) -> 200, Toss는 한 번만 호출
        send(confirm(orderId2, "pk_ok_1", price), user, 200);
        verify(tossPaymentsClient, times(1)).confirm(eq("pk_ok_1"), anyString(), anyInt());
        // 다른 키로 같은 주문을 또 승인(중복 결제) -> 409
        send(confirm(orderId2, "pk_other", price), user, 409);
        // 이미 쓴 paymentKey를 다른 주문에 -> 409
        String orderId3 = checkoutPart(user, part.getId(), 1).get("orderId").asText();
        send(confirm(orderId3, "pk_ok_1", price), user, 409);

        // Toss가 거절 -> 400 + Toss 문구, FAILED
        String orderId4 = checkoutPart(user, part.getId(), 1).get("orderId").asText();
        when(tossPaymentsClient.confirm("pk_reject", orderId4, price))
                .thenThrow(new TossPaymentsClient.TossApiException(400, "REJECT_CARD_PAYMENT", "한도초과 혹은 잔액부족으로 결제에 실패했습니다."));
        JsonNode rejected = send(confirm(orderId4, "pk_reject", price), user, 400);
        assertThat(rejected.get("message").asText()).contains("잔액부족");
        assertThat(paymentRepository.findByOrderId(orderId4).orElseThrow().getStatus()).isEqualTo(PaymentStatus.FAILED);

        // 결제창 닫기 -> CANCELED
        String orderId5 = checkoutPart(user, part.getId(), 1).get("orderId").asText();
        send(post("/api/payments/fail").contentType(MediaType.APPLICATION_JSON)
                .content("{\"orderId\":\"%s\",\"code\":\"PAY_PROCESS_CANCELED\",\"message\":\"사용자 취소\"}".formatted(orderId5)), user, 200);
        assertThat(paymentRepository.findByOrderId(orderId5).orElseThrow().getStatus()).isEqualTo(PaymentStatus.CANCELED);

        // 내 결제: 본인 것만, 결제창 직전(READY) 건 제외
        JsonNode mine = send(get("/api/me/payments"), user, 200);
        assertThat(mine.toString()).contains(orderId2).doesNotContain(orderId3);
        assertThat(send(get("/api/me/payments"), admin, 200).toString()).doesNotContain(orderId2);
    }

    @Test
    void 결제_준비_뒤_가격이_바뀌면_승인하지_않는다() throws Exception {
        String user = login("user@ridefit.dev", "user1234!");
        Part part = partRepository.findByName("KITACO 캐리어").orElseThrow();
        int original = part.getPrice();
        String orderId = checkoutPart(user, part.getId(), 1).get("orderId").asText();
        inTx(() -> partRepository.findById(part.getId()).orElseThrow().setPrice(original + 1000));
        try {
            send(confirm(orderId, "pk_price_changed", original), user, 400);
            verify(tossPaymentsClient, never()).confirm(eq("pk_price_changed"), anyString(), anyInt());
        } finally {
            inTx(() -> partRepository.findById(part.getId()).orElseThrow().setPrice(original));
        }
    }

    @Test
    void 예약_결제가_승인되면_예약이_확정되고_실패하면_확정되지_않는다() throws Exception {
        String user = login("user@ridefit.dev", "user1234!");
        String admin = login("admin@ridefit.dev", "admin1234!");
        ServiceShop shop = serviceShopRepository.findAll().stream()
                .filter(s -> s.getMenus().contains("엔진오일 교환")
                        && shopMaintenancePriceRepository.findByShop_IdAndService_Name(s.getId(), "엔진오일 교환").isPresent())
                .findFirst().orElseThrow();
        String preferredAt = LocalDateTime.now().plusDays(3).withNano(0).toString();
        JsonNode created = send(post("/api/reservations").contentType(MediaType.APPLICATION_JSON).content("""
                {"shopId":%d,"items":[{"serviceName":"엔진오일 교환","oilType":"FULL_SYNTHETIC"}],"preferredAt":"%s"}
                """.formatted(shop.getId(), preferredAt)), user, 201);
        long reservationId = created.get("id").asLong();
        int total = created.get("totalPrice").asInt();
        assertThat(created.get("status").asText()).isEqualTo(Reservation.STATUS_REQUESTED);

        // 다른 회원은 결제 준비 불가
        send(post("/api/payments/checkout/reservation").contentType(MediaType.APPLICATION_JSON)
                .content("{\"reservationId\":%d}".formatted(reservationId)), admin, 403);

        // 실패한 결제 -> 예약은 그대로 REQUESTED
        String failedOrder = checkoutReservation(user, reservationId).get("orderId").asText();
        when(tossPaymentsClient.confirm("pk_r_fail", failedOrder, total))
                .thenThrow(new TossPaymentsClient.TossApiException(400, "INVALID_CARD_EXPIRATION", "카드 정보를 다시 확인해주세요."));
        send(confirm(failedOrder, "pk_r_fail", total), user, 400);
        assertThat(reservationRepository.findById(reservationId).orElseThrow().getStatus()).isEqualTo(Reservation.STATUS_REQUESTED);

        // 다시 결제 -> 승인 -> 예약 확정
        JsonNode checkout = checkoutReservation(user, reservationId);
        assertThat(checkout.get("amount").asInt()).isEqualTo(total);
        assertThat(checkout.get("orderType").asText()).isEqualTo("RESERVATION");
        String orderId = checkout.get("orderId").asText();
        when(tossPaymentsClient.confirm("pk_r_ok", orderId, total))
                .thenReturn(new TossPaymentsClient.ConfirmResult("pk_r_ok", orderId, "DONE", "간편결제", total, OffsetDateTime.now()));
        JsonNode paid = send(confirm(orderId, "pk_r_ok", total), user, 200);
        assertThat(paid.get("reservation").get("status").asText()).isEqualTo(Reservation.STATUS_CONFIRMED);
        assertThat(paid.get("reservation").get("services").get(0).asText()).contains("엔진오일 교환");
        assertThat(reservationRepository.findById(reservationId).orElseThrow().getStatus()).isEqualTo(Reservation.STATUS_CONFIRMED);

        // 확정된 예약: 다시 결제 준비 409, 바로 취소 409(환불 기능 없음)
        send(post("/api/payments/checkout/reservation").contentType(MediaType.APPLICATION_JSON)
                .content("{\"reservationId\":%d}".formatted(reservationId)), user, 409);
        send(post("/api/reservations/" + reservationId + "/cancel"), user, 409);
    }

    @Test
    void 라이브_키면_결제를_시작하지_않는다() throws Exception {
        when(tossPaymentsClient.isTestKey()).thenReturn(false);
        String user = login("user@ridefit.dev", "user1234!");
        Part part = partRepository.findByName("KITACO 캐리어").orElseThrow();
        send(post("/api/payments/checkout/parts").contentType(MediaType.APPLICATION_JSON)
                .content("{\"items\":[{\"partId\":%d,\"quantity\":1}]}".formatted(part.getId())), user, 503);
    }

    private JsonNode checkoutPart(String token, long partId, int quantity) throws Exception {
        return send(post("/api/payments/checkout/parts").contentType(MediaType.APPLICATION_JSON)
                .content("{\"items\":[{\"partId\":%d,\"quantity\":%d}],\"amount\":1}".formatted(partId, quantity)), token, 200);
    }

    private JsonNode checkoutReservation(String token, long reservationId) throws Exception {
        return send(post("/api/payments/checkout/reservation").contentType(MediaType.APPLICATION_JSON)
                .content("{\"reservationId\":%d}".formatted(reservationId)), token, 200);
    }

    private MockHttpServletRequestBuilder confirm(String orderId, String paymentKey, int amount) {
        return post("/api/payments/confirm").contentType(MediaType.APPLICATION_JSON)
                .content("{\"paymentKey\":\"%s\",\"orderId\":\"%s\",\"amount\":%d}".formatted(paymentKey, orderId, amount));
    }

    private void inTx(Runnable r) {
        new TransactionTemplate(transactionManager).executeWithoutResult(s -> r.run());
    }

    private String login(String email, String password) throws Exception {
        return send(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password)), null, 200).get("token").asText();
    }

    private JsonNode send(MockHttpServletRequestBuilder req, String token, int expected) throws Exception {
        if (token != null) req.header("Authorization", "Bearer " + token);
        String body = mockMvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return body.isBlank() ? objectMapper.nullNode() : objectMapper.readTree(body);
    }
}
