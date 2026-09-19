package com.ridefit.ridefit.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.dto.SynthResponse;
import com.ridefit.ridefit.exception.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

// 부품을 장착한 모습을 AI로 합성하는 서비스. AI_SYNTH_MODE=mock(기본)이면 고정 샘플 이미지를 반환하고,
// live일 때만 Pollinations(gen.pollinations.ai) API를 실제로 호출한다.
// 라이브 호출이 어떤 이유(오류/크레딧 소진/타임아웃)로든 실패해도, 호출부에는 항상
// 사람이 읽을 수 있는 안내 메시지를 던진다 ("오류: undefined" 같은 응답 금지).
@Slf4j
@Service
public class AiSynthService {

    private static final String MOCK_IMAGE_PATH = "/mock/synth-placeholder.svg";
    private static final String EDITS_ENDPOINT = "https://gen.pollinations.ai/v1/images/edits";
    private static final String MODEL = "openai/gpt-image-1-mini";

    @Value("${ai.synth.mode:mock}")
    private String mode;

    @Value("${pollinations.api-key:}")
    private String pollinationsApiKey;

    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public SynthResponse synthesize(Part part, MyVehicle vehicle) {
        if (!"live".equalsIgnoreCase(mode)) {
            return new SynthResponse(MOCK_IMAGE_PATH, "mock");
        }

        try {
            return callPollinations(part, vehicle);
        } catch (Exception e) {
            log.warn("AI 합성 실패: partId={}, cause={}", part.getId(), e.toString());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "지금은 이미지를 만들 수 없어요, 잠시 후 다시 시도해주세요.");
        }
    }

    private SynthResponse callPollinations(Part part, MyVehicle vehicle) throws IOException, InterruptedException {
        String vehicleLabel = vehicle.getModelYear().getYear() + " " + vehicle.getModelYear().getVehicleModel().getName();
        String prompt = "%s 오토바이에 '%s' 부품을 장착한 모습을 사실적으로 합성해줘".formatted(vehicleLabel, part.getName());

        String requestBody = objectMapper.writeValueAsString(Map.of(
                "model", MODEL,
                "prompt", prompt,
                "image", part.getImageUrl() == null ? "" : part.getImageUrl()));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(EDITS_ENDPOINT))
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + pollinationsApiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) {
            throw new IOException("Pollinations API 응답 오류: status=" + response.statusCode());
        }

        JsonNode json = objectMapper.readTree(response.body());
        String imageUrl = json.path("data").path(0).path("url").asText(null);
        if (imageUrl == null || imageUrl.isBlank()) {
            throw new IOException("Pollinations 응답에 이미지 URL이 없습니다.");
        }

        return new SynthResponse(imageUrl, "live");
    }
}
