package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.Member;
import com.ridefit.ridefit.dto.ChangePasswordRequest;
import com.ridefit.ridefit.dto.MemberSummaryResponse;
import com.ridefit.ridefit.dto.RecentPartCheckResponse;
import com.ridefit.ridefit.dto.UpdateNicknameRequest;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.RecentPartCheckRepository;
import com.ridefit.ridefit.security.CurrentMember;
import com.ridefit.ridefit.service.MemberAccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class MeController {

    private final MemberRepository memberRepository;
    private final RecentPartCheckRepository recentPartCheckRepository;
    private final MemberAccountService memberAccountService;
    private final CurrentMember currentMember;

    @GetMapping("/api/me")
    public MemberSummaryResponse getMe() {
        Member member = memberRepository.findById(currentMember.id())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "회원 정보를 찾을 수 없습니다."));
        return MemberSummaryResponse.from(member);
    }

    @PatchMapping("/api/me")
    public MemberSummaryResponse updateNickname(@Valid @RequestBody UpdateNicknameRequest request) {
        return memberAccountService.updateNickname(currentMember.id(), request);
    }

    @PatchMapping("/api/me/password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        memberAccountService.changePassword(currentMember.id(), request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/me")
    public ResponseEntity<Void> withdraw() {
        memberAccountService.withdraw(currentMember.id());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/me/recent-checks")
    public List<RecentPartCheckResponse> getRecentChecks() {
        return recentPartCheckRepository
                .findByMemberIdOrderByCheckedAtDesc(currentMember.id(), PageRequest.of(0, 10)).stream()
                .map(RecentPartCheckResponse::from)
                .toList();
    }
}
