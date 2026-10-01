package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Member;

public record MemberSummaryResponse(Long id, String email, String name, String role) {

    // role 컬럼이 생기기 전에 만들어진 초기 회원(role NULL)이 있어도 관리자 회원 목록이 깨지지 않게 null을 그대로 내려준다.
    public static MemberSummaryResponse from(Member member) {
        return new MemberSummaryResponse(member.getId(), member.getEmail(), member.getName(),
                member.getRole() == null ? null : member.getRole().name());
    }
}
