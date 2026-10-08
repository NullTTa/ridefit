package com.ridefit.ridefit.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Map;

// 모든 API 에러 응답을 { "message": "사람이 읽을 수 있는 문구" } 형태로 통일한다.
// 프론트엔드가 어디서든 err.message 하나만 보면 되게 해서 "오류: undefined" 같은 상황을 막는다.
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, String>> handleApiException(ApiException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(err -> err.getDefaultMessage())
                .orElse("입력값을 확인해주세요.");
        return ResponseEntity.badRequest().body(Map.of("message", message));
    }

    // 필수 파라미터/업로드 파일이 빠진 요청(예: 장착 모습 저장에 이미지 없음)은 서버 오류가 아니라 400.
    @ExceptionHandler({MissingServletRequestParameterException.class, MissingServletRequestPartException.class})
    public ResponseEntity<Map<String, String>> handleMissing(Exception e) {
        return ResponseEntity.badRequest().body(Map.of("message", "필요한 값이 빠졌어요. 입력값을 확인해주세요."));
    }

    // 업로드 크기 제한(spring.servlet.multipart.max-file-size=10MB)을 넘은 파일은 서버 오류(500)가 아니라 413 + 안내.
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handleTooLarge(MaxUploadSizeExceededException e) {
        return ResponseEntity.status(HttpStatus.CONTENT_TOO_LARGE).body(Map.of("message", "파일이 너무 커요. 10MB 이하 이미지만 올릴 수 있어요."));
    }

    // 없는 정적 파일(예: 삭제된 /uploads 이미지)은 500이 아니라 404 - 화면은 이미지 대체 표시로 처리한다.
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, String>> handleNoResource(NoResourceFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "요청한 파일을 찾을 수 없어요."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception e) {
        log.error("처리되지 않은 예외", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("message", "일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요."));
    }
}
