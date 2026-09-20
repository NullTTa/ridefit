package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.dto.CompatibilityCheckResponse;
import com.ridefit.ridefit.dto.CrawlResultResponse;
import com.ridefit.ridefit.dto.CreatePartRequest;
import com.ridefit.ridefit.dto.PartDetailResponse;
import com.ridefit.ridefit.dto.PartPopularityStats;
import com.ridefit.ridefit.dto.PartResponse;
import com.ridefit.ridefit.dto.PartReviewResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.PostRepository;
import com.ridefit.ridefit.security.CurrentMember;
import com.ridefit.ridefit.service.CompatibilityCheckService;
import com.ridefit.ridefit.service.PartCrawlService;
import com.ridefit.ridefit.service.PartPopularityService;
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
    private final PartPopularityService partPopularityService;
    private final CompatibilityRepository compatibilityRepository;
    private final MyVehicleRepository myVehicleRepository;
    private final PostRepository postRepository;

    @GetMapping("/api/parts")
    public List<PartResponse> getParts(@RequestParam(required = false) String category) {
        List<Part> parts = category != null
                ? partRepository.findByCategory(category)
                : partRepository.findAll();
        return parts.stream().map(PartResponse::from).toList();
    }

    // 홈 화면 "인기 부품". 신호(조회/장착해보기)가 하나도 없으면 빈 목록을 돌려주고, 임의로 채우지 않는다.
    @GetMapping("/api/parts/popular")
    public List<PopularPartResponse> getPopularParts(@RequestParam(defaultValue = "6") int limit) {
        int size = Math.max(1, Math.min(20, limit));
        return partRepository.findPopular(org.springframework.data.domain.PageRequest.of(0, size)).stream()
                .map(p -> new PopularPartResponse(PartResponse.from(p), partPopularityService.soloStats(p)))
                .toList();
    }

    // 부품 상세. myVehicleId가 있으면 "그 차량의 같은 카테고리" 안에서 경쟁 배지(인기상품 등)를 계산하고,
    // 없으면 비교 맥락이 없다는 뜻이라 실측치만 보여주고 경쟁 배지는 붙이지 않는다.
    @GetMapping("/api/parts/{id}")
    public PartDetailResponse getPart(@PathVariable Long id, @RequestParam(required = false) Long myVehicleId) {
        Part part = partRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "부품 정보를 찾을 수 없습니다."));

        partPopularityService.recordView(id);
        part.setViewCount(part.getViewCount() + 1); // 방금 기록한 조회수를 응답에도 바로 반영

        PartPopularityStats stats;
        if (myVehicleId != null) {
            MyVehicle myVehicle = myVehicleRepository.findById(myVehicleId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "차량 정보를 찾을 수 없습니다."));
            if (!myVehicle.getMember().getId().equals(currentMember.id())) {
                throw new ApiException(HttpStatus.FORBIDDEN, "본인이 등록한 차량만 기준으로 확인할 수 있습니다.");
            }
            List<Part> peers = compatibilityRepository.findByModelYearId(myVehicle.getModelYear().getId()).stream()
                    .map(c -> c.getPart())
                    .filter(p -> p.getCategory().equals(part.getCategory()))
                    .toList();
            stats = partPopularityService.statsForGroup(peers).get(part.getId());
        } else {
            stats = partPopularityService.soloStats(part);
        }

        return PartDetailResponse.from(part, stats);
    }

    @GetMapping("/api/parts/{id}/reviews")
    public List<PartReviewResponse> getPartReviews(@PathVariable Long id) {
        return postRepository.findByInstalledPartIdOrderByCreatedAtDesc(id).stream()
                .map(PartReviewResponse::from)
                .toList();
    }

    // "부품 입혀보기"에서 이 부품을 켤 때마다 호출 - 실제 장착 시도 신호를 센다.
    @PostMapping("/api/parts/{id}/fit-selections")
    public ResponseEntity<Void> recordFitSelection(@PathVariable Long id) {
        if (!partRepository.existsById(id)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "부품 정보를 찾을 수 없습니다.");
        }
        partPopularityService.recordFitSelection(id);
        return ResponseEntity.noContent().build();
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

    public record PopularPartResponse(PartResponse part, PartPopularityStats stats) {
    }
}
