package com.ridefit.ridefit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 내 차고: 추천 상품은 "호환 + 실제로 쌓인 신호(조회/장착해보기/후기/평점)"가 있는 부품만, 즐겨찾기는 내가 저장한 부품만.
@SpringBootTest
@AutoConfigureMockMvc
class GarageRecommendationTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void 추천은_신호가_있는_호환_부품만_즐겨찾기는_저장한_부품만_돌려준다() throws Exception {
        String token = postJson("/api/auth/signup", """
                {"email":"garage-%d@test.dev","password":"garage1234!","name":"차고테스트"}
                """.formatted(System.currentTimeMillis()), null, 201).get("token").asText();

        long manufacturerId = getJson("/api/manufacturers", null).get(0).get("id").asLong();
        long vehicleModelId = getJson("/api/manufacturers/" + manufacturerId + "/vehicle-models", null).get(0).get("id").asLong();
        long modelYearId = getJson("/api/vehicle-models/" + vehicleModelId + "/model-years", null).get(0).get("id").asLong();
        long myVehicleId = postJson("/api/my-vehicles", "{\"modelYearId\":%d}".formatted(modelYearId), token, 201)
                .get("id").asLong();

        long quiet = createPart("신호 없는 캐리어", modelYearId, token);
        long tried = createPart("장착해본 캐리어", modelYearId, token);
        postJson("/api/parts/" + tried + "/fit-selections", "{}", token, 204);

        // 추천: 장착해보기 기록이 있는 부품은 근거(장착해보기 수)와 함께 나오고, 신호 0인 부품은 호환이어도 나오지 않는다
        JsonNode recommended = getJson("/api/my-vehicles/" + myVehicleId + "/recommended-parts", token);
        List<Long> ids = new ArrayList<>();
        recommended.forEach(p -> ids.add(p.get("partId").asLong()));
        assertThat(ids).contains(tried).doesNotContain(quiet);
        for (JsonNode p : recommended) {
            JsonNode s = p.get("stats");
            assertThat(s.get("viewCount").asLong() + s.get("fitSelectionCount").asLong() + s.get("reviewCount").asLong()
                    + (s.get("avgRating").isNull() ? 0 : 1)).isPositive();
            assertThat(p.get("status").asText()).isIn("호환가능", "브라켓필요");
        }

        // 즐겨찾기: 호환 부품 목록과 무관하게 내가 저장한 부품만
        assertThat(getJson("/api/me/favorites", token)).isEmpty();
        postJson("/api/me/favorites", "{\"partId\":%d}".formatted(quiet), token, 201);
        JsonNode favorites = getJson("/api/me/favorites", token);
        assertThat(favorites).hasSize(1);
        assertThat(favorites.get(0).get("partId").asLong()).isEqualTo(quiet);
    }

    private long createPart(String name, long modelYearId, String token) throws Exception {
        return postJson("/api/parts", """
                {"name":"%s %d","price":10000,"category":"캐리어","imageUrl":null,
                 "sourceUrl":null,"modelYearId":%d,"vehicleModelId":null}
                """.formatted(name, System.nanoTime(), modelYearId), token, 201).get("id").asLong();
    }

    private JsonNode getJson(String url, String token) throws Exception {
        return send(get(url), token, 200);
    }

    private JsonNode postJson(String url, String body, String token, int expected) throws Exception {
        return send(post(url).contentType(MediaType.APPLICATION_JSON).content(body), token, expected);
    }

    private JsonNode send(MockHttpServletRequestBuilder req, String token, int expected) throws Exception {
        if (token != null) req.header("Authorization", "Bearer " + token);
        String body = mockMvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return body.isBlank() ? objectMapper.nullNode() : objectMapper.readTree(body);
    }
}
