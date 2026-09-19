package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.Member;
import com.ridefit.ridefit.dto.MemberSummaryResponse;
import com.ridefit.ridefit.dto.RecentPartCheckResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.RecentPartCheckRepository;
import com.ridefit.ridefit.security.CurrentMember;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class MeController {

    private final MemberRepository memberRepository;
    private final RecentPartCheckRepository recentPartCheckRepository;
    private final CurrentMember currentMember;

    @GetMapping("/api/me")
    public MemberSummaryResponse getMe() {
        Member member = memberRepository.findById(currentMember.id())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "회원 정보를 찾을 수 없습니다."));
        return MemberSummaryResponse.from(member);
    }

    @GetMapping("/api/me/recent-checks")
    public List<RecentPartCheckResponse> getRecentChecks() {
        return recentPartCheckRepository
                .findByMemberIdOrderByCheckedAtDesc(currentMember.id(), PageRequest.of(0, 10)).stream()
                .map(RecentPartCheckResponse::from)
                .toList();
    }
}
