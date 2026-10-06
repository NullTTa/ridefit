package com.ridefit.ridefit.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Map;

// Toss Payments 서버 API(결제 승인/취소). 시크릿 키는 환경변수 TOSS_SECRET_KEY로만 받고(코드/깃/로그에 남기지 않음),
// 이 서버에서만 쓴다(프론트로 절대 보내지 않음). RIDEFIT은 테스트 결제만 허용한다 - test_로 시작하지 않는 키(라이브 키)는 거절한다.
@Slf4j
@Component
public class TossPaymentsClient {

    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final String secretKey;
    private final String apiBaseUrl;

    public TossPaymentsClient(@Value("${toss.secret-key:}") String secretKey,
                              @Value("${toss.api-base-url:https://api.tosspayments.com}") String apiBaseUrl) {
        this.secretKey = secretKey == null ? "" : secretKey.trim();
        this.apiBaseUrl = apiBaseUrl;
    }

    // 승인된 결제 정보 중 RIDEFIT이 쓰는 값만.
    public record ConfirmResult(String paymentKey, String orderId, String status, String method,
                                Integer totalAmount, OffsetDateTime approvedAt) {
    }

    // Toss가 돌려준 오류(또는 통신 실패). code/message는 Toss 오류 코드/문구(통신 실패면 NETWORK_ERROR).
    public static class TossApiException extends RuntimeException {
        private final int httpStatus;
        private final String code;

        public TossApiException(int httpStatus, String code, String message) {
            super(message);
            this.httpStatus = httpStatus;
            this.code = code;
        }

        public int httpStatus() {
            return httpStatus;
        }

        public String code() {
            return code;
        }
    }

    public boolean isConfigured() {
        return !secretKey.isEmpty();
    }

    // 테스트 키(test_sk_..., test_gsk_...)일 때만 결제를 진행한다. 라이브 키가 들어오면 실결제가 될 수 있어 막는다.
    public boolean isTestKey() {
        return secretKey.startsWith("test_");
    }

    public ConfirmResult confirm(String paymentKey, String orderId, int amount) {
        JsonNode body = post("/v1/payments/confirm", Map.of("paymentKey", paymentKey, "orderId", orderId, "amount", amount));
        return new ConfirmResult(
                text(body, "paymentKey"), text(body, "orderId"), text(body, "status"), text(body, "method"),
                body.hasNonNull("totalAmount") ? body.get("totalAmount").asInt() : null,
                body.hasNonNull("approvedAt") ? OffsetDateTime.parse(body.get("approvedAt").asText()) : null);
    }

    // 승인 후 서버 저장이 실패했을 때 돈이 빠져나간 채로 남지 않도록 되돌리는 데 쓴다.
    public void cancel(String paymentKey, String reason) {
        post("/v1/payments/" + URLEncoder.encode(paymentKey, StandardCharsets.UTF_8) + "/cancel", Map.of("cancelReason", reason));
    }

    private JsonNode post(String path, Map<String, Object> payload) {
        if (!isConfigured()) {
            throw new TossApiException(503, "NOT_CONFIGURED", "결제 설정이 아직 되지 않았어요.");
        }
        if (!isTestKey()) {
            // 키 값은 로그에 남기지 않는다.
            log.error("Toss 결제: 테스트 키가 아니어서 요청을 보내지 않음(라이브 결제 차단)");
            throw new TossApiException(503, "LIVE_KEY_BLOCKED", "테스트 결제 환경에서만 결제할 수 있어요.");
        }
        String auth = Base64.getEncoder().encodeToString((secretKey + ":").getBytes(StandardCharsets.UTF_8));
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(apiBaseUrl + path))
                    .timeout(Duration.ofSeconds(30))
                    .header("Authorization", "Basic " + auth)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode json = response.body() == null || response.body().isBlank()
                    ? objectMapper.createObjectNode() : objectMapper.readTree(response.body());
            if (response.statusCode() / 100 != 2) {
                throw new TossApiException(response.statusCode(),
                        json.hasNonNull("code") ? json.get("code").asText() : "TOSS_ERROR",
                        json.hasNonNull("message") ? json.get("message").asText() : "결제사 응답 오류");
            }
            return json;
        } catch (IOException e) {
            throw new TossApiException(502, "NETWORK_ERROR", "결제사와 통신하지 못했어요.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new TossApiException(502, "NETWORK_ERROR", "결제사와 통신하지 못했어요.");
        }
    }

    private static String text(JsonNode node, String field) {
        return node.hasNonNull(field) ? node.get(field).asText() : null;
    }
}
