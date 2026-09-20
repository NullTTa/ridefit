package com.ridefit.ridefit.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.GuideArticle;
import com.ridefit.ridefit.domain.VehicleModel;
import com.ridefit.ridefit.domain.VehicleProfile;
import com.ridefit.ridefit.dto.PartResponse;
import com.ridefit.ridefit.dto.VehicleSummaryResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.GuideArticleRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.VehicleProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// 부품 정보 / 소모품 정보 / DIY 가이드. 본문은 JSON 그대로 내려주고, 화면이 섹션 단위로 렌더링한다.
// 부품 정보는 Part.category로 이어져 있어서 "호환 가능한 차량"과 카탈로그 부품이 DB에서 실시간으로 붙는다.
@RestController
@RequiredArgsConstructor
public class GuideController {

    private final GuideArticleRepository guideRepository;
    private final PartRepository partRepository;
    private final CompatibilityRepository compatibilityRepository;
    private final VehicleProfileRepository profileRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @GetMapping("/api/guide/articles")
    public List<GuideSummary> list(@RequestParam(required = false) String type) {
        List<GuideArticle> articles = (type == null || type.isBlank())
                ? guideRepository.findAllByOrderBySortOrderAscIdAsc()
                : guideRepository.findByTypeOrderBySortOrderAscIdAsc(type.toUpperCase());
        return articles.stream().map(GuideSummary::from).toList();
    }

    @GetMapping("/api/guide/articles/{slug}")
    @Transactional(readOnly = true)
    public GuideDetail detail(@PathVariable String slug) {
        GuideArticle article = guideRepository.findBySlug(slug)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "정보 글을 찾을 수 없습니다."));

        Object body = parseBody(article.getBody());
        List<VehicleWithParts> compatibleVehicles = List.of();
        List<PartResponse> catalogParts = List.of();

        if (article.getPartCategory() != null && !article.getPartCategory().isBlank()) {
            catalogParts = partRepository.findByCategory(article.getPartCategory()).stream()
                    .map(PartResponse::from).toList();
            compatibleVehicles = compatibleVehicles(article.getPartCategory());
        }

        List<GuideSummary> related = new ArrayList<>();
        if (body instanceof Map<?, ?> map && map.get("related") instanceof List<?> slugs) {
            for (Object s : slugs) {
                guideRepository.findBySlug(String.valueOf(s)).ifPresent(a -> related.add(GuideSummary.from(a)));
            }
        }

        return new GuideDetail(GuideSummary.from(article), body, compatibleVehicles, catalogParts, related);
    }

    // 이 카테고리 부품 중 "호환가능/브라켓필요"로 등록된 것이 하나라도 있는 차종을 모은다.
    private List<VehicleWithParts> compatibleVehicles(String category) {
        Map<Long, VehicleWithParts> byModel = new LinkedHashMap<>();
        Map<Long, VehicleProfile> profiles = new LinkedHashMap<>();
        profileRepository.findAllWithModel().forEach(p -> profiles.put(p.getVehicleModel().getId(), p));

        for (Compatibility c : compatibilityRepository.findByPartCategory(category)) {
            if ("호환불가".equals(c.getStatus())) continue;
            VehicleModel model = c.getModelYear().getVehicleModel();
            byModel.computeIfAbsent(model.getId(), id -> new VehicleWithParts(
                            VehicleSummaryResponse.of(model, profiles.get(id)), new ArrayList<>()))
                    .partNames().add(c.getPart().getName());
        }
        byModel.values().forEach(v -> {
            List<String> distinct = v.partNames().stream().distinct().toList();
            v.partNames().clear();
            v.partNames().addAll(distinct);
        });
        return new ArrayList<>(byModel.values());
    }

    private Object parseBody(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, Object.class);
        } catch (Exception e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "정보 글 본문을 읽을 수 없습니다.");
        }
    }

    public record GuideSummary(
            Long id, String slug, String type, String title, String summary, String emoji, String partCategory,
            String appliesTo, String applicabilityNote, String difficulty, Integer estimatedMinutes,
            boolean professionalRecommended) {

        static GuideSummary from(GuideArticle a) {
            return new GuideSummary(a.getId(), a.getSlug(), a.getType(), a.getTitle(), a.getSummary(), a.getEmoji(),
                    a.getPartCategory(), a.getAppliesTo(), a.getApplicabilityNote(), a.getDifficulty(),
                    a.getEstimatedMinutes(), a.isProfessionalRecommended());
        }
    }

    public record VehicleWithParts(VehicleSummaryResponse vehicle, List<String> partNames) {
    }

    public record GuideDetail(GuideSummary article, Object body, List<VehicleWithParts> compatibleVehicles,
                               List<PartResponse> catalogParts, List<GuideSummary> related) {
    }
}
