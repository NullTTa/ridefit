package com.ridefit.ridefit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ridefit.ridefit.service.OpenAiImageClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 상품 URL 등록(수동 입력 경로) → 판매처 가격비교 규칙 → AI 참조 이미지 → "AI로 장착해보기"(키 없음/실패/생성/캐시 재사용)
// 흐름을 H2 + MockMvc로 검증한다. OpenAI 호출은 목(mock)으로 대체해 실제 비용/네트워크 없이 돈다.
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "app.upload-dir=build/test-uploads",
        // 로컬에 Gemini 키가 있어도 테스트가 실제 API를 부르지 않도록 목으로 바꾼 OpenAI 쪽만 쓴다.
        "ai.fit.provider=openai",
        // 다른 테스트 컨텍스트와 H2 스키마(create-drop)를 공유하지 않도록 별도 DB를 쓴다.
        "spring.datasource.url=jdbc:h2:mem:ridefit-aifit;MODE=MySQL;DB_CLOSE_DELAY=-1"})
class ProductAndAiFitFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private OpenAiImageClient openAiImageClient;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void 상품_등록부터_AI_장착_캐시_재사용까지_흐름이_동작한다() throws Exception {
        String adminToken = login("admin@ridefit.dev", "admin1234!");
        String email = "aifit-" + System.currentTimeMillis() + "@test.dev";
        String userToken = postJson("/api/auth/signup",
                "{\"email\":\"%s\",\"password\":\"aifit1234!\",\"name\":\"AI테스터\"}".formatted(email), null, 201)
                .get("token").asText();

        // Super Cub 110 연식 하나로 내 차량 등록 (대표 사진 /assets/vehicles/super-cub-110.png 사용)
        long modelYearId = findModelYearId("Super Cub 110");
        long myVehicleId = postJson("/api/my-vehicles", "{\"modelYearId\":%d}".formatted(modelYearId), userToken, 201)
                .get("id").asLong();

        // ---- 1) 관리자 상품 등록(자동 수집 실패 → 수동 입력 경로). 가격 미확인 판매처는 price=null로 저장 ----
        JsonNode created = postJson("/api/admin/products", """
                {"name":"테스트 머플러","category":"머플러","price":150000,
                 "sourceUrl":"https://www.example.com/products/1","sellerName":"테스트판매처","listingPrice":null,
                 "originalImageUrl":null,"modelYearIds":[%d],"compatStatus":"호환가능"}
                """.formatted(modelYearId), adminToken, 201);
        long partId = created.get("part").get("id").asLong();
        assertThat(created.get("compatibilityCount").asInt()).isEqualTo(1);
        assertThat(created.get("listingCreated").asBoolean()).isTrue();

        JsonNode listings = getJson("/api/parts/" + partId + "/listings", null, 200);
        assertThat(listings).hasSize(1);
        assertThat(listings.get(0).get("price").isNull()).isTrue();
        assertThat(listings.get(0).get("lowestPrice").asBoolean()).isFalse();

        // 잘못된 호환 상태 / 외부 URL을 AI 참조로 지정 → 400
        postJson("/api/admin/products", """
                {"name":"x","category":"머플러","price":1000,"compatStatus":"호환불가"}""", adminToken, 400);
        mockMvc.perform(patch("/api/admin/parts/" + partId + "/ai-reference")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"aiReferenceImageUrl\":\"https://example.com/a.png\"}"))
                .andExpect(status().isBadRequest());

        // ---- 2) 가격비교: 가격 확인된 판매처 2곳 이상일 때만 최저가 배지 ----
        postJson("/api/parts/" + partId + "/listings",
                "{\"sellerName\":\"판매처A\",\"price\":39800,\"sourceUrl\":\"https://a.example.com/p\"}", userToken, 201);
        JsonNode oneComparable = getJson("/api/parts/" + partId + "/listings", null, 200);
        assertThat(oneComparable.findValuesAsText("lowestPrice")).doesNotContain("true");
        postJson("/api/parts/" + partId + "/listings",
                "{\"sellerName\":\"판매처B\",\"price\":31200,\"sourceUrl\":\"https://b.example.com/p\"}", userToken, 201);
        JsonNode twoComparable = getJson("/api/parts/" + partId + "/listings", null, 200);
        assertThat(twoComparable.get(0).get("sellerName").asText()).isEqualTo("판매처B");
        assertThat(twoComparable.get(0).get("lowestPrice").asBoolean()).isTrue();
        assertThat(twoComparable.get(1).get("lowestPrice").asBoolean()).isFalse();
        // 가격 0원은 거부
        postJson("/api/parts/" + partId + "/listings",
                "{\"sellerName\":\"판매처C\",\"price\":0,\"sourceUrl\":\"https://c.example.com/p\"}", userToken, 400);

        // ---- 3) AI: 참조 이미지 없음 → REFERENCE_MISSING ----
        JsonNode missing = getJson("/api/ai-fit/status?partId=%d&myVehicleId=%d".formatted(partId, myVehicleId), userToken, 200);
        assertThat(missing.get("code").asText()).isEqualTo("REFERENCE_MISSING");
        assertThat(missing.get("canGenerate").asBoolean()).isFalse();

        // 관리자가 참조 이미지 업로드 + 지정
        String refUrl = objectMapper.readTree(mockMvc.perform(multipart("/api/admin/uploads/part-image")
                        .file(new MockMultipartFile("file", "ref.png", "image/png", tinyPng()))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("url").asText();
        mockMvc.perform(patch("/api/admin/parts/" + partId + "/ai-reference")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"aiReferenceImageUrl\":\"%s\"}".formatted(refUrl)))
                .andExpect(status().isOk());
        // 이미지가 아닌 파일 업로드는 거부
        mockMvc.perform(multipart("/api/admin/uploads/part-image")
                        .file(new MockMultipartFile("file", "x.html", "text/html", "<html>hello world</html>".getBytes()))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());

        // ---- 4) API 키 없음 → NOT_CONFIGURED, 생성 요청은 503 (FitRoom 데이터는 정상) ----
        when(openAiImageClient.isConfigured()).thenReturn(false);
        when(openAiImageClient.model()).thenReturn("test-model");
        when(openAiImageClient.quality()).thenReturn("medium");
        String statusUrl = "/api/ai-fit/status?partId=%d&myVehicleId=%d&anchorX=29&anchorY=77".formatted(partId, myVehicleId);
        assertThat(getJson(statusUrl, userToken, 200).get("code").asText()).isEqualTo("NOT_CONFIGURED");
        String genBody = "{\"partId\":%d,\"myVehicleId\":%d,\"anchorX\":29,\"anchorY\":77}".formatted(partId, myVehicleId);
        postJson("/api/ai-fit", genBody, userToken, 503);
        getJson("/api/my-vehicles/" + myVehicleId + "/compatible-parts", userToken, 200);

        // ---- 5) 키 있음 + OpenAI 실패 → 502 + 안내 문구, 결과 저장 안 됨 ----
        when(openAiImageClient.isConfigured()).thenReturn(true);
        when(openAiImageClient.edit(anyList(), anyString()))
                .thenThrow(new OpenAiImageClient.OpenAiImageException(500, "server error"));
        JsonNode failed = postJson("/api/ai-fit", genBody, userToken, 502);
        assertThat(failed.get("message").asText()).contains("기본 장착 미리보기");
        assertThat(getJson(statusUrl, userToken, 200).get("code").asText()).isEqualTo("READY");

        // ---- 6) 생성 성공 → 저장, 같은 조합 재요청은 캐시(OpenAI 재호출 없음) ----
        reset(openAiImageClient);
        when(openAiImageClient.isConfigured()).thenReturn(true);
        when(openAiImageClient.model()).thenReturn("test-model");
        when(openAiImageClient.quality()).thenReturn("medium");
        when(openAiImageClient.edit(anyList(), anyString())).thenReturn(tinyPng());
        JsonNode first = postJson("/api/ai-fit", genBody, userToken, 200);
        assertThat(first.get("cached").asBoolean()).isFalse();
        assertThat(first.get("imageUrl").asText()).startsWith("/uploads/ai-fit/");
        JsonNode second = postJson("/api/ai-fit", genBody, userToken, 200);
        assertThat(second.get("cached").asBoolean()).isTrue();
        assertThat(second.get("imageUrl").asText()).isEqualTo(first.get("imageUrl").asText());
        verify(openAiImageClient, times(1)).edit(anyList(), any());
        JsonNode cachedStatus = getJson(statusUrl, userToken, 200);
        assertThat(cachedStatus.get("code").asText()).isEqualTo("CACHED");
        assertThat(cachedStatus.get("cachedImageUrl").asText()).isEqualTo(first.get("imageUrl").asText());

        // ---- 7) 지원하지 않는 카테고리 → UNSUPPORTED_CATEGORY ----
        long seatPartId = postJson("/api/admin/products", """
                {"name":"테스트 시트","category":"시트","price":50000,"modelYearIds":[%d]}
                """.formatted(modelYearId), adminToken, 201).get("part").get("id").asLong();
        assertThat(getJson("/api/ai-fit/status?partId=%d&myVehicleId=%d".formatted(seatPartId, myVehicleId), userToken, 200)
                .get("code").asText()).isEqualTo("UNSUPPORTED_CATEGORY");

        // ---- 8) 다른 사람 차량으로는 사용 불가 ----
        getJson("/api/ai-fit/status?partId=%d&myVehicleId=%d".formatted(partId, myVehicleId), adminToken, 403);
    }

    @Test
    void 공식_API가_필요한_판매처와_내부_주소는_페이지를_요청하지_않고_수동_입력으로_안내한다() throws Exception {
        String adminToken = login("admin@ridefit.dev", "admin1234!");

        JsonNode coupang = postJson("/api/admin/products/preview",
                "{\"url\":\"https://www.coupang.com/vp/products/123\"}", adminToken, 200);
        assertThat(coupang.get("success").asBoolean()).isFalse();
        assertThat(coupang.get("sellerName").asText()).isEqualTo("쿠팡");
        assertThat(coupang.get("failReason").asText()).contains("파트너스");

        JsonNode ali = postJson("/api/admin/products/preview",
                "{\"url\":\"https://ko.aliexpress.com/item/100.html\"}", adminToken, 200);
        assertThat(ali.get("success").asBoolean()).isFalse();
        assertThat(ali.get("sellerName").asText()).isEqualTo("알리익스프레스");

        JsonNode local = postJson("/api/admin/products/preview",
                "{\"url\":\"http://127.0.0.1:8080/api/parts\"}", adminToken, 200);
        assertThat(local.get("success").asBoolean()).isFalse();
        assertThat(local.get("failReason").asText()).contains("내부 네트워크");

        JsonNode ftp = postJson("/api/admin/products/preview", "{\"url\":\"file:///etc/passwd\"}", adminToken, 200);
        assertThat(ftp.get("success").asBoolean()).isFalse();
    }

    @Test
    void 예시_도메인_판매처는_sample로_표시되고_최저가_비교에서_빠진다() throws Exception {
        // 시드에는 더 이상 예시 판매처가 없으므로, 이 테스트 안에서 직접 판매처를 만든다(H2 테스트 DB 전용).
        // .test는 실제로 존재할 수 없는 예약 도메인(RFC 2606)이라 가격이 더 싸도 최저가가 되면 안 된다.
        String adminToken = login("admin@ridefit.dev", "admin1234!");
        long partId = postJson("/api/admin/products",
                "{\"name\":\"판매처 비교 테스트 부품\",\"category\":\"머플러\",\"price\":70000}", adminToken, 201)
                .get("part").get("id").asLong();

        postJson("/api/parts/" + partId + "/listings",
                "{\"sellerName\":\"실제판매처A\",\"price\":50000,\"sourceUrl\":\"https://a.example.com/p\"}", adminToken, 201);
        postJson("/api/parts/" + partId + "/listings",
                "{\"sellerName\":\"실제판매처B\",\"price\":60000,\"sourceUrl\":\"https://b.example.com/p\"}", adminToken, 201);
        postJson("/api/parts/" + partId + "/listings",
                "{\"sellerName\":\"예시판매처\",\"price\":10000,\"sourceUrl\":\"https://sample-shop.test/p\"}", adminToken, 201);

        JsonNode listings = getJson("/api/parts/" + partId + "/listings", null, 200);
        assertThat(listings).hasSize(3);
        for (JsonNode l : listings) {
            boolean isSampleDomain = l.get("sourceUrl").asText().contains(".test/");
            assertThat(l.get("sample").asBoolean()).isEqualTo(isSampleDomain);
            if (isSampleDomain) assertThat(l.get("lowestPrice").asBoolean()).isFalse();
        }
        // 최저가는 실제 판매처 중 가장 싼 A, 부품 상세의 최저 확인 가격과 판매처 수도 예시를 제외한다.
        assertThat(listings.get(0).get("sellerName").asText()).isEqualTo("실제판매처A");
        assertThat(listings.get(0).get("lowestPrice").asBoolean()).isTrue();
        JsonNode stats = getJson("/api/parts/" + partId, null, 200).get("stats");
        assertThat(stats.get("lowestPrice").asInt()).isEqualTo(50000);
        assertThat(stats.get("sellerCount").asInt()).isEqualTo(2);
    }

    private long findModelYearId(String modelName) throws Exception {
        for (JsonNode m : getJson("/api/manufacturers", null, 200)) {
            for (JsonNode vm : getJson("/api/manufacturers/" + m.get("id").asLong() + "/vehicle-models", null, 200)) {
                if (vm.get("name").asText().equals(modelName)) {
                    return getJson("/api/vehicle-models/" + vm.get("id").asLong() + "/model-years", null, 200)
                            .get(0).get("id").asLong();
                }
            }
        }
        throw new IllegalStateException("시드에 차종이 없습니다: " + modelName);
    }

    private String login(String email, String password) throws Exception {
        return postJson("/api/auth/login", "{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password), null, 200)
                .get("token").asText();
    }

    private static byte[] tinyPng() throws Exception {
        BufferedImage image = new BufferedImage(16, 16, BufferedImage.TYPE_INT_ARGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    private JsonNode postJson(String url, String body, String token, int expectedStatus) throws Exception {
        var request = post(url).contentType(MediaType.APPLICATION_JSON).content(body);
        if (token != null) request.header("Authorization", "Bearer " + token);
        String response = mockMvc.perform(request)
                .andExpect(status().is(expectedStatus))
                .andReturn().getResponse().getContentAsString();
        return response.isBlank() ? objectMapper.createObjectNode() : objectMapper.readTree(response);
    }

    private JsonNode getJson(String url, String token, int expectedStatus) throws Exception {
        var request = get(url);
        if (token != null) request.header("Authorization", "Bearer " + token);
        String response = mockMvc.perform(request)
                .andExpect(status().is(expectedStatus))
                .andReturn().getResponse().getContentAsString();
        return response.isBlank() ? objectMapper.createObjectNode() : objectMapper.readTree(response);
    }
}
