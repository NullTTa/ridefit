package com.ridefit.ridefit.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ridefit.ridefit.domain.Trait;
import com.ridefit.ridefit.domain.VehicleProfile;
import com.ridefit.ridefit.dto.FinderDtos;
import com.ridefit.ridefit.dto.SimilarVehicleResponse;
import com.ridefit.ridefit.dto.VehicleSummaryResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.VehicleProfileRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// 성향 테스트 결과와 "비슷한 차량" 추천을 하나의 성향 벡터(8축 x 1~5점) 위에서 계산한다.
// AI 없이 DB의 VehicleProfile 값만 쓰는 설명 가능한 방식이라, 결과 이유도 실제 비교한 필드에서 만들어 낸다.
//
// - 성향 테스트: 질문 답변 -> 축별 선호도(0~1) -> 차량 점수의 가중 평균
// - 비슷한 차량: 성향 거리(45%) + 차체 형태(20%) + 배기량(20%) + 가격대(15%)
@Service
@RequiredArgsConstructor
public class VehicleRecommendationService {

    private static final double W_TRAIT = 0.45;
    private static final double W_BODY = 0.20;
    private static final double W_DISPLACEMENT = 0.20;
    private static final double W_PRICE = 0.15;
    private static final int DEFAULT_SCORE = 3;
    private static final int MAX_RECOMMENDATIONS = 4;

    private final VehicleProfileRepository profileRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private List<Question> questions = List.of();
    private Map<String, JsonNode> riderTypes = Map.of();

    private record OptionDef(String id, String label, Map<Trait, Integer> effects) {
    }

    private record Question(String id, String text, String hint, List<OptionDef> options) {
    }

    @PostConstruct
    void loadCatalog() throws IOException {
        try (InputStream in = new ClassPathResource("seed/finder-questions.json").getInputStream()) {
            JsonNode root = objectMapper.readTree(in);
            List<Question> loaded = new ArrayList<>();
            for (JsonNode q : root.path("questions")) {
                List<OptionDef> options = new ArrayList<>();
                for (JsonNode o : q.path("options")) {
                    Map<Trait, Integer> effects = new EnumMap<>(Trait.class);
                    o.path("effects").fields().forEachRemaining(e -> effects.put(Trait.valueOf(e.getKey()), e.getValue().asInt()));
                    options.add(new OptionDef(o.path("id").asText(), o.path("label").asText(), effects));
                }
                loaded.add(new Question(q.path("id").asText(), q.path("text").asText(), q.path("hint").asText(), options));
            }
            questions = List.copyOf(loaded);

            Map<String, JsonNode> types = new HashMap<>();
            root.path("riderTypes").fields().forEachRemaining(e -> types.put(e.getKey(), e.getValue()));
            riderTypes = Map.copyOf(types);
        }
    }

    public FinderDtos.QuestionsResponse questions() {
        return new FinderDtos.QuestionsResponse(questions.stream()
                .map(q -> new FinderDtos.Question(q.id(), q.text(), q.hint(),
                        q.options().stream().map(o -> new FinderDtos.Option(o.id(), o.label())).toList()))
                .toList());
    }

    // ---------------------------------------------------------------- 성향 테스트

    @Transactional(readOnly = true)
    public FinderDtos.ResultResponse evaluate(List<FinderDtos.AnswerRequest> answers) {
        Map<String, OptionDef> picked = pickOptions(answers);

        Map<Trait, Double> raw = new EnumMap<>(Trait.class);
        Map<Trait, Double> max = new EnumMap<>(Trait.class);
        for (Trait t : Trait.values()) {
            raw.put(t, 0.0);
            max.put(t, 0.0);
        }
        for (Question q : questions) {
            for (Trait t : Trait.values()) {
                double best = q.options().stream().mapToInt(o -> o.effects().getOrDefault(t, 0)).max().orElse(0);
                max.merge(t, best, Double::sum);
            }
            picked.get(q.id()).effects().forEach((t, v) -> raw.merge(t, v.doubleValue(), Double::sum));
        }

        // 축별 선호도 0~1. 질문에서 그 축을 가장 강하게 고른 정도.
        Map<Trait, Double> pref = new EnumMap<>(Trait.class);
        for (Trait t : Trait.values()) {
            pref.put(t, max.get(t) == 0 ? 0.0 : Math.min(1.0, raw.get(t) / max.get(t)));
        }

        List<Trait> ranked = Trait.all().stream()
                .sorted(Comparator.comparingDouble((Trait t) -> pref.get(t)).reversed())
                .toList();

        List<VehicleProfile> candidates = profileRepository.findAllWithModel();
        List<FinderDtos.Recommendation> recommendations = candidates.stream()
                .map(p -> toRecommendation(p, pref))
                .sorted(Comparator.comparingInt(FinderDtos.Recommendation::matchPercent).reversed())
                .limit(MAX_RECOMMENDATIONS)
                .toList();

        return new FinderDtos.ResultResponse(
                riderType(ranked, pref),
                Trait.all().stream()
                        .map(t -> new FinderDtos.TraitScore(t.name(), t.label(), (int) Math.round(pref.get(t) * 100)))
                        .toList(),
                recommendations,
                candidates.size());
    }

    private Map<String, OptionDef> pickOptions(List<FinderDtos.AnswerRequest> answers) {
        Map<String, String> byQuestion = new HashMap<>();
        if (answers != null) {
            for (FinderDtos.AnswerRequest a : answers) {
                if (a != null && a.questionId() != null) {
                    byQuestion.put(a.questionId(), a.optionId());
                }
            }
        }
        Map<String, OptionDef> picked = new LinkedHashMap<>();
        for (Question q : questions) {
            String optionId = byQuestion.get(q.id());
            if (optionId == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "모든 질문에 답해주세요.");
            }
            OptionDef option = q.options().stream().filter(o -> o.id().equals(optionId)).findFirst()
                    .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "알 수 없는 답변입니다: " + q.id()));
            picked.put(q.id(), option);
        }
        return picked;
    }

    private FinderDtos.RiderType riderType(List<Trait> ranked, Map<Trait, Double> pref) {
        Trait top = ranked.get(0);
        JsonNode node = riderTypes.get(top.name());
        String secondary = ranked.size() > 1 && pref.get(ranked.get(1)) >= 0.4 ? ranked.get(1).label() : null;

        List<String> tips = new ArrayList<>();
        if (node != null) {
            node.path("tips").forEach(t -> tips.add(t.asText()));
        }
        return new FinderDtos.RiderType(
                node == null ? top.name() : node.path("code").asText(top.name()),
                node == null ? top.label() + " 라이더" : node.path("name").asText(),
                node == null ? "" : node.path("tagline").asText(),
                node == null ? "" : node.path("description").asText(),
                tips,
                secondary);
    }

    private FinderDtos.Recommendation toRecommendation(VehicleProfile profile, Map<Trait, Double> pref) {
        double weightSum = pref.values().stream().mapToDouble(Double::doubleValue).sum();
        double weighted = 0;
        for (Trait t : Trait.values()) {
            weighted += pref.get(t) * (score(profile, t) - 1) / 4.0;
        }
        int matchPercent = weightSum == 0 ? 50 : (int) Math.round(100 * weighted / weightSum);

        // 이 차량이 잘 맞는 이유: "내가 중요하게 답한 축" 중에서 차량 점수가 높은 것
        List<Trait> byContribution = Trait.all().stream()
                .sorted(Comparator.comparingDouble((Trait t) -> pref.get(t) * score(profile, t)).reversed())
                .toList();
        List<String> reasons = new ArrayList<>();
        for (Trait t : byContribution) {
            if (reasons.size() >= 3) break;
            if (pref.get(t) >= 0.5 && score(profile, t) >= 4) {
                reasons.add("'" + t.label() + "'을(를) 중요하게 답했고, 이 차량은 " + score(profile, t) + "/5점이에요.");
            }
        }
        if (reasons.isEmpty()) {
            Trait t = byContribution.get(0);
            reasons.add("'" + t.label() + "' 성향과 가장 가까워요 (이 차량 " + score(profile, t) + "/5점).");
        }

        // 고려할 점: 중요하게 답한 축인데 차량 점수가 낮은 것 + 프로필에 적힌 단점
        List<String> cautions = new ArrayList<>();
        for (Trait t : Trait.all()) {
            if (pref.get(t) >= 0.5 && score(profile, t) <= 2) {
                cautions.add("'" + t.label() + "'을(를) 중요하게 답했는데, 이 차량은 " + score(profile, t) + "/5점이라 아쉬울 수 있어요.");
            }
        }
        splitLines(profile.getCons()).stream().limit(2).forEach(cautions::add);

        List<SimilarVehicleResponse> similar = similar(List.of(profile.getVehicleModel().getId()), 2);

        return new FinderDtos.Recommendation(
                VehicleSummaryResponse.of(profile.getVehicleModel(), profile), matchPercent, reasons,
                splitLines(profile.getPros()), cautions, similar);
    }

    // ---------------------------------------------------------------- 비슷한 차량

    // baseModelIds 중 하나라도 닮은 차량을 점수순으로 반환한다(기준 차량 자신은 제외).
    @Transactional(readOnly = true)
    public List<SimilarVehicleResponse> similar(Collection<Long> baseModelIds, int limit) {
        List<VehicleProfile> all = profileRepository.findAllWithModel();
        List<VehicleProfile> bases = all.stream().filter(p -> baseModelIds.contains(p.getVehicleModel().getId())).toList();
        if (bases.isEmpty()) {
            return List.of();
        }

        Map<Long, SimilarVehicleResponse> best = new LinkedHashMap<>();
        for (VehicleProfile candidate : all) {
            Long candidateId = candidate.getVehicleModel().getId();
            if (baseModelIds.contains(candidateId)) continue;

            for (VehicleProfile base : bases) {
                Similarity s = compare(base, candidate);
                int percent = (int) Math.round(s.score() * 100);
                SimilarVehicleResponse existing = best.get(candidateId);
                if (existing == null || existing.similarityPercent() < percent) {
                    best.put(candidateId, new SimilarVehicleResponse(
                            VehicleSummaryResponse.of(candidate.getVehicleModel(), candidate), percent, s.reasons(),
                            base.getVehicleModel().getName()));
                }
            }
        }
        return best.values().stream()
                .sorted(Comparator.comparingInt(SimilarVehicleResponse::similarityPercent).reversed())
                .limit(limit)
                .toList();
    }

    private record Similarity(double score, List<String> reasons) {
    }

    private Similarity compare(VehicleProfile base, VehicleProfile other) {
        double diffSum = 0;
        for (Trait t : Trait.values()) {
            diffSum += Math.abs(score(base, t) - score(other, t));
        }
        double traitSim = 1 - (diffSum / Trait.values().length) / 4.0;

        double bodySim = bodySimilarity(base.getBodyStyle(), other.getBodyStyle());

        double dispSim = 0;
        boolean dispClose = false;
        Integer a = base.getDisplacementCc();
        Integer b = other.getDisplacementCc();
        if (a != null && b != null && a > 0 && b > 0) {
            double ratio = (double) Math.max(a, b) / Math.min(a, b);
            dispSim = 1 - Math.min(1.0, Math.log(ratio) / Math.log(3));
            dispClose = ratio <= 1.18;
        }

        double priceSim = 0;
        boolean sameTier = false;
        if (base.getPriceTier() != null && other.getPriceTier() != null) {
            int diff = Math.abs(base.getPriceTier() - other.getPriceTier());
            priceSim = 1 - Math.min(3, diff) / 3.0;
            sameTier = diff == 0;
        }

        double total = W_TRAIT * traitSim + W_BODY * bodySim + W_DISPLACEMENT * dispSim + W_PRICE * priceSim;

        List<String> reasons = new ArrayList<>();
        if (bodySim == 1.0) {
            reasons.add("같은 차체 형태 (" + other.getBodyStyle() + ")");
        } else if (bodySim > 0) {
            reasons.add("같은 " + bodyGroup(other.getBodyStyle()) + " 계열");
        }
        if (dispClose) {
            reasons.add("비슷한 배기량 (" + a + "cc · " + b + "cc)");
        }
        if (sameTier) {
            reasons.add("비슷한 가격대 (" + VehicleSummaryResponse.priceTierLabel(other.getPriceTier()) + ")");
        }
        List<String> shared = Trait.all().stream()
                .filter(t -> score(base, t) >= 4 && score(other, t) >= 4)
                .sorted(Comparator.comparingInt((Trait t) -> score(base, t) + score(other, t)).reversed())
                .limit(2)
                .map(Trait::label)
                .toList();
        if (!shared.isEmpty()) {
            reasons.add("라이딩 성향이 비슷해요: " + String.join(" · ", shared));
        }
        if (reasons.isEmpty()) {
            reasons.add("전반적인 성향 점수가 가까워요");
        }
        return new Similarity(total, reasons);
    }

    // ---------------------------------------------------------------- helpers

    private static int score(VehicleProfile profile, Trait trait) {
        Integer v = profile.getTraitScores().get(trait.name());
        return v == null ? DEFAULT_SCORE : v;
    }

    private static String bodyGroup(String bodyStyle) {
        if (bodyStyle == null) return "";
        return bodyStyle.contains("스쿠터") ? "스쿠터" : bodyStyle;
    }

    private static double bodySimilarity(String a, String b) {
        if (a == null || b == null) return 0;
        if (a.equals(b)) return 1.0;
        return bodyGroup(a).equals(bodyGroup(b)) ? 0.7 : 0;
    }

    public static List<String> splitLines(String text) {
        if (text == null || text.isBlank()) return List.of();
        return java.util.Arrays.stream(text.split("\\R")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
}
