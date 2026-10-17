package com.ridefit.ridefit.service;

import com.ridefit.ridefit.domain.Member;
import com.ridefit.ridefit.domain.Role;
import com.ridefit.ridefit.dto.auth.FindPasswordRequest;
import com.ridefit.ridefit.dto.auth.FindPasswordResponse;
import com.ridefit.ridefit.dto.auth.LoginRequest;
import com.ridefit.ridefit.dto.auth.ResetPasswordRequest;
import com.ridefit.ridefit.dto.auth.SignupRequest;
import com.ridefit.ridefit.dto.auth.TokenResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final LoginAttemptService loginAttemptService;

    // 회원가입 화면에서는 항상 role=USER로만 가입된다. ADMIN 계정은 DB에서 직접 role을 바꿔서만 만든다.
    @Transactional
    public TokenResponse signup(SignupRequest request) {
        if (memberRepository.existsByEmail(request.email())) {
            throw new ApiException(HttpStatus.CONFLICT, "이미 가입된 이메일입니다.");
        }

        Member member = Member.builder()
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .name(request.name())
                .role(Role.USER)
                .build();
        Member saved = memberRepository.save(member);

        return issueToken(saved);
    }

    // clientIp: 시도 횟수 제한용 접속 주소(LoginAttemptService 참고).
    public TokenResponse login(LoginRequest request, String clientIp) {
        loginAttemptService.checkAllowed(request.email(), clientIp);

        Member member = memberRepository.findByEmail(request.email()).orElse(null);
        if (member == null || !passwordEncoder.matches(request.password(), member.getPassword())) {
            loginAttemptService.recordFailure(request.email(), clientIp);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        loginAttemptService.recordSuccess(request.email());
        return issueToken(member);
    }

    // 비밀번호 찾기는 임시로 막아 둔다. 예전에는 이메일+닉네임만 맞으면 재설정 토큰을 줬는데, 닉네임은 커뮤니티에
    // 공개되므로 남의 이메일만 알면 비밀번호를 바꿀 수 있었다. 이메일 인증(본인 메일로 받은 코드 확인)을 붙이기 전까지는
    // 토큰을 발급하지 않는다. 비밀번호를 잊은 회원은 관리자에게 문의한다.
    public FindPasswordResponse verifyForPasswordReset(FindPasswordRequest request) {
        throw passwordResetUnavailable();
    }

    public void resetPassword(ResetPasswordRequest request) {
        throw passwordResetUnavailable();
    }

    private static ApiException passwordResetUnavailable() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                "비밀번호 찾기는 현재 이용할 수 없어요. 이메일 인증 기능을 준비 중이에요. 관리자에게 문의해주세요.");
    }

    private TokenResponse issueToken(Member member) {
        String token = jwtTokenProvider.createToken(member.getId(), member.getEmail(), member.getRole());
        return new TokenResponse(token, member.getId(), member.getEmail(), member.getName(), member.getRole().name());
    }
}
