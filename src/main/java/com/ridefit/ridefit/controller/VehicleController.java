package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.VehicleModel;
import com.ridefit.ridefit.domain.VehicleProfile;
import com.ridefit.ridefit.dto.ModelYearResponse;
import com.ridefit.ridefit.dto.SimilarVehicleResponse;
import com.ridefit.ridefit.dto.VehicleDetailResponse;
import com.ridefit.ridefit.dto.VehicleSummaryResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.ModelYearRepository;
import com.ridefit.ridefit.repository.VehicleModelRepository;
import com.ridefit.ridefit.repository.VehicleProfileRepository;
import com.ridefit.ridefit.service.VehicleRecommendationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

// 차량 "둘러보기" 화면용 공개 API. 차량(VehicleModel) + 성향/스펙 프로필(VehicleProfile) + 유사 차량 추천.
@RestController
@RequiredArgsConstructor
public class VehicleController {

    private static final int DEFAULT_SIMILAR_LIMIT = 4;
    private static final int MAX_SIMILAR_LIMIT = 12;

    private final VehicleModelRepository vehicleModelRepository;
    private final VehicleProfileRepository profileRepository;
    private final ModelYearRepository modelYearRepository;
    private final CompatibilityRepository compatibilityRepository;
    private final VehicleRecommendationService recommendationService;

    @GetMapping("/api/vehicles")
    public List<VehicleSummaryResponse> list() {
        Map<Long, VehicleProfile> profiles = profilesByModelId();
        return vehicleModelRepository.findAll().stream()
                .map(m -> VehicleSummaryResponse.of(m, profiles.get(m.getId())))
                .toList();
    }

    @GetMapping("/api/vehicles/{id}")
    public VehicleDetailResponse detail(@PathVariable Long id) {
        VehicleModel model = requireModel(id);
        VehicleProfile profile = profileRepository.findByVehicleModelId(id).orElse(null);
        List<ModelYearResponse> years = modelYearRepository.findByVehicleModelId(id).stream()
                .map(ModelYearResponse::from).toList();
        return new VehicleDetailResponse(
                VehicleSummaryResponse.of(model, profile),
                profile == null ? List.of() : VehicleRecommendationService.splitLines(profile.getPros()),
                profile == null ? List.of() : VehicleRecommendationService.splitLines(profile.getCons()),
                years);
    }

    @GetMapping("/api/vehicles/{id}/similar")
    public List<SimilarVehicleResponse> similarOne(@PathVariable Long id, @RequestParam(required = false) Integer limit) {
        requireModel(id);
        return recommendationService.similar(List.of(id), clamp(limit));
    }

    // 여러 차량(최근 본 차량, 내 차고 차량 등)을 기준으로 한 번에 비슷한 차량을 받는다.
    @GetMapping("/api/vehicles/similar")
    public List<SimilarVehicleResponse> similarMany(@RequestParam List<Long> ids, @RequestParam(required = false) Integer limit) {
        return recommendationService.similar(ids, clamp(limit));
    }

    // 이 차종의 어느 연식이든 호환 데이터가 등록된 부품 목록 (부품별로 연식/상태를 묶어서).
    @GetMapping("/api/vehicles/{id}/parts")
    public List<VehiclePartResponse> compatibleParts(@PathVariable Long id) {
        requireModel(id);
        Map<Long, VehiclePartResponse> byPart = new LinkedHashMap<>();
        for (ModelYear year : modelYearRepository.findByVehicleModelId(id)) {
            for (Compatibility c : compatibilityRepository.findByModelYearId(year.getId())) {
                var part = c.getPart();
                byPart.computeIfAbsent(part.getId(), k -> new VehiclePartResponse(
                                part.getId(), part.getCategory(), part.getName(), part.getPrice(), part.getImageUrl(),
                                new ArrayList<>()))
                        .years().add(new YearStatus(year.getYear(), c.getStatus()));
            }
        }
        return new ArrayList<>(byPart.values());
    }

    private Map<Long, VehicleProfile> profilesByModelId() {
        return profileRepository.findAllWithModel().stream()
                .collect(Collectors.toMap(p -> p.getVehicleModel().getId(), Function.identity()));
    }

    private VehicleModel requireModel(Long id) {
        return vehicleModelRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "차량 정보를 찾을 수 없습니다."));
    }

    private static int clamp(Integer limit) {
        if (limit == null) return DEFAULT_SIMILAR_LIMIT;
        return Math.max(1, Math.min(MAX_SIMILAR_LIMIT, limit));
    }

    public record YearStatus(Integer year, String status) {
    }

    public record VehiclePartResponse(Long partId, String category, String name, Integer price, String imageUrl,
                                       List<YearStatus> years) {
    }
}
