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

        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String ext = original.contains(".") ? original.substring(original.lastIndexOf('.')) : "";
        String filename = UUID.randomUUID() + ext;

        try {
            Files.copy(file.getInputStream(), root.resolve(filename));
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "파일을 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
        }

        return "/uploads/" + filename;
    }
}
