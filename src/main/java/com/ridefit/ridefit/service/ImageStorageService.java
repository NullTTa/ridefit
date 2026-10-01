package com.ridefit.ridefit.service;

import com.ridefit.ridefit.exception.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

// 부품 대표 이미지 / AI 참조 이미지 / AI 결과 이미지를 우리 서버(uploads/)에 저장하고 다시 읽는 서비스.
//
// 외부 이미지 URL을 그대로 쓰지 않고 내부에 저장하는 이유: 판매처가 이미지 주소를 바꾸거나 핫링크를
// 막으면 화면에서 이미지가 깨지고, AI 합성 때도 서버가 이미지를 직접 읽어야 하기 때문이다.
// 다운로드가 실패하면 예외 대신 빈 값을 돌려주고, 호출부는 원본 URL만 출처로 보존한다.
//
// 이미지 여부는 확장자가 아니라 파일 앞부분(매직 바이트)으로 판별한다 - PNG/JPEG/WEBP만 허용.
@Slf4j
@Service
@RequiredArgsConstructor
public class ImageStorageService {

    private static final int MAX_REMOTE_BYTES = 8 * 1024 * 1024;

    private final SafeHttpFetcher safeHttpFetcher;

    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    // 차종/부품 기본 이미지("/assets/...")가 들어 있는 프론트엔드 public 폴더. AI 합성 때 원본을 읽는 데 쓴다.
    @Value("${app.frontend-public-dir:frontend/public}")
    private String frontendPublicDir;

    public record StoredImage(byte[] bytes, String mimeType, String extension) {
    }

    public Optional<String> storeFromUrl(String imageUrl, String subdir) {
        if (imageUrl == null || imageUrl.isBlank()) return Optional.empty();
        try {
            SafeHttpFetcher.FetchResult result = safeHttpFetcher.fetch(imageUrl, MAX_REMOTE_BYTES, Duration.ofSeconds(10));
            if (result.status() / 100 != 2) {
                log.info("이미지 다운로드 실패(status={}): {}", result.status(), imageUrl);
                return Optional.empty();
            }
            String ext = detectExtension(result.body());
            if (ext == null) {
                log.info("이미지 형식이 아님(PNG/JPEG/WEBP 아님): {}", imageUrl);
                return Optional.empty();
            }
            return Optional.of(write(result.body(), subdir, ext));
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.info("이미지 다운로드 실패: {} ({})", imageUrl, e.getMessage());
            return Optional.empty();
        }
    }

    public String storeUpload(MultipartFile file, String subdir) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "업로드할 이미지가 없습니다.");
        }
        try {
            byte[] bytes = file.getBytes();
            String ext = detectExtension(bytes);
            if (ext == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "PNG, JPG, WEBP 이미지만 업로드할 수 있어요.");
            }
            return write(bytes, subdir, ext);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "이미지를 저장하지 못했어요.");
        }
    }

    public String storeBytes(byte[] bytes, String subdir) throws IOException {
        String ext = detectExtension(bytes);
        if (ext == null) throw new IOException("이미지 형식을 확인할 수 없습니다.");
        return write(bytes, subdir, ext);
    }

    // AI 참조 이미지처럼 "우리 서버에 있는 이미지"만 허용해야 하는 값을 검증한다(외부 URL은 언제든 바뀔 수 있음).
    // 빈 값이면 null(지우기), 허용되지 않거나 읽을 수 없으면 400.
    public String requireReadableInternalImage(String path) {
        if (path == null || path.isBlank()) return null;
        String value = path.trim();
        if (!value.startsWith("/uploads/") && !value.startsWith("/assets/")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "AI 장착용 이미지는 서버에 올린 이미지(/uploads, /assets)만 사용할 수 있어요.");
        }
        if (read(value).isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "이미지를 읽을 수 없어요(PNG/JPG/WEBP 파일인지 확인해주세요).");
        }
        return value;
    }

    // "/uploads/..." / "/assets/..." / 외부 http(s) URL을 모두 읽는다. 읽을 수 없으면 empty.
    public Optional<StoredImage> read(String path) {
        if (path == null || path.isBlank()) return Optional.empty();
        try {
            byte[] bytes;
            if (path.startsWith("/uploads/")) {
                bytes = readInside(Path.of(uploadDir), path.substring("/uploads/".length()));
            } else if (path.startsWith("/assets/")) {
                bytes = readInside(Path.of(frontendPublicDir), path.substring(1));
            } else if (path.startsWith("http://") || path.startsWith("https://")) {
                SafeHttpFetcher.FetchResult result = safeHttpFetcher.fetch(path, MAX_REMOTE_BYTES, Duration.ofSeconds(10));
                if (result.status() / 100 != 2) return Optional.empty();
                bytes = result.body();
            } else {
                return Optional.empty();
            }
            String ext = detectExtension(bytes);
            if (ext == null) return Optional.empty();
            return Optional.of(new StoredImage(bytes, mimeOf(ext), ext));
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.info("이미지 읽기 실패: {} ({})", path, e.getMessage());
            return Optional.empty();
        }
    }

    // root 밖으로 벗어나는 경로(../)는 거부한다.
    private byte[] readInside(Path root, String relative) throws IOException {
        Path base = root.toAbsolutePath().normalize();
        Path target = base.resolve(relative).normalize();
        if (!target.startsWith(base)) throw new IOException("허용되지 않은 경로");
        if (!Files.isRegularFile(target)) throw new IOException("파일 없음: " + relative);
        return Files.readAllBytes(target);
    }

    private String write(byte[] bytes, String subdir, String ext) throws IOException {
        Path dir = Path.of(uploadDir, subdir);
        Files.createDirectories(dir);
        String filename = UUID.randomUUID() + "." + ext;
        Files.write(dir.resolve(filename), bytes);
        return "/uploads/" + subdir + "/" + filename;
    }

    static String detectExtension(byte[] b) {
        if (b == null || b.length < 12) return null;
        if ((b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "png";
        if ((b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "jpg";
        if (b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "webp";
        return null;
    }

    static String mimeOf(String ext) {
        return switch (ext) {
            case "png" -> "image/png";
            case "jpg" -> "image/jpeg";
            case "webp" -> "image/webp";
            default -> "application/octet-stream";
        };
    }
}
