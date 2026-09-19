package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.SellerListing;
import com.ridefit.ridefit.dto.CreateSellerListingRequest;
import com.ridefit.ridefit.dto.SellerListingResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.SellerListingRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

// 하나의 부품에 등록된 "사용자가 직접 등록한" 판매처 링크들끼리 가격을 비교한다.
// 실시간으로 쿠팡/네이버쇼핑 등을 자동 검색하는 기능이 아니다.
@RestController
@RequestMapping("/api/parts/{partId}/listings")
@RequiredArgsConstructor
public class SellerListingController {

    private final SellerListingRepository sellerListingRepository;
    private final PartRepository partRepository;

    @GetMapping
    public List<SellerListingResponse> list(@PathVariable Long partId) {
        List<SellerListing> listings = sellerListingRepository.findByPartIdOrderByPriceAsc(partId);
        Integer lowest = listings.stream().map(SellerListing::getPrice).min(Integer::compareTo).orElse(null);
        return listings.stream()
                .map(l -> SellerListingResponse.from(l, lowest != null && l.getPrice().equals(lowest)))
                .toList();
    }

    @PostMapping
    public ResponseEntity<SellerListingResponse> add(
            @PathVariable Long partId, @Valid @RequestBody CreateSellerListingRequest request) {
        Part part = partRepository.findById(partId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "부품을 찾을 수 없습니다."));

        SellerListing listing = SellerListing.builder()
                .part(part)
                .sellerName(request.sellerName())
                .price(request.price())
                .thumbnailUrl(request.thumbnailUrl())
                .sourceUrl(request.sourceUrl())
                .createdAt(LocalDateTime.now())
                .build();
        SellerListing saved = sellerListingRepository.save(listing);

        List<SellerListing> all = sellerListingRepository.findByPartIdOrderByPriceAsc(partId);
        boolean lowest = all.get(0).getId().equals(saved.getId());

        return ResponseEntity.status(HttpStatus.CREATED).body(SellerListingResponse.from(saved, lowest));
    }
}
