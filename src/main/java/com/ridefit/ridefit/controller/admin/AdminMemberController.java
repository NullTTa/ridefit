package com.ridefit.ridefit.controller.admin;

import com.ridefit.ridefit.dto.MemberSummaryResponse;
import com.ridefit.ridefit.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// 회원 목록/role 조회 전용. role 변경은 앱에서 하지 않고 DB에서 직접 바꾸는 정책이라 여기엔 수정 API가 없다.
@RestController
@RequestMapping("/api/admin/members")
@RequiredArgsConstructor
public class AdminMemberController {

    private final MemberRepository memberRepository;

    @GetMapping
    public Page<MemberSummaryResponse> list(@PageableDefault(size = 20) Pageable pageable) {
        return memberRepository.findAll(pageable).map(MemberSummaryResponse::from);
    }
}
