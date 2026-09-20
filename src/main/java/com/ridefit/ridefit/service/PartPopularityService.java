package com.ridefit.ridefit.service;

import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.dto.PartPopularityStats;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.PostRepository;
import com.ridefit.ridefit.repository.SellerListingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

// "인기상품" 배지는 전부 실제로 쌓인 데이터에서만 계산한다. 판매량은 확인 가능한 외부 데이터
// 소스가 없어서 항상 null이고(Part.externalSalesCount 참고), 나머지 지표는 RIDEFIT 안에서
// 실제로 발생한 조회/장착시도/후기/평점을 그대로 센 것이다. 초기값이 0이면 배지도 당연히 없다.
//
// 배지는 "같은 차종의 같은 카테고리" 그룹(peer group) 안에서만 비교한다(요구사항 5번) - 서로
// 다른 차종/카테고리 부품끼리는 비교하지 않는다. 그리고 최소 기준치를 넘지 못하면, 그룹 안에서
// 1등이어도 배지를 붙이지 않는다("임의로 첫 번째 상품에 인기상품을 붙이지 않는다").
@Service
@RequiredArgsConstructor
public class PartPopularityService {

    private static final long HOT_MIN_SCORE = 5;
    private static final long MOST_REVIEWED_MIN = 3;
    private static final long MOST_FITTED_MIN = 3;
    private static final long MOST_VIEWED_MIN = 5;
    private static final double HIGH_RATED_MIN_AVG = 4.0;

    private final PostRepository postRepository;
    private final SellerListingRepository sellerListingRepository;
    private final PartRepository partRepository;

    @Transactional
    public void recordView(Long partId) {
        partRepository.findById(partId).ifPresent(part -> {
            part.setViewCount(part.getViewCount() + 1);
            partRepository.save(part);
        });
    }

    @Transactional
    public void recordFitSelection(Long partId) {
        partRepository.findById(partId).ifPresent(part -> {
            part.setFitSelectionCount(part.getFitSelectionCount() + 1);
            partRepository.save(part);
        });
    }

    // parts: 같은 차종+같은 카테고리로 묶인 peer group. 이 그룹 안에서만 순위를 비교해 배지를 붙인다.
    public Map<Long, PartPopularityStats> statsForGroup(List<Part> parts) {
        List<RawStats> raw = parts.stream().map(this::rawStats).toList();
        Map<Long, List<String>> badgesByPartId = computeBadges(raw);

        Map<Long, PartPopularityStats> result = new HashMap<>();
        for (RawStats r : raw) {
            result.put(r.partId(), r.toStats(badgesByPartId.getOrDefault(r.partId(), List.of())));
        }
        return result;
    }

    // 비교 대상(같은 차종 맥락)이 없을 때 - 경쟁 배지(HOT 등)는 붙이지 않고 실측치만 보여준다.
    public PartPopularityStats soloStats(Part part) {
        return rawStats(part).toStats(List.of());
    }

    private RawStats rawStats(Part part) {
        long reviewCount = postRepository.countByInstalledPartId(part.getId());
        Double avgRating = postRepository.findAverageRatingByInstalledPartId(part.getId());
        long ratingCount = postRepository.countByInstalledPartIdAndRatingIsNotNull(part.getId());
        long positive = postRepository.countByInstalledPartIdAndCompatibleFeedback(part.getId(), "MATCHED");
        long negative = postRepository.countByInstalledPartIdAndCompatibleFeedback(part.getId(), "NOT_MATCHED");
        long photoCount = postRepository.countByInstalledPartIdAndImageUrlIsNotNull(part.getId());
        long sellerCount = sellerListingRepository.countByPartId(part.getId());
        Integer lowestPrice = sellerListingRepository.findByPartIdOrderByPriceAsc(part.getId()).stream()
                .findFirst().map(l -> l.getPrice()).orElse(null);

        // 랭킹 계산용 내부 점수일 뿐, 사용자에게 그대로 노출하는 값이 아니다. 실제로 쌓인
        // 조회/장착시도/후기/평점에 가중치를 둔 단순 합산.
        long score = part.getViewCount()
                + part.getFitSelectionCount() * 3L
                + reviewCount * 5L
                + (avgRating != null ? Math.round(avgRating * 4) : 0);

        return new RawStats(part.getId(), part.getExternalSalesCount(), part.getViewCount(),
                part.getFitSelectionCount(), reviewCount, ratingCount, avgRating, positive, negative,
                photoCount, sellerCount, lowestPrice, score);
    }

    private Map<Long, List<String>> computeBadges(List<RawStats> peers) {
        Map<Long, List<String>> result = new HashMap<>();
        for (RawStats r : peers) {
            result.put(r.partId(), new ArrayList<>());
        }

        // 🔥 인기상품: 비교 대상이 2개 이상일 때만 의미가 있다.
        if (peers.size() >= 2) {
            topBy(peers, RawStats::score, HOT_MIN_SCORE)
                    .ifPresent(id -> result.get(id).add("HOT"));
        }
        topBy(peers, RawStats::reviewCount, MOST_REVIEWED_MIN)
                .ifPresent(id -> result.get(id).add("MOST_REVIEWED"));
        topBy(peers, RawStats::fitSelectionCount, MOST_FITTED_MIN)
                .ifPresent(id -> result.get(id).add("MOST_FITTED"));
        topBy(peers, RawStats::viewCount, MOST_VIEWED_MIN)
                .ifPresent(id -> result.get(id).add("MOST_VIEWED"));

        peers.stream()
                .filter(r -> r.avgRating() != null && r.avgRating() >= HIGH_RATED_MIN_AVG && r.ratingCount() >= 1)
                .max(Comparator.comparingDouble(RawStats::avgRating))
                .ifPresent(r -> result.get(r.partId()).add("HIGH_RATED"));

        return result;
    }

    private Optional<Long> topBy(List<RawStats> peers, java.util.function.ToLongFunction<RawStats> metric,
                                  long minThreshold) {
        return peers.stream()
                .filter(r -> metric.applyAsLong(r) >= minThreshold)
                .max(Comparator.comparingLong(metric))
                .map(RawStats::partId);
    }

    private record RawStats(
            Long partId, Integer externalSalesCount, long viewCount, long fitSelectionCount, long reviewCount,
            long ratingCount, Double avgRating, long positiveFeedbackCount, long negativeFeedbackCount,
            long photoReviewCount, long sellerCount, Integer lowestPrice, long score) {

        PartPopularityStats toStats(List<String> badges) {
            return new PartPopularityStats(externalSalesCount, viewCount, fitSelectionCount, reviewCount,
                    ratingCount, avgRating, positiveFeedbackCount, negativeFeedbackCount, photoReviewCount,
                    sellerCount, lowestPrice, badges);
        }
    }
}
