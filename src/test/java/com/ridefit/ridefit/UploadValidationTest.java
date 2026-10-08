package com.ridefit.ridefit;

import com.fasterxml.jackson.databind.ObjectMapper;
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

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 커뮤니티 사진 업로드(/api/uploads): 정상 이미지만 저장하고, 사진이 아니거나 앞부분만 PNG인 깨진 파일은 안내와 함께 400.
// (10MB 초과는 MockMvc가 서블릿 크기 제한을 적용하지 않아 실제 서버 확인으로 대신한다.)
@SpringBootTest
@AutoConfigureMockMvc
class UploadValidationTest {

    @TempDir
    static Path uploads;

    @DynamicPropertySource
    static void uploadDir(DynamicPropertyRegistry registry) {
        registry.add("app.upload-dir", () -> uploads.toString());
    }

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void 정상_이미지만_저장되고_사진이_아니거나_손상된_파일은_400() throws Exception {
        String token = login();

        ByteArrayOutputStream png = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(4, 4, BufferedImage.TYPE_INT_ARGB), "png", png);
        String body = mockMvc.perform(multipart("/api/uploads")
                        .file(new MockMultipartFile("file", "ok.png", "image/png", png.toByteArray()))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String url = objectMapper.readTree(body).get("url").asText();
        assertThat(Files.exists(uploads.resolve(url.substring("/uploads/".length())))).isTrue();

        long before;
        try (var files = Files.list(uploads)) {
            before = files.count();
        }

        mockMvc.perform(multipart("/api/uploads")
                        .file(new MockMultipartFile("file", "x.png", "image/png", "<html>hi</html>".getBytes(StandardCharsets.UTF_8)))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("사진 파일(PNG, JPG, WEBP, GIF)만 올릴 수 있어요."));

        byte[] broken = new byte[40];
        byte[] signature = {(byte) 0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a};
        System.arraycopy(signature, 0, broken, 0, signature.length);
        mockMvc.perform(multipart("/api/uploads")
                        .file(new MockMultipartFile("file", "broken.png", "image/png", broken))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("이미지 파일이 손상돼 열 수 없어요. 다른 사진으로 다시 올려주세요."));

        try (var files = Files.list(uploads)) {
            assertThat(files.count()).isEqualTo(before); // 거절된 파일은 저장되지 않는다
        }
    }

    private String login() throws Exception {
        String res = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"user@ridefit.dev\",\"password\":\"user1234!\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(res).get("token").asText();
    }
}
