package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Member;

public record MemberSummaryResponse(Long id, String email, String name, String role) {

    public static MemberSummaryResponse from(Member member) {
        return new MemberSummaryResponse(member.getId(), member.getEmail(), member.getName(), member.getRole().name());
    }
}
