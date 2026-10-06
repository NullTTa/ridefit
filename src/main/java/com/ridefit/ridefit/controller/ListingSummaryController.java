package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.service.SellerListingService;
import com.ridefit.ridefit.service.SellerListingService.ListingSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collection;
import java.util.List;

// 부품 카드의 "판매처 가격 미리보기"용 일괄 조회. 카드마다 /api/parts/{id}/listings 를 부르지 않도록 여러 부품을 한 번에 요약한다.
// 등록된 판매처의 등록/확인 가격이다(실시간 조회 아님). 부품당 최대 3곳 + 나머지 개수.
@RestController
@RequiredArgsConstructor
public class ListingSummaryController {

    private static final int MAX_PART_IDS = 200;
    private static final int MAX_SELLERS = 3;

    private final SellerListingService sellerListingService;

    @GetMapping("/api/parts/listings-summary")
    public Collection<ListingSummary> summaries(@RequestParam List<Long> partIds) {
        List<Long> ids = partIds.stream().distinct().limit(MAX_PART_IDS).toList();
        return sellerListingService.summaries(ids, MAX_SELLERS).values();
    }
}
