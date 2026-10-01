package com.ridefit.ridefit.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
import java.util.Base64;
import java.util.List;

// Gemini API 이미지 생성/편집(POST /v1beta/models/{model}:generateContent) 최소 클라이언트.
// 입력 이미지 여러 장 + 프롬프트를 보내고, 응답에 들어 있는 이미지 한 장을 돌려준다.
// 모델은 코드에 고정하지 않고 설정(GEMINI_IMAGE_MODEL)으로 바꾼다.
// API 키는 GEMINI_API_KEY로만 받고 헤더(x-goog-api-key)로 보낸다 - URL/로그/응답에 절대 남기지 않는다.
@Slf4j
@Component
public class GeminiImageClient {

    private static final String ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";

    @Value("${gemini.api-key:}")
    private String apiKey;

    @Value("${gemini.image.model:gemini-2.5-flash-image}")
    private String model;

    @Value("${gemini.image.timeout-seconds:180}")
    private int timeoutSeconds;

    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Gemini가 오류로 응답했을 때. status는 Gemini 응답 코드(429=한도/요금, 400=요청 거부, 403=키 문제 등).
    public static class GeminiImageException extends IOException {
        private final int status;

        public GeminiImageException(int status, String message) {
            super(message);
            this.status = status;
        }

        public int status() {
            return status;
        }
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public String model() {
        return model;
    }

    public byte[] edit(List<OpenAiImageClient.InputImage> images, String prompt) throws IOException, InterruptedException {
        ObjectNode root = objectMapper.createObjectNode();
        ArrayNode parts = root.putArray("contents").addObject().putArray("parts");
        // 프롬프트가 "Image 1, Image 2..."로 가리키므로 이미지를 받은 순서 그대로 넣는다.
        for (OpenAiImageClient.InputImage image : images) {
            ObjectNode inline = parts.addObject().putObject("inline_data");
            inline.put("mime_type", image.mimeType());
            inline.put("data", Base64.getEncoder().encodeToString(image.bytes()));
        }
        parts.addObject().put("text", prompt);
        root.putObject("generationConfig").putArray("responseModalities").add("TEXT").add("IMAGE");

        HttpRequest request = HttpRequest.newBuilder(
                        URI.create(ENDPOINT.formatted(URLEncoder.encode(model, StandardCharsets.UTF_8))))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .header("x-goog-api-key", apiKey.trim())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(root), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) {
            String detail = errorMessage(response.body());
            log.warn("Gemini 이미지 생성 실패: status={}, model={}, message={}", response.statusCode(), model, detail);
            throw new GeminiImageException(response.statusCode(), detail);
        }

        JsonNode json = objectMapper.readTree(response.body());
        for (JsonNode part : json.path("candidates").path(0).path("content").path("parts")) {
            JsonNode inline = part.has("inlineData") ? part.get("inlineData") : part.path("inline_data");
            String b64 = inline.path("data").asText(null);
            if (b64 != null && !b64.isBlank()) {
                return Base64.getDecoder().decode(b64);
            }
        }
        // 안전 필터 등으로 이미지 없이 끝난 경우 - 이유만 남긴다(응답 본문 전체는 남기지 않는다).
        String reason = json.path("promptFeedback").path("blockReason").asText(
                json.path("candidates").path(0).path("finishReason").asText("UNKNOWN"));
        throw new IOException("Gemini 응답에 이미지 데이터가 없습니다. (reason=" + reason + ")");
    }

    private String errorMessage(String body) {
        try {
            String message = objectMapper.readTree(body).path("error").path("message").asText("");
            if (!message.isBlank()) return message.length() > 300 ? message.substring(0, 300) : message;
        } catch (Exception ignored) {
            // JSON이 아니면 아래 기본값.
        }
        return "(응답 본문 없음)";
    }
}
