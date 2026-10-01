package com.ridefit.ridefit.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.VehicleModel;
import com.ridefit.ridefit.dto.CrawlResultResponse;
import com.ridefit.ridefit.repository.ModelYearRepository;
import com.ridefit.ridefit.repository.VehicleModelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// 부품 판매 링크를 서버에서 대신 가져와(제목/가격/이미지) 파싱하는 서비스.
// 봇 차단이나 JS 렌더링으로 크롤링이 실패하는 것은 정상적인 상황으로 취급하고,
// 예외를 던지는 대신 success=false인 결과를 돌려줘서 프론트가 수동 입력 폼으로 전환하게 한다.
//
// 추출 우선순위: (공식 API가 필요한 판매처는 요청 자체를 하지 않음) → JSON-LD Product → Open Graph → 일반 meta.
// robots.txt가 막은 경로, 내부 네트워크 주소는 가져오지 않는다(SafeHttpFetcher). 로그인/CAPTCHA/봇 차단은
// 우회하지 않는다.
@Slf4j
@Service
@RequiredArgsConstructor
public class PartCrawlService {

    public static final String MANUAL_FALLBACK_MESSAGE =
            "상품 정보를 자동으로 가져오지 못했습니다. 상품명/가격/이미지를 직접 입력할 수 있습니다.";

    private static final int MAX_PAGE_BYTES = 3 * 1024 * 1024;
    private static final Pattern YEAR_PATTERN = Pattern.compile("\\b(19|20)\\d{2}\\b");
    private static final Pattern CHARSET_PATTERN = Pattern.compile("charset=([\\w-]+)", Pattern.CASE_INSENSITIVE);
    private static final List<String> CATEGORY_KEYWORDS = List.of(
            "머플러", "캐리어", "미러", "백미러", "브레이크", "레버", "그립", "스크린", "윈드스크린",
            "램프", "체인", "스프라킷", "타이어", "안장", "시트", "핸들", "풋페그");

    // 알려진 판매처. officialApiOnly=true인 곳은 상품 페이지 자동 수집을 약관/봇 차단으로 허용하지 않고
    // 공식(제휴) API로만 데이터를 제공하므로, 페이지를 직접 요청하지 않고 바로 수동 입력으로 안내한다.
    private record KnownSeller(String hostSuffix, String name, boolean officialApiOnly, String reason) {
    }

    private static final List<KnownSeller> KNOWN_SELLERS = List.of(
            new KnownSeller("coupang.com", "쿠팡", true,
                    "쿠팡 상품 정보는 쿠팡 파트너스 공식 API(승인·키 필요)로만 가져올 수 있어요. 지금은 연동돼 있지 않아서 직접 입력해주세요."),
            new KnownSeller("aliexpress.com", "알리익스프레스", true,
                    "알리익스프레스 상품 정보는 AliExpress 제휴(Affiliate) 공식 API(승인·키 필요)로만 가져올 수 있어요. 지금은 연동돼 있지 않아서 직접 입력해주세요."),
            new KnownSeller("aliexpress.us", "알리익스프레스", true,
                    "알리익스프레스 상품 정보는 AliExpress 제휴(Affiliate) 공식 API(승인·키 필요)로만 가져올 수 있어요. 지금은 연동돼 있지 않아서 직접 입력해주세요."),
            new KnownSeller("smartstore.naver.com", "네이버 스마트스토어", true,
                    "네이버 스마트스토어는 자동 수집을 제한하고 있어요. 상품명/가격/이미지를 직접 입력해주세요."),
            new KnownSeller("brand.naver.com", "네이버 브랜드스토어", true,
                    "네이버 브랜드스토어는 자동 수집을 제한하고 있어요. 상품명/가격/이미지를 직접 입력해주세요."),
            new KnownSeller("11st.co.kr", "11번가", false, null),
            new KnownSeller("gmarket.co.kr", "G마켓", false, null),
            new KnownSeller("auction.co.kr", "옥션", false, null),
            new KnownSeller("webike.net", "Webike", false, null));

    private final VehicleModelRepository vehicleModelRepository;
    private final ModelYearRepository modelYearRepository;
    private final SafeHttpFetcher safeHttpFetcher;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public CrawlResultResponse crawl(String url) {
        // 공식(제휴) API로만 제공되는 판매처는 주소 확인/요청 자체를 하지 않고 바로 수동 입력으로 안내한다.
        KnownSeller known = findKnownSeller(hostOf(url));
        if (known != null && known.officialApiOnly()) {
            return CrawlResultResponse.failure(known.reason(), known.name());
        }

        URI uri;
        try {
            uri = safeHttpFetcher.validatePublicUrl(url == null ? "" : url);
        } catch (SafeHttpFetcher.BlockedUrlException e) {
            return CrawlResultResponse.failure(e.getMessage() + " " + MANUAL_FALLBACK_MESSAGE, null);
        }

        if (!safeHttpFetcher.isAllowedByRobots(uri)) {
            return CrawlResultResponse.failure(
                    "이 판매처는 robots.txt로 자동 수집을 허용하지 않아요. " + MANUAL_FALLBACK_MESSAGE,
                    known == null ? null : known.name());
        }

        Document doc;
        String finalUrl;
        try {
            SafeHttpFetcher.FetchResult result = safeHttpFetcher.fetch(uri.toString(), MAX_PAGE_BYTES, Duration.ofSeconds(8));
            if (result.status() / 100 != 2) {
                return CrawlResultResponse.failure(
                        "링크를 불러오지 못했어요(응답 " + result.status() + "). 판매처가 자동 수집을 막고 있을 수 있어요. "
                                + MANUAL_FALLBACK_MESSAGE, known == null ? null : known.name());
            }
            finalUrl = result.finalUri().toString();
            doc = Jsoup.parse(new String(result.body(), charsetOf(result.contentType())), finalUrl);
        } catch (SafeHttpFetcher.BlockedUrlException e) {
            return CrawlResultResponse.failure(e.getMessage() + " " + MANUAL_FALLBACK_MESSAGE, null);
        } catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.info("상품 페이지 수집 실패: {} ({})", url, e.toString());
            return CrawlResultResponse.failure(
                    "링크를 불러오지 못했어요. 판매처가 자동 수집을 막고 있을 수 있어요. " + MANUAL_FALLBACK_MESSAGE,
                    known == null ? null : known.name());
        }

        JsonNode product = findJsonLdProduct(doc);
        String source = null;

        String title = product == null ? null : text(product, "name");
        if (title != null) source = "JSON-LD";
        if (title == null) {
            title = metaContent(doc, "meta[property=og:title]");
            if (title != null) source = "Open Graph";
        }
        if (title == null) {
            title = metaContent(doc, "meta[name=title]");
            if (title == null && doc.title() != null && !doc.title().isBlank()) title = doc.title().trim();
            if (title != null) source = "meta";
        }
        if (title == null) {
            return CrawlResultResponse.failure(MANUAL_FALLBACK_MESSAGE, known == null ? null : known.name());
        }

        String image = product == null ? null : jsonLdImage(product);
        if (image == null) image = metaContent(doc, "meta[property=og:image]");
        if (image == null) image = metaContent(doc, "meta[name=twitter:image]");
        if (image != null) image = resolve(finalUrl, image);

        Integer price = product == null ? null : jsonLdPrice(product);
        if (price == null) price = metaPrice(doc);

        String brand = product == null ? null : jsonLdBrand(product);
        String productId = product == null ? null : firstNonBlank(text(product, "sku"), text(product, "productID"));

        String sellerName = known != null ? known.name() : metaContent(doc, "meta[property=og:site_name]");
        if (sellerName == null) sellerName = uri.getHost().replaceFirst("^www\\.", "");

        String category = guessCategory(title);
        VehicleModelMatch match = matchVehicleModel(title);

        return new CrawlResultResponse(
                true, title, price, image, category,
                match == null ? null : match.vehicleModel().getId(),
                match == null ? null : match.vehicleModel().getName(),
                match == null ? null : (match.modelYear() == null ? null : match.modelYear().getId()),
                match == null ? null : (match.modelYear() == null ? null : match.modelYear().getYear()),
                null, sellerName, brand, productId, source, finalUrl);
    }

    private String hostOf(String url) {
        try {
            return url == null ? null : URI.create(url.trim()).getHost();
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private KnownSeller findKnownSeller(String host) {
        if (host == null) return null;
        String h = host.toLowerCase(Locale.ROOT);
        return KNOWN_SELLERS.stream()
                .filter(s -> h.equals(s.hostSuffix()) || h.endsWith("." + s.hostSuffix()))
                .findFirst().orElse(null);
    }

    private Charset charsetOf(String contentType) {
        Matcher m = CHARSET_PATTERN.matcher(contentType == null ? "" : contentType);
        if (m.find()) {
            try {
                return Charset.forName(m.group(1));
            } catch (Exception ignored) {
                // 알 수 없는 charset이면 UTF-8로 읽는다.
            }
        }
        return StandardCharsets.UTF_8;
    }

    // <script type="application/ld+json"> 안에서 @type=Product 노드를 찾는다(@graph/배열 포함).
    private JsonNode findJsonLdProduct(Document doc) {
        for (Element script : doc.select("script[type=application/ld+json]")) {
            try {
                JsonNode found = findProductNode(objectMapper.readTree(script.data()));
                if (found != null) return found;
            } catch (Exception ignored) {
                // 잘못된 JSON-LD는 건너뛴다.
            }
        }
        return null;
    }

    private JsonNode findProductNode(JsonNode node) {
        if (node == null) return null;
        if (node.isArray()) {
            for (JsonNode child : node) {
                JsonNode found = findProductNode(child);
                if (found != null) return found;
            }
            return null;
        }
        if (!node.isObject()) return null;
        JsonNode type = node.get("@type");
        if (type != null && (type.asText("").equalsIgnoreCase("Product")
                || (type.isArray() && type.toString().contains("\"Product\"")))) {
            return node;
        }
        return findProductNode(node.get("@graph"));
    }

    private String jsonLdImage(JsonNode product) {
        JsonNode image = product.get("image");
        if (image == null) return null;
        if (image.isTextual()) return blankToNull(image.asText());
        if (image.isArray() && !image.isEmpty()) {
            JsonNode first = image.get(0);
            return first.isTextual() ? blankToNull(first.asText()) : text(first, "url");
        }
        return text(image, "url");
    }

    // offers.price(또는 lowPrice)가 있고 통화가 KRW(또는 미표기)일 때만 원 단위 정수로 인정한다.
    private Integer jsonLdPrice(JsonNode product) {
        JsonNode offers = product.get("offers");
        if (offers == null) return null;
        if (offers.isArray()) offers = offers.isEmpty() ? null : offers.get(0);
        if (offers == null) return null;
        String currency = text(offers, "priceCurrency");
        if (currency != null && !currency.equalsIgnoreCase("KRW")) return null;
        String raw = firstNonBlank(text(offers, "price"), text(offers, "lowPrice"));
        return parsePrice(raw);
    }

    private String jsonLdBrand(JsonNode product) {
        JsonNode brand = product.get("brand");
        if (brand == null) return null;
        if (brand.isTextual()) return blankToNull(brand.asText());
        return text(brand, "name");
    }

    private Integer metaPrice(Document doc) {
        String currency = firstNonBlank(metaContent(doc, "meta[property=product:price:currency]"),
                metaContent(doc, "meta[property=og:price:currency]"));
        if (currency != null && !currency.equalsIgnoreCase("KRW")) return null;
        return parsePrice(firstNonBlank(metaContent(doc, "meta[property=product:price:amount]"),
                metaContent(doc, "meta[property=og:price:amount]")));
    }

    private Integer parsePrice(String raw) {
        if (raw == null) return null;
        try {
            double value = Double.parseDouble(raw.replaceAll("[^0-9.]", ""));
            return value > 0 && value < 100_000_000 ? (int) Math.round(value) : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String resolve(String base, String url) {
        try {
            return URI.create(base).resolve(url.trim()).toString();
        } catch (Exception e) {
            return url.trim();
        }
    }

    private String text(JsonNode node, String field) {
        if (node == null || !node.has(field)) return null;
        JsonNode v = node.get(field);
        return v.isValueNode() ? blankToNull(v.asText()) : null;
    }

    private String metaContent(Document doc, String cssQuery) {
        Element el = doc.selectFirst(cssQuery);
        return el == null ? null : blankToNull(el.attr("content"));
    }

    private String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private String firstNonBlank(String a, String b) {
        return a != null ? a : b;
    }

    private String guessCategory(String title) {
        String lower = title.toLowerCase(Locale.KOREAN);
        for (String keyword : CATEGORY_KEYWORDS) {
            if (lower.contains(keyword.toLowerCase(Locale.KOREAN))) {
                return keyword;
            }
        }
        return null;
    }

    private VehicleModelMatch matchVehicleModel(String title) {
        String lower = title.toLowerCase(Locale.KOREAN);
        List<VehicleModel> models = vehicleModelRepository.findAll();

        Optional<VehicleModel> matched = models.stream()
                .filter(vm -> lower.contains(vm.getName().toLowerCase(Locale.KOREAN)))
                .findFirst();

        if (matched.isEmpty()) return null;

        VehicleModel vehicleModel = matched.get();
        Matcher yearMatcher = YEAR_PATTERN.matcher(title);
        ModelYear matchedYear = null;
        if (yearMatcher.find()) {
            int year = Integer.parseInt(yearMatcher.group());
            matchedYear = modelYearRepository.findByVehicleModelId(vehicleModel.getId()).stream()
                    .filter(my -> my.getYear() != null && my.getYear() == year)
                    .findFirst()
                    .orElse(null);
        }

        return new VehicleModelMatch(vehicleModel, matchedYear);
    }

    private record VehicleModelMatch(VehicleModel vehicleModel, ModelYear modelYear) {
    }
}
