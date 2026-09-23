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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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

    // 같은 부품을 여러 번 확인하면 로그가 그만큼 쌓이는데(로그 자체는 지우지 않음), 화면엔 부품당
    // 가장 최근 기록 1건만 보여준다 - 최근 순으로 넉넉히 가져온 뒤 partId 기준으로 처음 나온 것만
    // 남기면(LinkedHashMap이 순서를 보존) 자연히 "가장 최근 것"이 남는다.
    @GetMapping("/api/me/recent-checks")
    public List<RecentPartCheckResponse> getRecentChecks() {
        List<RecentPartCheckResponse> recent = recentPartCheckRepository
                .findByMemberIdOrderByCheckedAtDesc(currentMember.id(), PageRequest.of(0, 30)).stream()
                .map(RecentPartCheckResponse::from)
                .toList();

        Map<Long, RecentPartCheckResponse> latestByPart = new LinkedHashMap<>();
        for (RecentPartCheckResponse check : recent) {
            latestByPart.putIfAbsent(check.partId(), check);
        }
        return latestByPart.values().stream().limit(10).toList();
    }
}
