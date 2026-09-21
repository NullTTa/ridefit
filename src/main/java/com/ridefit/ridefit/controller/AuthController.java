package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.dto.auth.FindPasswordRequest;
import com.ridefit.ridefit.dto.auth.FindPasswordResponse;
import com.ridefit.ridefit.dto.auth.LoginRequest;
import com.ridefit.ridefit.dto.auth.ResetPasswordRequest;
import com.ridefit.ridefit.dto.auth.SignupRequest;
import com.ridefit.ridefit.dto.auth.TokenResponse;
import com.ridefit.ridefit.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/signup")
    public ResponseEntity<TokenResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.signup(request));
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    // 비밀번호를 알려주는 게 아니라, 본인 확인 후 새 비밀번호 설정 화면으로 넘어가기 위한 단기 토큰을 내려준다.
    @PostMapping("/find-password/verify")
    public ResponseEntity<FindPasswordResponse> verifyForPasswordReset(@Valid @RequestBody FindPasswordRequest request) {
        return ResponseEntity.ok(authService.verifyForPasswordReset(request));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.ok().build();
    }
}
