package com.ridefit.ridefit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ridefit.ridefit.domain.AiFitResult;
import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.Member;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.repository.AiFitResultRepository;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.ManufacturerRepository;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.ModelYearRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.VehicleModelRepository;
import com.ridefit.ridefit.service.AiFitService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 휠 "직접 합성" 장착 모습 저장(AI 없음): 본인 차량 + 호환 부품 + 차량 사진과 같은 비율/원본 해상도 이상 PNG만.
// 같은 조합은 저장된 결과를 재사용(새 파일 없음), 서비스 전체 AI 일일 한도에는 세지 않는다.
// 새 휠 부품은 가격 없이(null) 2025 Super Cub 110(JA59)에만 호환 등록된다.
@SpringBootTest
@AutoConfigureMockMvc
class CompositeFitTest {

    static final String WHEEL = "슈퍼커브110 수제 튜닝 마차 휠 (21~25년식)";

    @TempDir
    static Path uploads;

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("app.upload-dir", () -> uploads.toString());
        // 테스트는 저장소 루트에서 돈다 - 차량 대표 사진(/assets/vehicles/super-cub-110.png, 1829x860)을 실제로 읽는다.
        registry.add("app.frontend-public-dir", () -> "frontend/public");
    }

    @Autowired MockMvc mockMvc;
    @Autowired PartRepository partRepository;
    @Autowired CompatibilityRepository compatibilityRepository;
    @Autowired MyVehicleRepository myVehicleRepository;
    @Autowired MemberRepository memberRepository;
    @Autowired AiFitResultRepository aiFitResultRepository;
    @Autowired ManufacturerRepository manufacturerRepository;
    @Autowired VehicleModelRepository vehicleModelRepository;
    @Autowired ModelYearRepository modelYearRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @Transactional(readOnly = true)
    void 새_휠은_가격없이_2025_슈퍼커브110에만_호환된다() {
        Part wheel = partRepository.findByName(WHEEL).orElseThrow();
        assertThat(wheel.getCategory()).isEqualTo("휠");
        assertThat(wheel.getPrice()).isNull();
        assertThat(wheel.getImageUrl()).isEqualTo("/assets/parts/supercub110-handmade-spoke-wheel.png");
        assertThat(wheel.getAiReferenceImageUrl()).isNull();
        List<Compatibility> compat = compatibilityRepository.findAll().stream()
                .filter(c -> c.getPart().getId().equals(wheel.getId())).toList();
        assertThat(compat).hasSize(1);
        assertThat(compat.get(0).getModelYear().getYear()).isEqualTo(2025);
        assertThat(compat.get(0).getModelYear().getChassisCode()).isEqualTo("JA59");
        assertThat(compat.get(0).getModelYear().getVehicleModel().getName()).isEqualTo("Super Cub 110");
    }

    @Test
    void 직접_합성_저장_검증과_재사용() throws Exception {
        Member user = memberRepository.findByEmail("user@ridefit.dev").orElseThrow();
        String userToken = login("user@ridefit.dev", "user1234!");
        String adminToken = login("admin@ridefit.dev", "admin1234!");
        Part wheel = partRepository.findByName(WHEEL).orElseThrow();
        ModelYear year = manufacturerRepository.findByName("Honda")
                .flatMap(m -> vehicleModelRepository.findByManufacturerIdAndName(m.getId(), "Super Cub 110"))
                .flatMap(vm -> modelYearRepository.findByVehicleModelIdAndYear(vm.getId(), 2025))
                .orElseThrow();
        // 사용자 사진 없이 차종 대표 사진을 쓰는 2025 Super Cub 110(테스트 끝에 지운다)
        MyVehicle cub25 = myVehicleRepository.save(MyVehicle.builder().member(user).modelYear(year).build());
        long aiCountBefore = aiFitResultRepository.countGeneratedSince(LocalDate.now().atStartOfDay(), AiFitService.COMPOSITE_MODEL);

        byte[] good = png(2127, 1000);
        // 로그인 없이 401, 다른 회원 차량 403
        mockMvc.perform(compose(cub25.getId(), wheel.getId(), good)).andExpect(status().isUnauthorized());
        mockMvc.perform(compose(cub25.getId(), wheel.getId(), good).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isForbidden());
        // 비율이 다르거나(정사각형) 원본보다 작은(축소본) 이미지, PNG가 아닌 파일은 거절
        mockMvc.perform(compose(cub25.getId(), wheel.getId(), png(1000, 1000)).header("Authorization", "Bearer " + userToken))
                .andExpect(status().isBadRequest());
        mockMvc.perform(compose(cub25.getId(), wheel.getId(), png(1063, 500)).header("Authorization", "Bearer " + userToken))
                .andExpect(status().isBadRequest());
        mockMvc.perform(compose(cub25.getId(), wheel.getId(), "not an image".getBytes()).header("Authorization", "Bearer " + userToken))
                .andExpect(status().isBadRequest());
        // 이미지가 빠진 요청은 400(서버 오류 아님)
        mockMvc.perform(multipart("/api/ai-fit/composite").param("myVehicleId", String.valueOf(cub25.getId()))
                        .param("partIds", String.valueOf(wheel.getId())).header("Authorization", "Bearer " + userToken))
                .andExpect(status().isBadRequest());
        // 이 차량과 호환이 없는 부품(다른 차종 전용 부품)은 409
        Part incompatible = partRepository.findAll().stream()
                .filter(p -> compatibilityRepository.findByPartIdAndModelYearId(p.getId(), year.getId()).isEmpty())
                .findFirst().orElseThrow();
        mockMvc.perform(compose(cub25.getId(), incompatible.getId(), good).header("Authorization", "Bearer " + userToken))
                .andExpect(status().isConflict());

        // 정상 저장 -> 결과 행(model=direct-composite) + uploads/ai-fit 파일
        JsonNode first = json(mockMvc.perform(compose(cub25.getId(), wheel.getId(), good).header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(first.get("cached").asBoolean()).isFalse();
        AiFitResult saved = aiFitResultRepository.findById(first.get("id").asLong()).orElseThrow();
        assertThat(saved.getModel()).isEqualTo(AiFitService.COMPOSITE_MODEL);
        assertThat(saved.getMyVehicleId()).isEqualTo(cub25.getId());
        assertThat(saved.getRequestedByMemberId()).isEqualTo(user.getId());
        assertThat(saved.getPartIds()).isEqualTo(String.valueOf(wheel.getId()));
        Path file = uploads.resolve("ai-fit").resolve(saved.getGeneratedImage().substring("/uploads/ai-fit/".length()));
        assertThat(Files.exists(file)).isTrue();
        BufferedImage stored = ImageIO.read(file.toFile());
        assertThat(stored.getWidth()).isEqualTo(2127);
        assertThat(stored.getHeight()).isEqualTo(1000);

        // 같은 조합 다시 저장 -> 같은 결과 재사용(새 행/새 파일 없음)
        long filesBefore;
        try (var s = Files.list(uploads.resolve("ai-fit"))) {
            filesBefore = s.count();
        }
        JsonNode again = json(mockMvc.perform(compose(cub25.getId(), wheel.getId(), good).header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(again.get("cached").asBoolean()).isTrue();
        assertThat(again.get("id").asLong()).isEqualTo(saved.getId());
        try (var s = Files.list(uploads.resolve("ai-fit"))) {
            assertThat(s.count()).isEqualTo(filesBefore);
        }

        // 삭제된(없는) 업로드 파일은 404
        mockMvc.perform(get("/uploads/ai-fit/does-not-exist.png"))
                .andExpect(status().isNotFound());
        // 서비스 전체 AI 일일 한도에는 세지 않는다
        assertThat(aiFitResultRepository.countGeneratedSince(LocalDate.now().atStartOfDay(), AiFitService.COMPOSITE_MODEL))
                .isEqualTo(aiCountBefore);
        aiFitResultRepository.deleteById(saved.getId());
        myVehicleRepository.deleteById(cub25.getId());
    }

    private MockMultipartHttpServletRequestBuilder compose(Long myVehicleId, Long partId, byte[] image) {
        MockMultipartHttpServletRequestBuilder b = multipart("/api/ai-fit/composite")
                .file(new MockMultipartFile("image", "fit.png", "image/png", image));
        b.param("myVehicleId", String.valueOf(myVehicleId));
        b.param("partIds", String.valueOf(partId));
        b.param("version", "test-v1");
        return b;
    }

    private static byte[] png(int w, int h) throws Exception {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        img.setRGB(w / 2, h / 2, 0xff336699);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    private JsonNode json(String body) throws Exception {
        return objectMapper.readTree(body);
    }

    private String login(String email, String password) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("token").asText();
    }
}
