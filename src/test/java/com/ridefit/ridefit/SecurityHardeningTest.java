package com.ridefit.ridefit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.security.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 보안 점검(2026-10-17)에서 찾은 문제의 회귀 테스트.
//  - 비밀번호 재설정 토큰(purpose 클레임)을 일반 API 인증에 쓸 수 없다.
//  - 이메일+닉네임만으로 재설정하던 비밀번호 찾기는 임시 중단(503).
//  - 같은 이메일로 로그인을 5번 틀리면 비밀번호가 맞아도 잠시 막힌다(429).
//  - 공개 판매처(가격/구매 링크) 등록은 관리자만, 일반 회원이 만든 부품의 호환은 근거 미확인(note 없음)으로 저장.
//  - 내 차량 사진 주소는 이 서버에 업로드한 이미지(/uploads/...)만 받는다.
@SpringBootTest
@AutoConfigureMockMvc
class SecurityHardeningTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private JwtTokenProvider jwtTokenProvider;
    @Autowired
    private CompatibilityRepository compatibilityRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void 비밀번호_재설정_토큰으로는_일반_API를_호출할_수_없다() throws Exception {
        JsonNode user = signup("reset-token");
        String accessToken = user.get("token").asText();
        String resetToken = jwtTokenProvider.createPasswordResetToken(user.get("memberId").asLong());

        send(get("/api/me"), accessToken, 200);
        send(get("/api/me"), resetToken, 401);
        send(get("/api/my-vehicles"), resetToken, 401);
    }

    @Test
    void 비밀번호_찾기와_재설정은_임시_중단돼_토큰을_주지_않는다() throws Exception {
        JsonNode user = signup("find-pw");
        String email = user.get("email").asText();
        String name = user.get("name").asText();

        JsonNode verify = send(post("/api/auth/find-password/verify").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"%s\",\"name\":\"%s\"}".formatted(email, name)), null, 503);
        assertThat(verify.has("resetToken")).isFalse();
        assertThat(verify.get("message").asText()).contains("비밀번호 찾기는 현재 이용할 수 없어요");

        String resetToken = jwtTokenProvider.createPasswordResetToken(user.get("memberId").asLong());
        send(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"resetToken\":\"%s\",\"newPassword\":\"changed1234!\"}".formatted(resetToken)), null, 503);

        // 원래 비밀번호로 그대로 로그인된다(바뀌지 않음).
        login(email, "secure1234!", 200);
    }

    @Test
    void 같은_이메일로_로그인을_5번_틀리면_맞는_비밀번호도_잠시_막힌다() throws Exception {
        String email = signup("lockout").get("email").asText();

        for (int i = 0; i < 5; i++) {
            login(email, "wrong-password", 401);
        }
        JsonNode blocked = login(email, "secure1234!", 429);
        assertThat(blocked.get("message").asText()).contains("15분 뒤에 다시 시도");

        // 다른 회원은 영향을 받지 않는다.
        String other = signup("lockout-other").get("email").asText();
        login(other, "secure1234!", 200);
    }

    @Test
    void 판매처_등록은_관리자만_할_수_있다() throws Exception {
        String user = signup("listing-user").get("token").asText();
        String admin = login("admin@ridefit.dev", "admin1234!", 200).get("token").asText();
        long partId = createPart("판매처 권한 테스트", null, admin);
        String listing = """
                {"sellerName":"판매처","price":10000,"sourceUrl":"https://shop.example.com/p/1"}
                """;

        send(post("/api/parts/" + partId + "/listings").contentType(MediaType.APPLICATION_JSON).content(listing), user, 403);
        send(post("/api/parts/" + partId + "/listings").contentType(MediaType.APPLICATION_JSON).content(listing), null, 401);
        assertThat(send(get("/api/parts/" + partId + "/listings"), null, 200)).isEmpty();

        send(post("/api/parts/" + partId + "/listings").contentType(MediaType.APPLICATION_JSON).content(listing), admin, 201);
        assertThat(send(get("/api/parts/" + partId + "/listings"), null, 200)).hasSize(1);
    }

    @Test
    void 일반_회원이_등록한_부품의_호환은_근거_미확인으로_저장된다() throws Exception {
        String user = signup("custom-part").get("token").asText();
        long modelYearId = firstModelYearId();
        long partId = createPart("회원 등록 부품", modelYearId, user);

        var compat = compatibilityRepository.findByPartIdAndModelYearId(partId, modelYearId).orElseThrow();
        assertThat(compat.getStatus()).isEqualTo("호환가능");
        // 화면(compatStatus.js)은 "호환가능 + 메모 없음"을 "호환 근거 미확인"으로 표시한다.
        assertThat(compat.getNote()).isNull();
    }

    @Test
    void 내_차량_사진은_업로드한_이미지_주소만_저장된다() throws Exception {
        String user = signup("photo").get("token").asText();
        long vehicleId = send(post("/api/my-vehicles").contentType(MediaType.APPLICATION_JSON)
                .content("{\"modelYearId\":%d}".formatted(firstModelYearId())), user, 201).get("id").asLong();

        for (String bad : new String[]{"https://tracker.example.com/pixel.png", "javascript:alert(1)",
                "/uploads/../application.properties", "/uploads/a.svg", "//evil.example.com/a.png"}) {
            patchPhoto(vehicleId, bad, user, 400);
        }

        String uploaded = "/uploads/0f8fad5b-d9cb-469f-a165-70867728950e.png";
        assertThat(patchPhoto(vehicleId, uploaded, user, 200).get("photoUrl").asText()).isEqualTo(uploaded);
        // 빈 값은 사진 지우기(기본 차종 이미지로 돌아감).
        assertThat(patchPhoto(vehicleId, "", user, 200).get("photoUrl").isNull()).isTrue();
    }

    private JsonNode patchPhoto(long vehicleId, String photoUrl, String token, int expected) throws Exception {
        return send(patch("/api/my-vehicles/" + vehicleId).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of("photoUrl", photoUrl))), token, expected);
    }

    private JsonNode signup(String prefix) throws Exception {
        return send(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content("""
                {"email":"%s-%d@test.dev","password":"secure1234!","name":"보안%d"}
                """.formatted(prefix, System.nanoTime(), System.nanoTime() % 100000)), null, 201);
    }

    private JsonNode login(String email, String password, int expected) throws Exception {
        return send(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password)), null, expected);
    }

    private long createPart(String name, Long modelYearId, String token) throws Exception {
        return send(post("/api/parts").contentType(MediaType.APPLICATION_JSON).content("""
                {"name":"%s %d","price":10000,"category":"머플러","imageUrl":null,"sourceUrl":null,"modelYearId":%s,"vehicleModelId":null}
                """.formatted(name, System.nanoTime(), modelYearId)), token, 201).get("id").asLong();
    }

    private long firstModelYearId() throws Exception {
        long manufacturerId = send(get("/api/manufacturers"), null, 200).get(0).get("id").asLong();
        long vehicleModelId = send(get("/api/manufacturers/" + manufacturerId + "/vehicle-models"), null, 200).get(0).get("id").asLong();
        return send(get("/api/vehicle-models/" + vehicleModelId + "/model-years"), null, 200).get(0).get("id").asLong();
    }

    private JsonNode send(MockHttpServletRequestBuilder req, String token, int expected) throws Exception {
        if (token != null) req.header("Authorization", "Bearer " + token);
        String body = mockMvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return body.isBlank() ? objectMapper.nullNode() : objectMapper.readTree(body);
    }
}
