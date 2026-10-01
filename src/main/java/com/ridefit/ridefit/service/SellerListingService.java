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
import java.util.Comparator;
import java.util.List;
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
