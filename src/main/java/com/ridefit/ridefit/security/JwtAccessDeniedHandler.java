package com.ridefit.ridefit.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;

// 로그인은 했지만 권한이 없는 요청(예: 일반 회원의 /api/admin/**)에는 JSON 403을 바로 내려준다.
// 기본 처리(sendError)는 /error로 다시 디스패치되는데, 그 요청은 JWT 필터를 거치지 않아 익명으로 취급되고
// 401로 바뀌어 버린다 -> 프론트엔드가 "로그인 만료"로 오해해 로그아웃시키므로 여기서 직접 응답한다.
@Component
public class JwtAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(), Map.of("message", "접근 권한이 없습니다."));
    }
}
