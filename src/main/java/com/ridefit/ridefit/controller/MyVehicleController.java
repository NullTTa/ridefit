package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.Member;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.dto.MyVehicleResponse;
import com.ridefit.ridefit.dto.PartPopularityStats;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.ModelYearRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.security.CurrentMember;
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
                        statsByPartId.get(c.getPart().getId())))
                .toList();

        return ResponseEntity.ok(result);
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
                                          PartPopularityStats stats) {
    }
}
