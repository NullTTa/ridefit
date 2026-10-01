package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.dto.CreateSellerListingRequest;
import com.ridefit.ridefit.dto.SellerListingResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.service.SellerListingService;
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

import java.util.List;

// 하나의 부품에 등록된 판매처 링크들끼리 가격을 비교한다.
// 실시간으로 쿠팡/네이버쇼핑 등을 자동 검색하는 기능이 아니다.
@RestController
@RequestMapping("/api/parts/{partId}/listings")
@RequiredArgsConstructor
public class SellerListingController {

    private final SellerListingService sellerListingService;
    private final PartRepository partRepository;

    @GetMapping
    public List<SellerListingResponse> list(@PathVariable Long partId) {
        return sellerListingService.list(partId);
    }

    @PostMapping
    public ResponseEntity<SellerListingResponse> add(
            @PathVariable Long partId, @Valid @RequestBody CreateSellerListingRequest request) {
        Part part = partRepository.findById(partId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "부품을 찾을 수 없습니다."));
        SellerListingResponse saved = sellerListingService.add(part, request.sellerName(), request.price(),
                request.thumbnailUrl(), request.sourceUrl(), request.productName(), request.externalProductId());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
}
