package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.VehicleInterest;
import com.ridefit.ridefit.domain.VehicleModel;
import com.ridefit.ridefit.dto.VehicleSummaryResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.VehicleInterestRepository;
import com.ridefit.ridefit.repository.VehicleModelRepository;
import com.ridefit.ridefit.repository.VehicleProfileRepository;
import com.ridefit.ridefit.security.CurrentMember;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

// 관심 차량(차종 단위 찜). 내 차고(연식까지 확정한 보유 차량)와는 별개다.
@RestController
@RequiredArgsConstructor
public class VehicleInterestController {

    private final VehicleInterestRepository interestRepository;
    private final VehicleModelRepository vehicleModelRepository;
    private final VehicleProfileRepository profileRepository;
    private final MemberRepository memberRepository;
    private final CurrentMember currentMember;

    @GetMapping("/api/me/vehicle-interests")
    @Transactional(readOnly = true)
    public List<VehicleSummaryResponse> list() {
        return interestRepository.findByMemberIdOrderByCreatedAtDesc(currentMember.id()).stream()
                .map(i -> VehicleSummaryResponse.of(i.getVehicleModel(),
                        profileRepository.findByVehicleModelId(i.getVehicleModel().getId()).orElse(null)))
                .toList();
    }

    @PostMapping("/api/me/vehicle-interests")
    @Transactional
    public ResponseEntity<Void> add(@RequestBody AddRequest request) {
        Long memberId = currentMember.id();
        VehicleModel model = vehicleModelRepository.findById(request.vehicleModelId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "차량 정보를 찾을 수 없습니다."));
        if (!interestRepository.existsByMemberIdAndVehicleModelId(memberId, model.getId())) {
            interestRepository.save(VehicleInterest.builder()
                    .member(memberRepository.getReferenceById(memberId))
                    .vehicleModel(model)
                    .createdAt(LocalDateTime.now())
                    .build());
        }
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/api/me/vehicle-interests/{vehicleModelId}")
    @Transactional
    public ResponseEntity<Void> remove(@PathVariable Long vehicleModelId) {
        interestRepository.findByMemberIdAndVehicleModelId(currentMember.id(), vehicleModelId)
                .ifPresent(interestRepository::delete);
        return ResponseEntity.noContent().build();
    }

    public record AddRequest(Long vehicleModelId) {
    }
}
