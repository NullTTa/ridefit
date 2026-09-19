package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.dto.CompatibilityCheckResponse;
import com.ridefit.ridefit.dto.CrawlResultResponse;
import com.ridefit.ridefit.dto.CreatePartRequest;
import com.ridefit.ridefit.dto.PartResponse;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.security.CurrentMember;
import com.ridefit.ridefit.service.CompatibilityCheckService;
import com.ridefit.ridefit.service.PartCrawlService;
import com.ridefit.ridefit.service.PartService;
import com.ridefit.ridefit.service.RateLimitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class PartController {

    private final PartRepository partRepository;
    private final PartCrawlService partCrawlService;
    private final PartService partService;
    private final CompatibilityCheckService compatibilityCheckService;
    private final RateLimitService rateLimitService;
    private final CurrentMember currentMember;

    @GetMapping("/api/parts")
    public List<PartResponse> getParts(@RequestParam(required = false) String category) {
        List<com.ridefit.ridefit.domain.Part> parts = category != null
                ? partRepository.findByCategory(category)
                : partRepository.findAll();
        return parts.stream().map(PartResponse::from).toList();
    }

    // 링크를 붙여넣으면 서버가 대신 크롤링해서 제목/가격/카테고리/모델 자동인식을 시도한다.
    @PostMapping("/api/parts/import")
    public ResponseEntity<CrawlResultResponse> importFromLink(@RequestBody ImportRequest request) {
        rateLimitService.checkAndIncrement(currentMember.id());
        return ResponseEntity.ok(partCrawlService.crawl(request.url()));
    }

    // 크롤링 결과(자동/수동 확인 모두)를 최종 확정해서 부품 + 호환 레코드를 생성한다.
    @PostMapping("/api/parts")
    public ResponseEntity<PartResponse> createPart(@Valid @RequestBody CreatePartRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(partService.createPart(request));
    }

    // 차량을 선택하는 즉시 호출되는 라이브 호환성 체크.
    @GetMapping("/api/parts/{partId}/check")
    public ResponseEntity<CompatibilityCheckResponse> checkCompatibility(
            @PathVariable Long partId, @RequestParam Long myVehicleId) {
        return ResponseEntity.ok(compatibilityCheckService.check(partId, myVehicleId, currentMember.id()));
    }

    public record ImportRequest(String url) {
    }
}
