package com.ridefit.ridefit.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

// OpenAI Image API 이미지 편집(POST /v1/images/edits, multipart, image[] 여러 장) 최소 클라이언트.
// 모델/품질은 코드에 고정하지 않고 설정(OPENAI_IMAGE_MODEL / OPENAI_IMAGE_QUALITY)으로 바꾼다.
// API 키는 환경변수 OPENAI_API_KEY로만 받고, 로그/응답에 절대 남기지 않는다.
@Slf4j
@Component
public class OpenAiImageClient {

    private static final String EDITS_ENDPOINT = "https://api.openai.com/v1/images/edits";

    @Value("${openai.api-key:}")
    private String apiKey;

    @Value("${openai.image.model:gpt-image-2.5-sunburst}")
    private String model;

    @Value("${openai.image.quality:medium}")
    private String quality;

    @Value("${openai.image.timeout-seconds:180}")
    private int timeoutSeconds;

    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public record InputImage(String filename, String mimeType, byte[] bytes) {
    }

    // OpenAI가 오류로 응답했을 때. status는 OpenAI 응답 코드(429=한도/요금, 400=요청 거부 등).
    public static class OpenAiImageException extends IOException {
        private final int status;

        public OpenAiImageException(int status, String message) {
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

    public String quality() {
        return quality;
    }

    public byte[] edit(List<InputImage> images, String prompt) throws IOException, InterruptedException {
        String boundary = "----ridefit" + UUID.randomUUID().toString().replace("-", "");
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        writeField(body, boundary, "model", model);
        writeField(body, boundary, "prompt", prompt);
        writeField(body, boundary, "quality", quality);
        writeField(body, boundary, "size", "auto");
        writeField(body, boundary, "output_format", "png");
        writeField(body, boundary, "n", "1");
        for (InputImage image : images) {
            body.write(("--" + boundary + "\r\n"
                    + "Content-Disposition: form-data; name=\"image[]\"; filename=\"" + image.filename() + "\"\r\n"
                    + "Content-Type: " + image.mimeType() + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            body.write(image.bytes());
            body.write("\r\n".getBytes(StandardCharsets.UTF_8));
        }
        body.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));

        HttpRequest request = HttpRequest.newBuilder(URI.create(EDITS_ENDPOINT))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray()))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) {
            String detail = errorMessage(response.body());
            log.warn("OpenAI 이미지 편집 실패: status={}, model={}, message={}", response.statusCode(), model, detail);
            throw new OpenAiImageException(response.statusCode(), detail);
        }

        JsonNode json = objectMapper.readTree(response.body());
        String b64 = json.path("data").path(0).path("b64_json").asText(null);
        if (b64 == null || b64.isBlank()) {
            throw new IOException("OpenAI 응답에 이미지 데이터(b64_json)가 없습니다.");
        }
        return Base64.getDecoder().decode(b64);
    }

    private void writeField(ByteArrayOutputStream out, String boundary, String name, String value) throws IOException {
        out.write(("--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n"
                + value + "\r\n").getBytes(StandardCharsets.UTF_8));
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
