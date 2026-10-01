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
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

// Magic Hour AI Image Editor(이미지 편집) 최소 클라이언트. OpenAI/Gemini와 달리 요청 한 번으로 끝나지 않는다:
//   1) POST /v1/files/upload-urls   - 입력 이미지마다 업로드 주소를 받는다
//   2) PUT  <upload_url>            - 차량/부품 이미지를 올린다
//   3) POST /v1/ai-image-editor     - 올린 이미지 + 프롬프트로 편집 작업을 만든다(이 시점에 크레딧 차감)
//   4) GET  /v1/image-projects/{id} - complete 될 때까지 상태를 조회한다
//   5) GET  downloads[0].url        - 결과 이미지를 내려받아 byte[]로 돌려준다
//
// 주의: 2)에서 차량 사진과 부품 이미지가 외부(Magic Hour 서버)로 전송되어 그쪽 저장소에 올라간다.
//
// 재시도하지 않는다. 실패하거나 시간이 초과되어도 같은 요청을 다시 보내지 않는다 - 작업이 Magic Hour
// 쪽에서 계속 진행 중일 수 있어서, 다시 보내면 크레딧이 또 차감될 수 있기 때문이다.
//
// API 키는 MAGICHOUR_API_KEY로만 받고 Authorization 헤더로만 보낸다. 키와 서명된 업로드/다운로드 URL은
// 로그와 예외 메시지에 남기지 않는다.
@Slf4j
@Component
public class MagicHourImageClient {

    private static final String BASE_URL = "https://api.magichour.ai";

    // 기존 AI Fit 프롬프트 뒤에 덧붙이는 문장. 편집 모델이 차량을 새로 그리거나 다른 모델로 바꾸지 않도록 한다.
    private static final String EDIT_GUARD = "\n\nThis is an image EDIT of Image 1, not a new generation. "
            + "Image 1 is the vehicle and must remain the same motorcycle: do not generate a new motorcycle, "
            + "do not change it into a different model, and keep its body, frame, wheels, camera angle and background. "
            + "Image 2 is the selected part. Only add that part, installed naturally at the mounting location.";

    @Value("${magichour.api-key:}")
    private String apiKey;

    @Value("${magichour.image.model:flux-2-klein}")
    private String model;

    // 비워 두면 요청에 넣지 않는다(Magic Hour 기본값 사용).
    @Value("${magichour.image.resolution:640px}")
    private String resolution;

    // 작업 생성부터 결과 다운로드까지 기다리는 전체 시간.
    @Value("${magichour.image.timeout-seconds:180}")
    private int timeoutSeconds;

    @Value("${magichour.image.poll-interval-seconds:3}")
    private int pollIntervalSeconds;

    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Magic Hour가 오류로 응답했을 때. status는 응답 코드(401=키 문제, 402=크레딧 부족/플랜 제한, 422=요청 거부 등).
    public static class MagicHourImageException extends IOException {
        private final int status;

        public MagicHourImageException(int status, String message) {
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

    public String resolution() {
        return resolution == null || resolution.isBlank() ? "auto" : resolution.trim();
    }

    public byte[] edit(List<OpenAiImageClient.InputImage> images, String prompt) throws IOException, InterruptedException {
        long deadline = System.nanoTime() + Duration.ofSeconds(timeoutSeconds).toNanos();

        List<String> filePaths = upload(images);
        String projectId = createEditJob(filePaths, prompt + EDIT_GUARD);
        String downloadUrl = waitForResult(projectId, deadline);

        HttpResponse<byte[]> image = httpClient.send(
                HttpRequest.newBuilder(URI.create(downloadUrl)).timeout(Duration.ofSeconds(60)).GET().build(),
                HttpResponse.BodyHandlers.ofByteArray());
        if (image.statusCode() / 100 != 2) {
            throw new IOException("Magic Hour 결과 이미지를 내려받지 못했습니다. (status=" + image.statusCode()
                    + ", projectId=" + projectId + ")");
        }
        return image.body();
    }

    // 1) + 2) 입력 이미지를 받은 순서 그대로 올린다(프롬프트가 "Image 1, Image 2..."로 가리킨다).
    private List<String> upload(List<OpenAiImageClient.InputImage> images) throws IOException, InterruptedException {
        ObjectNode body = objectMapper.createObjectNode();
        ArrayNode items = body.putArray("items");
        for (OpenAiImageClient.InputImage image : images) {
            String name = image.filename();
            items.addObject().put("type", "image").put("extension", name.substring(name.lastIndexOf('.') + 1));
        }
        JsonNode uploadItems = postJson("/v1/files/upload-urls", body, "업로드 주소 요청").path("items");
        if (uploadItems.size() != images.size()) {
            throw new IOException("Magic Hour 업로드 주소 응답의 개수가 요청과 다릅니다.");
        }

        List<String> filePaths = new ArrayList<>();
        for (int i = 0; i < images.size(); i++) {
            String uploadUrl = uploadItems.get(i).path("upload_url").asText("");
            String filePath = uploadItems.get(i).path("file_path").asText("");
            if (uploadUrl.isBlank() || filePath.isBlank()) {
                throw new IOException("Magic Hour 업로드 주소 응답에 upload_url/file_path가 없습니다.");
            }
            HttpResponse<String> put = httpClient.send(
                    HttpRequest.newBuilder(URI.create(uploadUrl)).timeout(Duration.ofSeconds(60))
                            .PUT(HttpRequest.BodyPublishers.ofByteArray(images.get(i).bytes())).build(),
                    HttpResponse.BodyHandlers.ofString());
            if (put.statusCode() / 100 != 2) {
                throw new IOException("Magic Hour 이미지 업로드 실패 (status=" + put.statusCode() + ", image=" + (i + 1) + ")");
            }
            filePaths.add(filePath);
        }
        return filePaths;
    }

    // 3) 편집 작업 생성. 결과는 항상 1장만 요청한다.
    private String createEditJob(List<String> filePaths, String prompt) throws IOException, InterruptedException {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("name", "RIDEFIT AI Fit");
        body.put("image_count", 1);
        body.put("model", model);
        if (resolution != null && !resolution.isBlank()) {
            body.put("resolution", resolution.trim());
        }
        body.putObject("style").put("prompt", prompt);
        ArrayNode paths = body.putObject("assets").putArray("image_file_paths");
        filePaths.forEach(paths::add);

        JsonNode created = postJson("/v1/ai-image-editor", body, "편집 작업 생성");
        String id = created.path("id").asText("");
        if (id.isBlank()) {
            throw new IOException("Magic Hour 편집 작업 응답에 id가 없습니다.");
        }
        log.info("Magic Hour 편집 작업 생성: projectId={}, model={}, resolution={}, creditsCharged={}",
                id, model, resolution(), created.path("credits_charged").asText("?"));
        return id;
    }

    // 4) 완료될 때까지 상태 조회. 시간이 초과되면 포기한다(작업은 Magic Hour 쪽에서 계속될 수 있다 - 재요청 금지).
    private String waitForResult(String projectId, long deadline) throws IOException, InterruptedException {
        while (true) {
            HttpResponse<String> response = httpClient.send(
                    authorized("/v1/image-projects/" + projectId).GET().build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                throw failure(response, "작업 상태 조회");
            }
            JsonNode json = objectMapper.readTree(response.body());
            String status = json.path("status").asText("");
            if ("complete".equals(status)) {
                String url = json.path("downloads").path(0).path("url").asText("");
                if (url.isBlank()) {
                    throw new IOException("Magic Hour 작업은 완료됐지만 다운로드 주소가 없습니다. (projectId=" + projectId + ")");
                }
                return url;
            }
            if ("error".equals(status) || "canceled".equals(status)) {
                throw new IOException("Magic Hour 작업 실패: status=" + status
                        + ", code=" + json.path("error").path("code").asText("-")
                        + ", message=" + shorten(json.path("error").path("message").asText("-"))
                        + " (projectId=" + projectId + ")");
            }
            if (System.nanoTime() >= deadline) {
                throw new IOException("Magic Hour 작업이 " + timeoutSeconds + "초 안에 끝나지 않았습니다. 마지막 상태=" + status
                        + " (projectId=" + projectId + ", 작업은 계속 진행 중일 수 있음)");
            }
            Thread.sleep(Duration.ofSeconds(Math.max(1, pollIntervalSeconds)).toMillis());
        }
    }

    private HttpRequest.Builder authorized(String path) {
        return HttpRequest.newBuilder(URI.create(BASE_URL + path))
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + apiKey.trim());
    }

    private JsonNode postJson(String path, ObjectNode body, String step) throws IOException, InterruptedException {
        HttpResponse<String> response = httpClient.send(
                authorized(path).header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body), StandardCharsets.UTF_8))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) {
            throw failure(response, step);
        }
        return objectMapper.readTree(response.body());
    }

    private MagicHourImageException failure(HttpResponse<String> response, String step) {
        String detail = errorMessage(response.body());
        log.warn("Magic Hour {} 실패: status={}, model={}, message={}", step, response.statusCode(), model, detail);
        return new MagicHourImageException(response.statusCode(), step + " 실패: " + detail);
    }

    private String errorMessage(String body) {
        try {
            JsonNode json = objectMapper.readTree(body);
            String message = json.path("message").asText(json.path("error").path("message").asText(""));
            if (!message.isBlank()) return shorten(message);
        } catch (Exception ignored) {
            // JSON이 아니면 아래 기본값.
        }
        return "(응답 본문 없음)";
    }

    private String shorten(String message) {
        return message.length() > 300 ? message.substring(0, 300) : message;
    }
}
