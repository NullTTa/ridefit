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

    public TokenResponse login(LoginRequest request) {
        Member member = memberRepository.findByEmail(request.email())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다."));

        if (!passwordEncoder.matches(request.password(), member.getPassword())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        return issueToken(member);
    }

    // 이메일+닉네임(회원가입 때 등록한 닉네임)이 일치하면 비밀번호는 절대 알려주지 않고, 새 비밀번호를 설정할 수 있는 단기 토큰만 내려준다.
    public FindPasswordResponse verifyForPasswordReset(FindPasswordRequest request) {
        Member member = memberRepository.findByEmail(request.email())
                .filter(m -> request.name().trim().equals(m.getName()))
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "이메일 또는 닉네임이 일치하는 회원 정보를 찾을 수 없어요."));

        String resetToken = jwtTokenProvider.createPasswordResetToken(member.getId());
        return new FindPasswordResponse(resetToken);
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        if (!jwtTokenProvider.isPasswordResetToken(request.resetToken())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "인증이 만료됐어요. 비밀번호 찾기를 다시 시도해주세요.");
        }

        Member member = memberRepository.findById(jwtTokenProvider.getMemberId(request.resetToken()))
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "인증이 만료됐어요. 비밀번호 찾기를 다시 시도해주세요."));

        member.setPassword(passwordEncoder.encode(request.newPassword()));
    }

    private TokenResponse issueToken(Member member) {
        String token = jwtTokenProvider.createToken(member.getId(), member.getEmail(), member.getRole());
        return new TokenResponse(token, member.getId(), member.getEmail(), member.getName(), member.getRole().name());
    }
}
