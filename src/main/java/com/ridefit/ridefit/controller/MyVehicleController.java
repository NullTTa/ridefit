package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.Member;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.dto.MyVehicleResponse;
import com.ridefit.ridefit.dto.PartFitmentResponse;
import com.ridefit.ridefit.dto.PartPopularityStats;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.ModelYearRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.security.CurrentMember;
import com.ridefit.ridefit.service.CompatibilityCheckService;
import com.ridefit.ridefit.service.PartPopularityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// 내 차고(garage): 로그인한 사용자의 차량 등록/조회/삭제 + "내 차량 기준 호환 부품 조회".
@RestController
@RequiredArgsConstructor
public class MyVehicleController {

    private final MyVehicleRepository myVehicleRepository;
    private final MemberRepository memberRepository;
    private final ModelYearRepository modelYearRepository;
    private final CompatibilityRepository compatibilityRepository;
    private final CurrentMember currentMember;
    private final PartPopularityService partPopularityService;
    private final com.ridefit.ridefit.repository.FavoriteRepository favoriteRepository;
    private final com.ridefit.ridefit.repository.ReservationRepository reservationRepository;

    @GetMapping("/api/my-vehicles")
    public List<MyVehicleResponse> getMyVehicles() {
        return myVehicleRepository.findByMemberId(currentMember.id()).stream()
                .map(MyVehicleResponse::from).toList();
    }

    @PostMapping("/api/my-vehicles")
    public ResponseEntity<?> createMyVehicle(@RequestBody MyVehicleRequest request) {
        // memberId는 클라이언트 입력이 아니라 JWT로 인증된 사용자 기준으로만 결정한다 (IDOR 방지).
        Member member = memberRepository.findById(currentMember.id())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "회원 정보를 찾을 수 없습니다."));
        ModelYear modelYear = modelYearRepository.findById(request.modelYearId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "선택한 연식 정보를 찾을 수 없습니다."));
        requireDatedYear(modelYear);

        MyVehicle myVehicle = MyVehicle.builder()
                .member(member)
                .modelYear(modelYear)
                .build();
        MyVehicle saved = myVehicleRepository.save(myVehicle);
        return ResponseEntity.status(HttpStatus.CREATED).body(MyVehicleResponse.from(saved));
    }

    @PatchMapping("/api/my-vehicles/{myVehicleId}")
    public ResponseEntity<?> updateMyVehicle(
            @PathVariable Long myVehicleId, @RequestBody MyVehicleUpdateRequest request) {
        MyVehicle myVehicle = requireOwnedVehicle(myVehicleId);

        if (request.modelYearId() != null) {
            ModelYear modelYear = modelYearRepository.findById(request.modelYearId())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "선택한 연식 정보를 찾을 수 없습니다."));
            // 지금 쓰고 있는 연식을 그대로 다시 보내는 경우(닉네임만 수정 등)는 허용하고, 다른 연식으로 바꿀 때만 검사한다.
            if (!modelYear.getId().equals(myVehicle.getModelYear().getId())) {
                requireDatedYear(modelYear);
            }
            myVehicle.setModelYear(modelYear);
        }
        if (request.nickname() != null) {
            myVehicle.setNickname(request.nickname().isBlank() ? null : request.nickname());
        }
        if (request.photoUrl() != null) {
            myVehicle.setPhotoUrl(request.photoUrl().isBlank() ? null : request.photoUrl());
        }

        MyVehicle saved = myVehicleRepository.save(myVehicle);
        return ResponseEntity.ok(MyVehicleResponse.from(saved));
    }

    @DeleteMapping("/api/my-vehicles/{myVehicleId}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<Void> deleteMyVehicle(@PathVariable Long myVehicleId) {
        MyVehicle myVehicle = requireOwnedVehicle(myVehicleId);
        // 이 차량으로 만든 가상 예약은 예약 기록만 남기고 차량 연결만 끊는다.
        reservationRepository.findByMyVehicleId(myVehicleId).forEach(r -> r.setMyVehicle(null));
        // 이 차량에 저장한 부품(즐겨찾기)은 차량과 함께 지운다(다른 차량/차량 미지정 저장은 그대로).
        favoriteRepository.deleteByMyVehicleId(myVehicleId);
        myVehicleRepository.delete(myVehicle);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/my-vehicles/{myVehicleId}/compatible-parts")
    public ResponseEntity<?> getCompatibleParts(
            @PathVariable Long myVehicleId, @RequestParam(required = false) String category) {
        MyVehicle myVehicle = requireOwnedVehicle(myVehicleId);

        Long modelYearId = myVehicle.getModelYear().getId();
        List<Compatibility> all = compatibilityRepository.findByModelYearId(modelYearId);

        // 인기상품 배지는 "이 차종의 같은 카테고리" 안에서만 비교한다(카테고리 필터와 무관하게
        // 항상 전체 카테고리 그룹 기준으로 계산 - 필터링은 그다음에 한다).
        Map<String, List<Part>> partsByCategory = all.stream()
                .map(Compatibility::getPart)
                .distinct()
                .collect(Collectors.groupingBy(Part::getCategory));
        Map<Long, PartPopularityStats> statsByPartId = partsByCategory.values().stream()
                .flatMap(group -> partPopularityService.statsForGroup(group).entrySet().stream())
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

        // 부품마다 "내 차와 같은 차종"에서 장착 가능한(호환가능/브라켓필요) 연식 목록 - 카드의 적용 연식 표시용.
        Long vehicleModelId = myVehicle.getModelYear().getVehicleModel().getId();
        Map<Long, List<PartFitmentResponse>> fitmentsByPartId = all.isEmpty() ? Map.of()
                : compatibilityRepository.findByPartIdInWithModel(
                                all.stream().map(c -> c.getPart().getId()).collect(Collectors.toSet())).stream()
                        .filter(c -> c.getModelYear().getVehicleModel().getId().equals(vehicleModelId))
                        .filter(c -> CompatibilityCheckService.isProceedStatus(c.getStatus()))
                        // 연식 값이 없는 레거시 연식은 "적용 연식" 표시에서 뺀다(연식 미등록 노출 방지).
                        .filter(c -> c.getModelYear().getYear() != null)
                        .map(c -> Map.entry(c.getPart().getId(), PartFitmentResponse.from(c)))
                        .collect(Collectors.groupingBy(Map.Entry::getKey,
                                Collectors.mapping(Map.Entry::getValue, Collectors.toList())));

        List<CompatiblePartResponse> result = all.stream()
                .filter(c -> category == null || category.equals(c.getPart().getCategory()))
                .map(c -> new CompatiblePartResponse(
                        c.getPart().getId(),
                        c.getPart().getCategory(),
                        c.getPart().getName(),
                        c.getPart().getPrice(),
                        c.getPart().getImageUrl(),
                        c.getStatus(),
                        c.getNote(),
                        c.getPart().getInstallVideoUrl(),
                        statsByPartId.get(c.getPart().getId()),
                        fitmentsByPartId.getOrDefault(c.getPart().getId(), List.of()).stream()
                                .sorted(PartFitmentResponse.ORDER).toList()))
                .toList();

        return ResponseEntity.ok(result);
    }

    // 내 차량 전체의 "장착 가능(호환가능/브라켓필요)" 부품 요약(이름/카테고리만, 통계 없음).
    // 부품 찾아보기에서 지금 차량에 검색 결과가 없을 때 "내 다른 차량에는 있다"를 실제 호환 데이터로만 알려주는 용도.
    @GetMapping("/api/my-vehicles/compatible-summary")
    public List<VehicleCompatibleSummary> getCompatibleSummary() {
        return myVehicleRepository.findByMemberId(currentMember.id()).stream()
                .map(v -> new VehicleCompatibleSummary(v.getId(),
                        v.getNickname() != null && !v.getNickname().isBlank() ? v.getNickname() : com.ridefit.ridefit.dto.ModelYearLabel.of(v.getModelYear()),
                        compatibilityRepository.findByModelYearId(v.getModelYear().getId()).stream()
                                .filter(c -> CompatibilityCheckService.isProceedStatus(c.getStatus()))
                                .map(c -> new SummaryPart(c.getPart().getId(), c.getPart().getName(), c.getPart().getCategory()))
                                .distinct()
                                .toList()))
                .toList();
    }

    public record VehicleCompatibleSummary(Long myVehicleId, String label, List<SummaryPart> parts) {
    }

    public record SummaryPart(Long partId, String name, String category) {
    }

    // 내 차고 "추천 상품": 이 차량에 장착 가능한(호환가능/브라켓필요) 부품 중 RIDEFIT 안에서 실제로 쌓인 신호
    // (조회/장착해보기/후기/평점)가 있는 것만, 기존 인기 점수 순으로. 신호가 없으면 빈 목록(호환만으로 추천하지 않음).
    @GetMapping("/api/my-vehicles/{myVehicleId}/recommended-parts")
    public List<RecommendedPartResponse> getRecommendedParts(
            @PathVariable Long myVehicleId, @RequestParam(defaultValue = "8") int limit) {
        MyVehicle myVehicle = requireOwnedVehicle(myVehicleId);
        Map<Long, Compatibility> byPartId = compatibilityRepository.findByModelYearId(myVehicle.getModelYear().getId()).stream()
                .filter(c -> CompatibilityCheckService.isProceedStatus(c.getStatus()))
                .collect(Collectors.toMap(c -> c.getPart().getId(), c -> c, (a, b) -> a));
        List<Part> parts = byPartId.values().stream().map(Compatibility::getPart).toList();
        return partPopularityService.rankBySignals(parts, Math.max(1, Math.min(20, limit))).stream()
                .map(r -> {
                    Compatibility c = byPartId.get(r.partId());
                    Part p = c.getPart();
                    return new RecommendedPartResponse(p.getId(), p.getCategory(), p.getName(), p.getPrice(), p.getImageUrl(),
                            c.getStatus(), r.stats());
                })
                .toList();
    }

    public record RecommendedPartResponse(Long partId, String category, String name, Integer price, String imageUrl,
                                          String status, PartPopularityStats stats) {
    }

    // 연식 값이 없는 레거시 연식(model_year_value NULL)은 새로 등록/변경할 수 없다 - 등록 화면에서도 숨긴다.
    // 이미 그 연식을 쓰는 기존 차량은 그대로 둔다(데이터 삭제/이동 없음).
    private void requireDatedYear(ModelYear modelYear) {
        if (modelYear.getYear() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "연식 정보가 없는 항목은 선택할 수 없어요. 다른 연식을 선택해주세요.");
        }
    }

    private MyVehicle requireOwnedVehicle(Long myVehicleId) {
        MyVehicle myVehicle = myVehicleRepository.findById(myVehicleId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "존재하지 않는 차량입니다."));
        if (!myVehicle.getMember().getId().equals(currentMember.id())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "본인이 등록한 차량만 조회할 수 있습니다.");
        }
        return myVehicle;
    }

    public record MyVehicleRequest(Long modelYearId) {
    }

    public record MyVehicleUpdateRequest(Long modelYearId, String nickname, String photoUrl) {
    }

    public record CompatiblePartResponse(Long partId, String category, String name, Integer price, String imageUrl,
                                          String status, String note, String installVideoUrl,
                                          PartPopularityStats stats,
                                          // 내 차와 같은 차종에서 이 부품이 장착 가능한 연식들(적용 연식 표시용)
                                          List<PartFitmentResponse> sameModelFitments) {
    }
}
