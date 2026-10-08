package com.ridefit.ridefit;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

// 실제 서블릿 컨테이너에서 권한 없는 요청의 상태 코드를 확인한다.
// MockMvc는 /error 재디스패치를 하지 않아서, 일반 회원의 관리자 API 요청이 실제 서버에서 401로 바뀌던 문제를 잡지 못했다
// (프론트엔드는 401을 "로그인 만료"로 보고 로그아웃시킨다).
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AccessDeniedStatusTest {

    @LocalServerPort
    int port;

    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void 일반_회원의_관리자_API_요청은_실제_서버에서도_403이고_비로그인은_401이다() throws Exception {
        HttpResponse<String> login = http.send(HttpRequest.newBuilder(uri("/api/auth/login"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"email\":\"user@ridefit.dev\",\"password\":\"user1234!\"}"))
                .build(), HttpResponse.BodyHandlers.ofString());
        assertThat(login.statusCode()).isEqualTo(200);
        Matcher m = Pattern.compile("\"token\"\\s*:\\s*\"([^\"]+)\"").matcher(login.body());
        assertThat(m.find()).isTrue();

        HttpResponse<String> asUser = http.send(HttpRequest.newBuilder(uri("/api/admin/members"))
                .header("Authorization", "Bearer " + m.group(1)).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertThat(asUser.statusCode()).isEqualTo(403);
        assertThat(asUser.body()).contains("접근 권한이 없습니다");

        HttpResponse<String> anonymous = http.send(HttpRequest.newBuilder(uri("/api/admin/members")).GET().build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(anonymous.statusCode()).isEqualTo(401);
    }

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }
}
