package com.ridefit.ridefit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ridefit.ridefit.domain.AiFitResult;
import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.repository.AiFitResultRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.PartRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 차량 삭제 = 그 차량으로 저장한 장착 모습(차량 주인 것만)도 함께 삭제. 이미지 파일은 커밋 뒤, 아무 데서도 안 쓰는 것만 지운다.
// 업로드 폴더는 임시 폴더(실제 uploads/ai-fit은 건드리지 않음).
@SpringBootTest
@AutoConfigureMockMvc
class VehicleDeleteFitResultsTest {

    @TempDir
    static Path uploads;

    @DynamicPropertySource
    static void uploadDir(DynamicPropertyRegistry registry) {
        registry.add("app.upload-dir", () -> uploads.toString());
    }

    @Autowired MockMvc mockMvc;
    @Autowired AiFitResultRepository aiFitResultRepository;
    @Autowired PartRepository partRepository;
    @MockitoSpyBean MyVehicleRepository myVehicleRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void 차량의_장착_모습만_지워지고_다른_차량_회원_예전결과_공유파일은_남는다() throws Exception {
        Owner a = signup("vdf-a");
        Owner b = signup("vdf-b");
        long modelYearId = firstModelYearId();
        long v1 = createVehicle(a.token, modelYearId);
        long v2 = createVehicle(a.token, modelYearId);
        long vb = createVehicle(b.token, modelYearId);
        Path dir = Files.createDirectories(uploads.resolve("ai-fit"));

        String own = file(dir);
        String shared = file(dir);
        String partRef = file(dir);
        String otherOwner = file(dir);
        String legacy = file(dir);
        AiFitResult r1 = save(a.memberId, v1, own);
        AiFitResult r2 = save(a.memberId, v1, shared);
        AiFitResult r3 = save(a.memberId, v2, shared);       // 다른 차량이 같은 파일 사용
        AiFitResult r4 = save(a.memberId, v1, partRef);      // 부품 AI 참조 이미지가 같은 파일 사용
        AiFitResult r5 = save(b.memberId, v1, otherOwner);   // 차량 id만 같은 다른 회원 결과(비정상 데이터)
        AiFitResult r6 = save(a.memberId, null, legacy);     // 차량 id 없는 예전 결과
        AiFitResult rb = save(b.memberId, vb, file(dir));

        Part part = partRepository.findAll().get(0);
        String partRefBefore = part.getAiReferenceImageUrl();
        part.setAiReferenceImageUrl(partRef);
        partRepository.save(part);
        try {
            send(delete("/api/my-vehicles/" + v1), a.token, 204);

            assertThat(aiFitResultRepository.existsById(r1.getId())).isFalse();
            assertThat(aiFitResultRepository.existsById(r2.getId())).isFalse();
            assertThat(aiFitResultRepository.existsById(r4.getId())).isFalse();
            assertThat(Files.exists(path(own))).isFalse();
            // 남는 것
            assertThat(aiFitResultRepository.existsById(r3.getId())).isTrue();
            assertThat(Files.exists(path(shared))).isTrue();
            assertThat(Files.exists(path(partRef))).isTrue();
            assertThat(aiFitResultRepository.existsById(r5.getId())).isTrue();
            assertThat(Files.exists(path(otherOwner))).isTrue();
            assertThat(aiFitResultRepository.existsById(r6.getId())).isTrue();
            assertThat(aiFitResultRepository.existsById(rb.getId())).isTrue();
            // 다른 차량의 결과 목록은 그대로 보인다
            assertThat(getJson("/api/ai-fit/results?myVehicleId=" + v2, a.token).toString()).contains(shared);
        } finally {
            part.setAiReferenceImageUrl(partRefBefore);
            partRepository.save(part);
            aiFitResultRepository.deleteAllById(java.util.List.of(r3.getId(), r5.getId(), r6.getId(), rb.getId()));
        }
    }

    @Test
    void 장착_모습이_없는_차량도_삭제된다() throws Exception {
        Owner a = signup("vdf-empty");
        long v = createVehicle(a.token, firstModelYearId());
        send(delete("/api/my-vehicles/" + v), a.token, 204);
        assertThat(getJson("/api/my-vehicles", a.token)).isEmpty();
    }

    @Test
    void 차량_삭제가_DB에서_실패하면_장착_모습과_파일이_그대로다() throws Exception {
        Owner a = signup("vdf-rollback");
        long v = createVehicle(a.token, firstModelYearId());
        Path dir = Files.createDirectories(uploads.resolve("ai-fit"));
        String img = file(dir);
        AiFitResult r = save(a.memberId, v, img);

        Mockito.doThrow(new IllegalStateException("테스트용 DB 오류")).when(myVehicleRepository).delete(any(MyVehicle.class));
        try {
            send(delete("/api/my-vehicles/" + v), a.token, 500);
        } finally {
            Mockito.reset(myVehicleRepository);
        }
        assertThat(aiFitResultRepository.existsById(r.getId())).isTrue();
        assertThat(Files.exists(path(img))).isTrue();
        assertThat(getJson("/api/my-vehicles", a.token)).hasSize(1);

        send(delete("/api/my-vehicles/" + v), a.token, 204);
        assertThat(aiFitResultRepository.existsById(r.getId())).isFalse();
        assertThat(Files.exists(path(img))).isFalse();
    }

    @Test
    void 파일_삭제가_실패해도_차량과_결과_삭제는_완료된다() throws Exception {
        Owner a = signup("vdf-filefail");
        long v = createVehicle(a.token, firstModelYearId());
        Path dir = Files.createDirectories(uploads.resolve("ai-fit"));
        // 비어 있지 않은 폴더 -> Files.deleteIfExists가 예외(지울 수 없음) -> 파일만 남고 DB는 정상 삭제
        String name = UUID.randomUUID() + ".png";
        Files.createDirectories(dir.resolve(name));
        Files.write(dir.resolve(name).resolve("x"), new byte[] {1});
        AiFitResult r = save(a.memberId, v, "/uploads/ai-fit/" + name);

        send(delete("/api/my-vehicles/" + v), a.token, 204);
        assertThat(aiFitResultRepository.existsById(r.getId())).isFalse();
        assertThat(getJson("/api/my-vehicles", a.token)).isEmpty();
        assertThat(Files.exists(dir.resolve(name))).isTrue();
    }

    private record Owner(String token, long memberId) {
    }

    private Owner signup(String prefix) throws Exception {
        JsonNode r = send(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content("""
                {"email":"%s-%d@test.dev","password":"vdf1234!","name":"차량삭제테스트"}
                """.formatted(prefix, System.nanoTime())), null, 201);
        return new Owner(r.get("token").asText(), r.get("memberId").asLong());
    }

    private long createVehicle(String token, long modelYearId) throws Exception {
        return send(post("/api/my-vehicles").contentType(MediaType.APPLICATION_JSON)
                .content("{\"modelYearId\":%d}".formatted(modelYearId)), token, 201).get("id").asLong();
    }

    private long firstModelYearId() throws Exception {
        long manufacturerId = getJson("/api/manufacturers", null).get(0).get("id").asLong();
        long vehicleModelId = getJson("/api/manufacturers/" + manufacturerId + "/vehicle-models", null).get(0).get("id").asLong();
        return getJson("/api/vehicle-models/" + vehicleModelId + "/model-years", null).get(0).get("id").asLong();
    }

    private AiFitResult save(long memberId, Long myVehicleId, String image) {
        return aiFitResultRepository.save(AiFitResult.builder()
                .cacheKey("vehicle-delete-test-" + UUID.randomUUID())
                .generatedImage(image)
                .model("direct-composite")
                .requestedByMemberId(memberId)
                .myVehicleId(myVehicleId)
                .createdAt(LocalDateTime.now())
                .build());
    }

    private String file(Path dir) throws Exception {
        String name = UUID.randomUUID() + ".png";
        Files.write(dir.resolve(name), new byte[] {(byte) 0x89, 'P', 'N', 'G'});
        return "/uploads/ai-fit/" + name;
    }

    private Path path(String url) {
        return uploads.resolve("ai-fit").resolve(url.substring("/uploads/ai-fit/".length()));
    }

    private JsonNode getJson(String url, String token) throws Exception {
        return send(get(url), token, 200);
    }

    private JsonNode send(MockHttpServletRequestBuilder req, String token, int expected) throws Exception {
        if (token != null) req.header("Authorization", "Bearer " + token);
        String body = mockMvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return body.isBlank() ? objectMapper.nullNode() : objectMapper.readTree(body);
    }
}
