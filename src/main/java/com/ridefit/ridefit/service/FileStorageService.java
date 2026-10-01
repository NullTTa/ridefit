package com.ridefit.ridefit.service;

import com.ridefit.ridefit.exception.ApiException;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

// 커뮤니티 글쓰기 사진 첨부용 최소 로컬 파일 업로드. /uploads/** 정적 경로로 그대로 서빙된다(WebConfig).
@Service
public class FileStorageService {

    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    private Path root;

    @PostConstruct
    void init() throws IOException {
        root = Path.of(uploadDir);
        Files.createDirectories(root);
    }

    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "업로드할 파일이 없습니다.");
        }

        // 사진 첨부 전용이다. 사용자가 보낸 파일명/Content-Type은 믿지 않고 파일 앞부분(매직 바이트)으로
        // PNG/JPEG/WEBP/GIF인지 확인한 뒤, 확장자도 그 결과로 정한다. (예전에는 .html 등 아무 파일이나
        // 올라가 /uploads/** 에서 그대로 열릴 수 있었다.)
        String filename;
        try {
            byte[] bytes = file.getBytes();
            String ext = detectImageExtension(bytes);
            if (ext == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "사진 파일(PNG, JPG, WEBP, GIF)만 올릴 수 있어요.");
            }
            filename = UUID.randomUUID() + "." + ext;
            Files.write(root.resolve(filename), bytes);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "파일을 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
        }

        return "/uploads/" + filename;
    }

    private static String detectImageExtension(byte[] b) {
        String ext = ImageStorageService.detectExtension(b);
        if (ext != null) return ext;
        if (b != null && b.length >= 6 && b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8') return "gif";
        return null;
    }
}
