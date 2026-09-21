package com.ridefit.ridefit.dto.auth;

// resetToken은 비밀번호를 알려주는 게 아니라, 새 비밀번호 설정 화면으로 넘어가기 위한 단기 토큰이다.
public record FindPasswordResponse(String resetToken) {
}
