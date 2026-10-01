package com.ridefit.ridefit.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// 사용자가 넣은 외부 URL(상품 페이지/상품 이미지)을 서버가 대신 가져올 때 쓰는 공통 HTTP 도우미.
//  - SSRF 방지: http/https만, 그리고 루프백/사설망/링크로컬 주소로 해석되는 호스트는 거부한다.
//    리다이렉트도 자동으로 따라가지 않고 매 단계 목적지를 다시 검증한다.
//  - robots.txt 존중: User-agent * 그룹의 Disallow 경로면 가져오지 않는다(우회하지 않는다).
//  - 한 번에 한 URL만 요청하고, 응답 크기/시간을 제한한다(과도한 요청 금지).
@Slf4j
@Component
public class SafeHttpFetcher {

    public static final String USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RidefitBot/1.0";
    private static final int MAX_REDIRECTS = 3;
    private static final Duration ROBOTS_TTL = Duration.ofHours(1);

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(6))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    private final Map<String, CachedRobots> robotsCache = new ConcurrentHashMap<>();

    public record FetchResult(URI finalUri, int status, String contentType, byte[] body) {
    }

    public static class BlockedUrlException extends IOException {
        public BlockedUrlException(String message) {
            super(message);
        }
    }

    // 공개 인터넷 주소인지 검증. 통과하지 못하면 BlockedUrlException.
    public URI validatePublicUrl(String rawUrl) throws BlockedUrlException {
        URI uri;
        try {
            uri = URI.create(rawUrl.trim());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new BlockedUrlException("올바른 URL 형식이 아니에요.");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) {
            throw new BlockedUrlException("http 또는 https 주소만 사용할 수 있어요.");
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new BlockedUrlException("URL에서 호스트를 확인할 수 없어요.");
        }
        try {
            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (address.isLoopbackAddress() || address.isSiteLocalAddress() || address.isLinkLocalAddress()
                        || address.isAnyLocalAddress() || address.isMulticastAddress() || isUniqueLocalV6(address)) {
                    throw new BlockedUrlException("내부 네트워크 주소는 가져올 수 없어요.");
                }
            }
        } catch (UnknownHostException e) {
            throw new BlockedUrlException("존재하지 않는 호스트예요.");
        }
        return uri;
    }

    private boolean isUniqueLocalV6(InetAddress address) {
        byte[] bytes = address.getAddress();
        return bytes.length == 16 && (bytes[0] & 0xFE) == 0xFC;
    }

    public boolean isAllowedByRobots(URI uri) {
        String origin = uri.getScheme() + "://" + uri.getRawAuthority();
        CachedRobots cached = robotsCache.get(origin);
        if (cached == null || cached.fetchedAt().plus(ROBOTS_TTL).isBefore(Instant.now())) {
            cached = new CachedRobots(loadDisallowRules(origin), Instant.now());
            robotsCache.put(origin, cached);
        }
        String path = uri.getRawPath() == null || uri.getRawPath().isEmpty() ? "/" : uri.getRawPath();
        if (uri.getRawQuery() != null) path = path + "?" + uri.getRawQuery();
        for (String rule : cached.disallow()) {
            if (!rule.isEmpty() && path.startsWith(rule)) return false;
        }
        return true;
    }

    // robots.txt를 가져오지 못하면(404 등) 제한 없음으로 본다 - 일반적인 크롤러 관례.
    private List<String> loadDisallowRules(String origin) {
        List<String> rules = new ArrayList<>();
        try {
            FetchResult result = fetch(origin + "/robots.txt", 256 * 1024, Duration.ofSeconds(5));
            if (result.status() / 100 != 2) return rules;
            boolean inStarGroup = false;
            boolean lastWasAgent = false;
            for (String rawLine : new String(result.body(), StandardCharsets.UTF_8).split("\\r?\\n")) {
                String line = rawLine.replaceAll("#.*$", "").trim();
                if (line.isEmpty()) continue;
                int idx = line.indexOf(':');
                if (idx < 0) continue;
                String key = line.substring(0, idx).trim().toLowerCase(Locale.ROOT);
                String value = line.substring(idx + 1).trim();
                if (key.equals("user-agent")) {
                    boolean star = value.equals("*") || value.toLowerCase(Locale.ROOT).contains("ridefitbot");
                    inStarGroup = lastWasAgent ? (inStarGroup || star) : star;
                    lastWasAgent = true;
                } else {
                    lastWasAgent = false;
                    if (inStarGroup && key.equals("disallow")) rules.add(value);
                }
            }
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.debug("robots.txt 확인 실패({}): {}", origin, e.toString());
        }
        return rules;
    }

    // 리다이렉트를 매 단계 검증하면서 따라간다. body는 maxBytes까지만 읽고, 넘으면 IOException.
    public FetchResult fetch(String rawUrl, int maxBytes, Duration timeout) throws IOException, InterruptedException {
        URI current = validatePublicUrl(rawUrl);
        for (int i = 0; i <= MAX_REDIRECTS; i++) {
            HttpRequest request = HttpRequest.newBuilder(current)
                    .timeout(timeout)
                    .header("User-Agent", USER_AGENT)
                    .header("Accept-Language", "ko-KR,ko;q=0.9,en;q=0.8")
                    .GET()
                    .build();
            HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
            int status = response.statusCode();
            if (status / 100 == 3) {
                response.body().close();
                String location = response.headers().firstValue("Location").orElse(null);
                if (location == null) throw new IOException("리다이렉트 위치가 없습니다.");
                current = validatePublicUrl(current.resolve(location).toString());
                continue;
            }
            byte[] body = readLimited(response.body(), maxBytes);
            String contentType = response.headers().firstValue("Content-Type").orElse("");
            return new FetchResult(current, status, contentType, body);
        }
        throw new IOException("리다이렉트가 너무 많습니다.");
    }

    private byte[] readLimited(InputStream in, int maxBytes) throws IOException {
        try (in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int total = 0;
            int read;
            while ((read = in.read(buffer)) != -1) {
                total += read;
                if (total > maxBytes) throw new IOException("응답이 너무 큽니다.");
                out.write(buffer, 0, read);
            }
            return out.toByteArray();
        }
    }

    private record CachedRobots(List<String> disallow, Instant fetchedAt) {
    }
}
