package com.ridefit.ridefit.service;

import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.SellerListing;
import com.ridefit.ridefit.dto.SellerListingResponse;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.SellerListingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

// 판매처 가격비교. "최저가"는 가격이 확인된 실제 판매처가 2곳 이상일 때만 붙인다
// (1곳뿐이면 비교가 아니고, 예시 판매처(.test)와 가격 미확인은 비교 대상이 아니다).
@Service
@RequiredArgsConstructor
public class SellerListingService {

    private final SellerListingRepository sellerListingRepository;
    private final PartRepository partRepository;
    private final ImageStorageService imageStorageService;

    @Transactional(readOnly = true)
    public List<SellerListingResponse> list(Long partId) {
        List<SellerListing> listings = sellerListingRepository.findByPartIdOrderByPriceAsc(partId);
        Set<Long> lowestIds = lowestIds(listings);
        // 가격 확인된 판매처(가격 오름차순) → 가격 미확인 → 예시 데이터 순으로 보여준다.
        return listings.stream()
                .sorted(Comparator.comparing(SellerListing::isSample)
                        .thenComparing(l -> l.getPrice() == null)
                        .thenComparing(l -> l.getPrice() == null ? Integer.MAX_VALUE : l.getPrice()))
                .map(l -> SellerListingResponse.from(l, lowestIds.contains(l.getId())))
                .toList();
    }

    // 부품 카드용 판매처 가격 요약(여러 부품을 한 번에). 실제 판매처만(예시 .test 제외), 가격 확인된 것 먼저 가격 오름차순,
    // 최대 maxSellers곳 + 나머지 개수. lowestPrice는 상세와 같은 규칙(가격 확인된 실제 판매처 2곳 이상)일 때만 채운다.
    // 등록/확인된 가격이며 실시간 조회 값이 아니다(checkedAt = 마지막 확인 시각).
    public Map<Long, ListingSummary> summaries(Collection<Long> partIds, int maxSellers) {
        Map<Long, ListingSummary> result = new LinkedHashMap<>();
        for (Long partId : partIds) {
            List<SellerListing> real = sellerListingRepository.findByPartIdOrderByPriceAsc(partId).stream()
                    .filter(l -> !l.isSample())
                    .sorted(Comparator.comparing((SellerListing l) -> l.getPrice() == null)
                            .thenComparing(l -> l.getPrice() == null ? Integer.MAX_VALUE : l.getPrice()))
                    .toList();
            List<SellerListing> priced = real.stream().filter(l -> l.getPrice() != null).toList();
            Integer lowest = priced.size() >= 2 ? priced.get(0).getPrice() : null;
            LocalDateTime latestChecked = real.stream().map(SellerListing::getCheckedAt).filter(java.util.Objects::nonNull)
                    .max(Comparator.naturalOrder()).orElse(null);
            List<ListingSummary.Seller> top = real.stream().limit(maxSellers)
                    .map(l -> new ListingSummary.Seller(l.getSellerName(), l.getPrice(), productUrl(l.getSourceUrl()), l.getCheckedAt()))
                    .toList();
            result.put(partId, new ListingSummary(partId, real.size(), priced.size(), lowest, latestChecked, top,
                    Math.max(0, real.size() - top.size())));
        }
        return result;
    }

    // 실제로 열 수 있는 http/https 주소만 링크로 돌려준다(없거나 형식이 다르면 null - 주소를 만들지 않는다).
    private static String productUrl(String sourceUrl) {
        if (sourceUrl == null || sourceUrl.isBlank()) return null;
        try {
            java.net.URI u = java.net.URI.create(sourceUrl.trim());
            return ("http".equalsIgnoreCase(u.getScheme()) || "https".equalsIgnoreCase(u.getScheme())) && u.getHost() != null
                    ? u.toString() : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public record ListingSummary(Long partId, int sellerCount, int pricedCount, Integer lowestPrice,
                                 LocalDateTime latestCheckedAt, List<Seller> sellers, int moreSellers) {
        public record Seller(String sellerName, Integer price, String productUrl, LocalDateTime checkedAt) {
        }
    }

    private Set<Long> lowestIds(List<SellerListing> listings) {
        List<SellerListing> comparable = listings.stream()
                .filter(l -> !l.isSample() && l.getPrice() != null)
                .toList();
        if (comparable.size() < 2) return Set.of();
        int min = comparable.stream().mapToInt(SellerListing::getPrice).min().orElseThrow();
        return comparable.stream().filter(l -> l.getPrice() == min).map(SellerListing::getId).collect(Collectors.toSet());
    }

    // 판매처 등록. 원본 이미지 URL이 있으면 우리 서버에 저장을 시도하고, 실패하면 원본 URL만 출처로 남긴다.
    // 부품에 대표 이미지가 아직 없으면(기존 동작 유지) 이 판매처 이미지로 채운다 - 단, 내부 저장에 성공한 경우만.
    @Transactional
    public SellerListingResponse add(Part part, String sellerName, Integer price, String originalImageUrl,
                                     String sourceUrl, String productName, String externalProductId) {
        String storedImage = imageStorageService.storeFromUrl(originalImageUrl, "parts").orElse(null);
        return add(part, sellerName, price, originalImageUrl, storedImage, sourceUrl, productName, externalProductId);
    }

    // 같은 원본 이미지를 이미 내부에 저장한 경우(관리자 상품 등록) 다시 내려받지 않도록 저장 경로를 그대로 받는다.
    @Transactional
    public SellerListingResponse add(Part part, String sellerName, Integer price, String originalImageUrl,
                                     String storedImage, String sourceUrl, String productName, String externalProductId) {
        LocalDateTime now = LocalDateTime.now();

        SellerListing saved = sellerListingRepository.save(SellerListing.builder()
                .part(part)
                .sellerName(sellerName.trim())
                .productName(blankToNull(productName))
                .price(price)
                .thumbnailUrl(storedImage)
                .originalImageUrl(blankToNull(originalImageUrl))
                .sourceUrl(sourceUrl.trim())
                .externalProductId(blankToNull(externalProductId))
                .createdAt(now)
                .checkedAt(now)
                .build());

        if (part.getImageUrl() == null && storedImage != null) {
            part.setImageUrl(storedImage);
            part.setImageSourceUrl(blankToNull(originalImageUrl));
            partRepository.save(part);
        }

        boolean lowest = lowestIds(sellerListingRepository.findByPartIdOrderByPriceAsc(part.getId()))
                .contains(saved.getId());
        return SellerListingResponse.from(saved, lowest);
    }

    private String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
