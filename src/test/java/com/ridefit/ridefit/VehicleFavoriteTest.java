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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 저장한 부품은 차량별: 차량 A에 저장한 부품은 차량 B에 섞이지 않고, 같은 부품을 두 차량에 따로 저장할 수 있다.
// 차량 구분 없는 예전 저장(myVehicleId 없음)은 그대로 동작하고 어느 차량에도 자동으로 붙지 않는다.
@SpringBootTest
@AutoConfigureMockMvc
class VehicleFavoriteTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void 저장한_부품은_차량별로_분리되고_차량을_지우면_그_차량_저장만_지워진다() throws Exception {
        String token = signup("fav-a");
        long modelYearId = firstModelYearId();
        long vehicleA = postJson("/api/my-vehicles", "{\"modelYearId\":%d}".formatted(modelYearId), token, 201).get("id").asLong();
        long vehicleB = postJson("/api/my-vehicles", "{\"modelYearId\":%d}".formatted(modelYearId), token, 201).get("id").asLong();
        long muffler = createPart("차량별 저장 머플러", modelYearId, token);
        long bag = createPart("차량별 저장 사이드백", modelYearId, token);

        postJson("/api/me/favorites", "{\"partId\":%d,\"myVehicleId\":%d}".formatted(muffler, vehicleA), token, 201);
        postJson("/api/me/favorites", "{\"partId\":%d,\"myVehicleId\":%d}".formatted(bag, vehicleB), token, 201);
        // 같은 부품을 다른 차량에도 저장할 수 있다 + 같은 차량에 다시 저장하면 중복 없이 204
        postJson("/api/me/favorites", "{\"partId\":%d,\"myVehicleId\":%d}".formatted(muffler, vehicleB), token, 201);
        postJson("/api/me/favorites", "{\"partId\":%d,\"myVehicleId\":%d}".formatted(muffler, vehicleB), token, 204);
        // 예전 방식(차량 미지정)
        postJson("/api/me/favorites", "{\"partId\":%d}".formatted(bag), token, 201);

        assertThat(partIds(getJson("/api/me/favorites?myVehicleId=" + vehicleA, token))).containsExactly(muffler);
        assertThat(partIds(getJson("/api/me/favorites?myVehicleId=" + vehicleB, token))).containsExactlyInAnyOrder(bag, muffler);
        JsonNode unassigned = getJson("/api/me/favorites?unassigned=true", token);
        assertThat(partIds(unassigned)).containsExactly(bag);
        assertThat(unassigned.get(0).get("myVehicleId").isNull()).isTrue();
        // 전체(마이페이지): 4행, 각 행에 어느 차량인지
        JsonNode all = getJson("/api/me/favorites", token);
        assertThat(all).hasSize(4);

        // 차량 B의 머플러만 해제 -> A의 머플러는 남는다
        send(delete("/api/me/favorites/" + muffler + "?myVehicleId=" + vehicleB), token, 204);
        assertThat(partIds(getJson("/api/me/favorites?myVehicleId=" + vehicleB, token))).containsExactly(bag);
        assertThat(partIds(getJson("/api/me/favorites?myVehicleId=" + vehicleA, token))).containsExactly(muffler);

        // 차량 A 삭제 -> A에 저장한 것만 지워지고 B/차량 미지정은 그대로
        send(delete("/api/my-vehicles/" + vehicleA), token, 204);
        JsonNode after = getJson("/api/me/favorites", token);
        List<String> rows = new ArrayList<>();
        after.forEach(f -> rows.add(f.get("partId").asLong() + ":" + (f.get("myVehicleId").isNull() ? "none" : f.get("myVehicleId").asLong())));
        assertThat(rows).containsExactlyInAnyOrder(bag + ":" + vehicleB, bag + ":none");
    }

    @Test
    void 남의_차량에는_저장하거나_조회할_수_없다() throws Exception {
        String owner = signup("fav-owner");
        String other = signup("fav-other");
        long modelYearId = firstModelYearId();
        long ownersVehicle = postJson("/api/my-vehicles", "{\"modelYearId\":%d}".formatted(modelYearId), owner, 201).get("id").asLong();
        long part = createPart("남의 차량 저장 테스트", modelYearId, owner);

        postJson("/api/me/favorites", "{\"partId\":%d,\"myVehicleId\":%d}".formatted(part, ownersVehicle), other, 403);
        send(get("/api/me/favorites?myVehicleId=" + ownersVehicle), other, 403);
    }

    private String signup(String prefix) throws Exception {
        return postJson("/api/auth/signup", """
                {"email":"%s-%d@test.dev","password":"fav1234!","name":"저장테스트"}
                """.formatted(prefix, System.nanoTime()), null, 201).get("token").asText();
    }

    private long firstModelYearId() throws Exception {
        long manufacturerId = getJson("/api/manufacturers", null).get(0).get("id").asLong();
        long vehicleModelId = getJson("/api/manufacturers/" + manufacturerId + "/vehicle-models", null).get(0).get("id").asLong();
        return getJson("/api/vehicle-models/" + vehicleModelId + "/model-years", null).get(0).get("id").asLong();
    }

    private long createPart(String name, long modelYearId, String token) throws Exception {
        return postJson("/api/parts", """
                {"name":"%s %d","price":10000,"category":"머플러","imageUrl":null,
                 "sourceUrl":null,"modelYearId":%d,"vehicleModelId":null}
                """.formatted(name, System.nanoTime(), modelYearId), token, 201).get("id").asLong();
    }

    private static List<Long> partIds(JsonNode list) {
        List<Long> ids = new ArrayList<>();
        list.forEach(f -> ids.add(f.get("partId").asLong()));
        return ids;
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
