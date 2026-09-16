package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.Member;
import com.ridefit.ridefit.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class MemberController {

    private final MemberRepository memberRepository;

    @PostMapping("/api/members")
    public ResponseEntity<Member> createMember(@RequestBody MemberRequest request) {
        Member member = Member.builder()
                .email(request.email())
                .name(request.name())
                .build();
        Member saved = memberRepository.save(member);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    public record MemberRequest(String email, String name) {
    }
}
