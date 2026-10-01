package com.ridefit.ridefit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.VehicleModel;
import com.ridefit.ridefit.dto.ModelYearLabel;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 부품 적용 연식: 부품별 호환 차량 목록 API + 호환 부품 목록의 "같은 차종 적용 연식" + 연식 없는 라벨.
@SpringBootTest
@AutoConfigureMockMvc
class PartFitmentTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void 부품의_호환_차량과_같은_차종_적용_연식을_DB값_그대로_돌려준다() throws Exception {
        String token = postJson("/api/auth/signup", """
                {"email":"fitment-%d@test.dev","password":"fit1234!","name":"연식테스트"}
                """.formatted(System.currentTimeMillis()), null, 201).get("token").asText();

        long manufacturerId = getJson("/api/manufacturers", null).get(0).get("id").asLong();
        long vehicleModelId = getJson("/api/manufacturers/" + manufacturerId + "/vehicle-models", null).get(0).get("id").asLong();
        JsonNode year = getJson("/api/vehicle-models/" + vehicleModelId + "/model-years", null).get(0);
        long modelYearId = year.get("id").asLong();

        long myVehicleId = postJson("/api/my-vehicles", "{\"modelYearId\":%d}".formatted(modelYearId), token, 201)
                .get("id").asLong();
        long partId = postJson("/api/parts", """
                {"name":"연식 테스트 캐리어","price":10000,"category":"캐리어","imageUrl":null,
                 "sourceUrl":null,"modelYearId":%d,"vehicleModelId":null}
                """.formatted(modelYearId), token, 201).get("id").asLong();

        // 1) 부품 상세용: 호환 등록된 연식이 차종/연식/코드/상태와 함께 나온다
        JsonNode fitments = getJson("/api/parts/" + partId + "/compatibilities", null);
        assertThat(fitments).hasSize(1);
        JsonNode f = fitments.get(0);
        assertThat(f.get("modelYearId").asLong()).isEqualTo(modelYearId);
        assertThat(f.get("vehicleModelId").asLong()).isEqualTo(vehicleModelId);
        assertThat(f.get("status").asText()).isEqualTo("호환가능");
        assertThat(f.get("year").isNull() ? null : f.get("year").asInt())
                .isEqualTo(year.get("year").isNull() ? null : year.get("year").asInt());

        // 2) 부품 카드용: 내 차와 같은 차종의 장착 가능 연식
        JsonNode parts = getJson("/api/my-vehicles/" + myVehicleId + "/compatible-parts", token);
        JsonNode mine = null;
        for (JsonNode p : parts) if (p.get("partId").asLong() == partId) mine = p;
        assertThat(mine).isNotNull();
        assertThat(mine.get("sameModelFitments")).hasSize(1);
        assertThat(mine.get("sameModelFitments").get(0).get("modelYearId").asLong()).isEqualTo(modelYearId);

        // 3) 없는 부품은 404
        mockMvc.perform(get("/api/parts/999999999/compatibilities")).andExpect(status().isNotFound());
    }

    @Test
    void 연식_값이_없으면_라벨에_null을_쓰지_않는다() {
        VehicleModel model = new VehicleModel();
        model.setName("Super Cub 110");
        ModelYear legacy = new ModelYear();
        legacy.setVehicleModel(model);
        legacy.setChassisCode("JA71");
        assertThat(ModelYearLabel.of(legacy)).isEqualTo("Super Cub 110 (JA71)");

        legacy.setYear(2023);
        legacy.setChassisCode("JA44");
        assertThat(ModelYearLabel.of(legacy)).isEqualTo("2023 Super Cub 110 (JA44)");
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
        return objectMapper.readTree(body);
    }
}
