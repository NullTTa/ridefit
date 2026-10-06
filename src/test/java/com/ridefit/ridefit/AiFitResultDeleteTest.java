package com.ridefit.ridefit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ridefit.ridefit.domain.AiFitResult;
import com.ridefit.ridefit.domain.Member;
import com.ridefit.ridefit.repository.AiFitResultRepository;
import com.ridefit.ridefit.repository.FavoriteRepository;
import com.ridefit.ridefit.repository.MemberRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// "저장된 장착 모습" 개별 삭제: 본인 결과만, DB 행 + uploads/ai-fit 파일 정리(같은 파일을 다른 결과가 쓰면 파일은 남김).
// 부품 저장(즐겨찾기)에는 영향 없음. 업로드 폴더는 임시 폴더(실제 uploads/ai-fit 은 건드리지 않음).
@SpringBootTest
@AutoConfigureMockMvc
class AiFitResultDeleteTest {

    @TempDir
    static Path uploads;

    @DynamicPropertySource
    static void uploadDir(DynamicPropertyRegistry registry) {
        registry.add("app.upload-dir", () -> uploads.toString());
    }

    @Autowired MockMvc mockMvc;
    @Autowired AiFitResultRepository aiFitResultRepository;
    @Autowired MemberRepository memberRepository;
    @Autowired FavoriteRepository favoriteRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void 본인_장착_모습만_하나씩_지워지고_공유되지_않은_파일만_정리된다() throws Exception {
        Member user = memberRepository.findByEmail("user@ridefit.dev").orElseThrow();
        Member admin = memberRepository.findByEmail("admin@ridefit.dev").orElseThrow();
        String userToken = login("user@ridefit.dev", "user1234!");
        String adminToken = login("admin@ridefit.dev", "admin1234!");
        long favoritesBefore = favoriteRepository.count();

        Path dir = Files.createDirectories(uploads.resolve("ai-fit"));
        String own = "/uploads/ai-fit/" + file(dir);
        String keep = "/uploads/ai-fit/" + file(dir);
        String shared = "/uploads/ai-fit/" + file(dir);
        AiFitResult a = save(user, own);
        AiFitResult b = save(user, keep);
        AiFitResult s1 = save(user, shared);
        AiFitResult s2 = save(user, shared);

        // 로그인 없이 401, 다른 회원 403(파일/행 그대로), 없는 id 404
        mockMvc.perform(delete("/api/ai-fit/results/" + a.getId())).andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/ai-fit/results/" + a.getId()).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isForbidden());
        assertThat(aiFitResultRepository.existsById(a.getId())).isTrue();
        assertThat(Files.exists(path(own))).isTrue();
        mockMvc.perform(delete("/api/ai-fit/results/999999999").header("Authorization", "Bearer " + userToken))
                .andExpect(status().isNotFound());

        // 본인 결과 1건 삭제 -> 그 행과 파일만 사라지고 다른 결과는 그대로
        mockMvc.perform(delete("/api/ai-fit/results/" + a.getId()).header("Authorization", "Bearer " + userToken))
                .andExpect(status().isNoContent());
        assertThat(aiFitResultRepository.existsById(a.getId())).isFalse();
        assertThat(Files.exists(path(own))).isFalse();
        assertThat(aiFitResultRepository.existsById(b.getId())).isTrue();
        assertThat(Files.exists(path(keep))).isTrue();

        // 같은 파일을 두 결과가 쓰면 하나를 지워도 파일은 남고, 마지막 결과를 지울 때 파일도 정리
        mockMvc.perform(delete("/api/ai-fit/results/" + s1.getId()).header("Authorization", "Bearer " + userToken))
                .andExpect(status().isNoContent());
        assertThat(Files.exists(path(shared))).isTrue();
        mockMvc.perform(delete("/api/ai-fit/results/" + s2.getId()).header("Authorization", "Bearer " + userToken))
                .andExpect(status().isNoContent());
        assertThat(Files.exists(path(shared))).isFalse();

        // 부품 저장(즐겨찾기)은 영향 없음
        assertThat(favoriteRepository.count()).isEqualTo(favoritesBefore);
        aiFitResultRepository.deleteById(b.getId());
        assertThat(admin.getId()).isNotNull();
    }

    private String file(Path dir) throws Exception {
        String name = UUID.randomUUID() + ".png";
        Files.write(dir.resolve(name), new byte[] {(byte) 0x89, 'P', 'N', 'G'});
        return name;
    }

    private Path path(String url) {
        return uploads.resolve("ai-fit").resolve(url.substring("/uploads/ai-fit/".length()));
    }

    private AiFitResult save(Member member, String image) {
        return aiFitResultRepository.save(AiFitResult.builder()
                .cacheKey("delete-test-" + UUID.randomUUID())
                .generatedImage(image)
                .requestedByMemberId(member.getId())
                .createdAt(LocalDateTime.now())
                .build());
    }

    private String login(String email, String password) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("token").asText();
    }
}
