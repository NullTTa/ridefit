package com.ridefit.ridefit.dto.auth;

public record TokenResponse(String token, Long memberId, String email, String name, String role) {
}
