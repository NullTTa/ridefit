package com.ridefit.ridefit.security;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

// 컨트롤러에서 "JWT로 인증된 현재 사용자"를 꺼내오기 위한 헬퍼.
// 클라이언트가 보낸 memberId를 그대로 믿지 않고, 항상 이 값을 사용해야 IDOR을 막을 수 있다.
@Component
public class CurrentMember {

    public Long id() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof CustomUserDetails userDetails) {
            return userDetails.getMemberId();
        }
        throw new IllegalStateException("인증된 사용자 정보를 확인할 수 없습니다.");
    }
}
