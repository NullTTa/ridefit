package com.ridefit.ridefit.security;

import com.ridefit.ridefit.domain.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

@Component
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration-ms:86400000}")
    private long expirationMs;

    private SecretKey key;

    @PostConstruct
    void init() {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    public String createToken(Long memberId, String email, Role role) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(String.valueOf(memberId))
                .claim("email", email)
                .claim("role", role.name())
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key)
                .compact();
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean isValid(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public Long getMemberId(String token) {
        return Long.valueOf(parseClaims(token).getSubject());
    }

    private static final String PASSWORD_RESET_PURPOSE = "password_reset";
    private static final long PASSWORD_RESET_EXPIRATION_MS = 10 * 60 * 1000; // 10분

    // 로그인 토큰과 구분되도록 purpose 클레임을 넣는다 — 이 토큰으로는 로그인 API를 통과할 수 없다.
    public String createPasswordResetToken(Long memberId) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + PASSWORD_RESET_EXPIRATION_MS);

        return Jwts.builder()
                .subject(String.valueOf(memberId))
                .claim("purpose", PASSWORD_RESET_PURPOSE)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key)
                .compact();
    }

    public boolean isPasswordResetToken(String token) {
        try {
            return PASSWORD_RESET_PURPOSE.equals(parseClaims(token).get("purpose", String.class));
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}
