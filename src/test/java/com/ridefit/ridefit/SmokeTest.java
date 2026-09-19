package com.ridefit.ridefit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 20번(전체 흐름 스모크 테스트): 회원가입 -> 로그인 -> 차량 등록 -> 부품 등록(수동 입력 경로) ->
// 호환성 확인 -> AI 합성(mock) -> 커뮤니티 글쓰기/댓글 -> 관리자 로그인 -> 관리자 화면 접근까지
// 하나의 시나리오로 실제 HTTP 요청/응답(MockMvc)을 통해 검증한다.
// 실제 MySQL이 아니라 H2(test 프로필)로 돌기 때문에, 이 저장소 환경에서도 재현 가능하다.
@SpringBootTest
@AutoConfigureMockMvc
class SmokeTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void 회원가입부터_관리자_화면_접근까지_전체_흐름이_끊기지_않는다() throws Exception {
        String email = "smoke-" + System.currentTimeMillis() + "@test.dev";

        // 1) 회원가입
        JsonNode signupResponse = postJson("/api/auth/signup", """
                {"email":"%s","password":"smoke1234!","name":"스모크유저"}
                """.formatted(email), null, 201);
        String userToken = signupResponse.get("token").asText();
        assertThat(userToken).isNotBlank();

        // 2) 카탈로그(제조사->모델->연식) 조회 - 시드 데이터가 있어야 한다
        JsonNode manufacturers = getJson("/api/manufacturers", null, 200);
        assertThat(manufacturers).isNotEmpty();
        long manufacturerId = manufacturers.get(0).get("id").asLong();

        JsonNode models = getJson("/api/manufacturers/" + manufacturerId + "/vehicle-models", null, 200);
        assertThat(models).isNotEmpty();
        long vehicleModelId = models.get(0).get("id").asLong();

        JsonNode years = getJson("/api/vehicle-models/" + vehicleModelId + "/model-years", null, 200);
        assertThat(years).isNotEmpty();
        long modelYearId = years.get(0).get("id").asLong();

        // 3) 내 차량 등록
        JsonNode myVehicle = postJson("/api/my-vehicles",
                "{\"modelYearId\":%d,\"photoUrl\":null}".formatted(modelYearId), userToken, 201);
        long myVehicleId = myVehicle.get("id").asLong();

        // 4) 부품 등록 - 크롤링 실패 시 이어지는 "수동 입력" 경로를 그대로 검증한다
        //    (등록과 동시에 이 modelYearId에 대한 Compatibility(호환가능)가 생성된다)
        JsonNode part = postJson("/api/parts", """
                {"name":"스모크 테스트 머플러","price":100000,"category":"머플러","imageUrl":null,
                 "sourceUrl":null,"modelYearId":%d,"vehicleModelId":null}
                """.formatted(modelYearId), userToken, 201);
        long partId = part.get("id").asLong();

        // 5) 차량을 선택하는 즉시 호환 여부 확인 -> 방금 등록했으니 호환되어야 한다
        JsonNode check = getJson("/api/parts/" + partId + "/check?myVehicleId=" + myVehicleId, userToken, 200);
        assertThat(check.get("proceedAllowed").asBoolean()).isTrue();
        assertThat(check.get("status").asText()).isEqualTo("호환가능");

        // 6) 호환되는 부품에 한해 AI 합성(mock) 실행
        JsonNode synth = postJson("/api/synth",
                "{\"partId\":%d,\"myVehicleId\":%d}".formatted(partId, myVehicleId), userToken, 200);
        assertThat(synth.get("mode").asText()).isEqualTo("mock");
        assertThat(synth.get("imageUrl").asText()).isNotBlank();

        // 7) 커뮤니티 글쓰기 (장착 부품 + 호환 여부 후기 포함) + 댓글
        JsonNode post = postJson("/api/posts", """
                {"title":"스모크 테스트 후기","content":"문제 없이 장착했어요","installedPartId":%d,
                 "myVehicleId":%d,"compatibleFeedback":"MATCHED","imageUrl":null,"videoUrl":null}
                """.formatted(partId, myVehicleId), userToken, 201);
        long postId = post.get("id").asLong();

        postJson("/api/posts/" + postId + "/comments", "{\"content\":\"저도 같은 부품 써봤어요\"}", userToken, 201);

        JsonNode postDetail = getJson("/api/posts/" + postId, null, 200);
        assertThat(postDetail.get("comments")).hasSize(1);

        // 8) 일반 유저는 관리자 화면에 접근할 수 없어야 한다
        mockMvc.perform(get("/api/admin/members").header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());

        // 9) 시드 데이터의 관리자 계정으로 로그인해서 관리자 화면(회원/호환성 관리) 접근
        JsonNode adminLogin = postJson("/api/auth/login",
                "{\"email\":\"admin@ridefit.dev\",\"password\":\"admin1234!\"}", null, 200);
        String adminToken = adminLogin.get("token").asText();

        JsonNode members = getJson("/api/admin/members", adminToken, 200);
        assertThat(members.get("content")).isNotEmpty();

        JsonNode compatibilities = getJson("/api/admin/compatibilities", adminToken, 200);
        assertThat(compatibilities.get("content")).isNotEmpty();

        // 10) 회원 탈퇴까지 이어져도(계정관리 편의기능) 끊기지 않아야 한다
        mockMvc.perform(delete("/api/me").header("Authorization", "Bearer " + userToken))
                .andExpect(status().isNoContent());
    }

    private JsonNode postJson(String url, String body, String token, int expectedStatus) throws Exception {
        var request = post(url).contentType(MediaType.APPLICATION_JSON).content(body);
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        String response = mockMvc.perform(request)
                .andExpect(status().is(expectedStatus))
                .andReturn().getResponse().getContentAsString();
        return response.isBlank() ? objectMapper.createObjectNode() : objectMapper.readTree(response);
    }

    private JsonNode getJson(String url, String token, int expectedStatus) throws Exception {
        var request = get(url);
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        String response = mockMvc.perform(request)
                .andExpect(status().is(expectedStatus))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response);
    }
}
