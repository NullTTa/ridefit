package com.ridefit.ridefit.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @NotBlank(message = "인증 정보가 없습니다. 비밀번호 찾기를 다시 시도해주세요.") String resetToken,
        @NotBlank(message = "새 비밀번호를 입력해주세요.") @Size(min = 8, message = "비밀번호는 8자 이상이어야 합니다.") String newPassword) {
}
