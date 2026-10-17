package com.ridefit.ridefit.service;

import com.ridefit.ridefit.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// 로그인 비밀번호 대입(무차별 대입) 방지. 실패만 센다 - 성공한 로그인은 횟수에 들어가지 않는다.
//  - 같은 이메일로 15분 안에 5번 틀리면 그 이메일은 15분 동안 로그인 시도를 막는다(429).
//  - 같은 접속 주소(IP)에서 15분 안에 30번 틀리면 그 주소를 막는다(여러 계정을 돌아가며 시도하는 경우).
// 서버 메모리에만 두므로 서버를 다시 시작하면 초기화된다(서버 1대 기준. 여러 대로 늘리면 Redis 등 공유 저장소가 필요).
@Service
public class LoginAttemptService {

    static final int MAX_FAILURES_PER_EMAIL = 5;
    static final int MAX_FAILURES_PER_IP = 30;
    static final Duration WINDOW = Duration.ofMinutes(15);

    private final Map<String, Window> byEmail = new ConcurrentHashMap<>();
    private final Map<String, Window> byIp = new ConcurrentHashMap<>();

    private record Window(Instant startedAt, int failures) {
        boolean expired(Instant now) {
            return startedAt.plus(WINDOW).isBefore(now);
        }
    }

    public void checkAllowed(String email, String ip) {
        Instant now = Instant.now();
        if (blocked(byEmail, emailKey(email), MAX_FAILURES_PER_EMAIL, now) || blocked(byIp, ip, MAX_FAILURES_PER_IP, now)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                    "로그인 시도가 너무 많아요. 15분 뒤에 다시 시도해주세요.");
        }
    }

    public void recordFailure(String email, String ip) {
        Instant now = Instant.now();
        increment(byEmail, emailKey(email), now);
        increment(byIp, ip, now);
    }

    public void recordSuccess(String email) {
        byEmail.remove(emailKey(email));
    }

    private static boolean blocked(Map<String, Window> map, String key, int max, Instant now) {
        if (key == null) return false;
        Window w = map.get(key);
        if (w == null) return false;
        if (w.expired(now)) {
            map.remove(key, w);
            return false;
        }
        return w.failures() >= max;
    }

    private static void increment(Map<String, Window> map, String key, Instant now) {
        if (key == null) return;
        map.compute(key, (k, w) -> w == null || w.expired(now) ? new Window(now, 1) : new Window(w.startedAt(), w.failures() + 1));
    }

    private static String emailKey(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
