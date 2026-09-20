package com.ridefit.ridefit.security;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

// 컨트롤러에서 "JWT로 인증된 현재 사용자"를 꺼내오기 위한 헬퍼.
// 클라이언트가 보낸 memberId를 그대로 믿지 않고, 항상 이 값을 사용해야 IDOR을 막을 수 있다.
@Component
public class CurrentMember {

    public Long id() {
        Long id = idOrNull();
        if (id == null) {
            throw new IllegalStateException("인증된 사용자 정보를 확인할 수 없습니다.");
        }
        return id;
    }

    // 로그인하지 않아도 볼 수 있는 API에서 "로그인했다면 개인화" 용도로 쓴다(예: 내가 추천했는지 여부).
    public Long idOrNull() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof CustomUserDetails userDetails) {
            return userDetails.getMemberId();
        }
        return null;
    }
}
