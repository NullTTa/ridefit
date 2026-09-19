package com.ridefit.ridefit.service;

import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.VehicleModel;
import com.ridefit.ridefit.dto.CrawlResultResponse;
import com.ridefit.ridefit.repository.ModelYearRepository;
import com.ridefit.ridefit.repository.VehicleModelRepository;
import lombok.RequiredArgsConstructor;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// 부품 판매 링크를 서버에서 대신 가져와(제목/가격/이미지) 파싱하는 서비스.
// 봇 차단이나 JS 렌더링으로 크롤링이 실패하는 것은 정상적인 상황으로 취급하고,
// 예외를 던지는 대신 success=false인 결과를 돌려줘서 프론트가 수동 입력 폼으로 전환하게 한다.
@Service
@RequiredArgsConstructor
public class PartCrawlService {

    private static final Pattern PRICE_PATTERN = Pattern.compile("(\\d{1,3}(?:,\\d{3})+)\\s*원");
    private static final Pattern YEAR_PATTERN = Pattern.compile("\\b(19|20)\\d{2}\\b");
    private static final List<String> CATEGORY_KEYWORDS = List.of(
            "머플러", "캐리어", "미러", "백미러", "브레이크", "레버", "그립", "스크린", "윈드스크린",
            "램프", "체인", "스프라킷", "타이어", "안장", "시트", "핸들", "풋페그");

    private final VehicleModelRepository vehicleModelRepository;
    private final ModelYearRepository modelYearRepository;

    public CrawlResultResponse crawl(String url) {
        Document doc;
        try {
            doc = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) RidefitBot/1.0")
                    .timeout(6000)
                    .followRedirects(true)
                    .get();
        } catch (Exception e) {
            return new CrawlResultResponse(false, null, null, null, null, null, null, null, null,
                    "링크를 불러오지 못했어요. 판매처가 자동 수집을 막고 있을 수 있어요.");
        }

        String title = extractTitle(doc);
        if (title == null || title.isBlank()) {
            return new CrawlResultResponse(false, null, null, null, null, null, null, null, null,
                    "상품 정보를 읽어오지 못했어요. 아래에 직접 입력해주세요.");
        }

        Integer price = extractPrice(doc);
        String image = extractImage(doc);
        String category = guessCategory(title);
        VehicleModelMatch match = matchVehicleModel(title);

        return new CrawlResultResponse(
                true, title, price, image, category,
                match == null ? null : match.vehicleModel().getId(),
                match == null ? null : match.vehicleModel().getName(),
                match == null ? null : (match.modelYear() == null ? null : match.modelYear().getId()),
                match == null ? null : (match.modelYear() == null ? null : match.modelYear().getYear()),
                null);
    }

    private String extractTitle(Document doc) {
        String ogTitle = metaContent(doc, "meta[property=og:title]");
        if (ogTitle != null && !ogTitle.isBlank()) return ogTitle.trim();
        String docTitle = doc.title();
        return docTitle == null ? null : docTitle.trim();
    }

    private Integer extractPrice(Document doc) {
        String ogPrice = metaContent(doc, "meta[property=product:price:amount]");
        if (ogPrice == null) ogPrice = metaContent(doc, "meta[property=og:price:amount]");
        if (ogPrice != null) {
            try {
                return (int) Double.parseDouble(ogPrice.replaceAll("[^0-9.]", ""));
            } catch (NumberFormatException ignored) {
                // 폴백으로 본문 텍스트 스캔을 시도한다.
            }
        }

        String bodyText = doc.text();
        Matcher matcher = PRICE_PATTERN.matcher(bodyText);
        if (matcher.find()) {
            try {
                return Integer.parseInt(matcher.group(1).replace(",", ""));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private String extractImage(Document doc) {
        String ogImage = metaContent(doc, "meta[property=og:image]");
        return (ogImage == null || ogImage.isBlank()) ? null : ogImage.trim();
    }

    private String metaContent(Document doc, String cssQuery) {
        Element el = doc.selectFirst(cssQuery);
        return el == null ? null : el.attr("content");
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
