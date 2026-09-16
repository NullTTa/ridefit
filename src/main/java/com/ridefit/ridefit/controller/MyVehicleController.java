package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.Member;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.dto.MyVehicleResponse;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.ModelYearRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Optional;

// 내 차량 등록 + "내 차량 기준 호환 부품 조회" API.
// 등록된 내 차량(myVehicleId)의 modelYear를 기준으로 Compatibility 테이블을 조회해서
// 그 차량에 대해 호환 정보가 등록된 부품 목록(부품 정보 + 호환 상태)을 반환하는 것이 핵심 로직이다.
@RestController
@RequiredArgsConstructor
public class MyVehicleController {

    private final MyVehicleRepository myVehicleRepository;
    private final MemberRepository memberRepository;
    private final ModelYearRepository modelYearRepository;
    private final CompatibilityRepository compatibilityRepository;

    @PostMapping("/api/my-vehicles")
    public ResponseEntity<?> createMyVehicle(@RequestBody MyVehicleRequest request) {
        Optional<Member> member = memberRepository.findById(request.memberId());
        if (member.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Optional<ModelYear> modelYear = modelYearRepository.findById(request.modelYearId());
        if (modelYear.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        MyVehicle myVehicle = MyVehicle.builder()
                .member(member.get())
                .modelYear(modelYear.get())
                .photoUrl(request.photoUrl())
                .build();
        MyVehicle saved = myVehicleRepository.save(myVehicle);
        return ResponseEntity.status(HttpStatus.CREATED).body(MyVehicleResponse.from(saved));
    }

    @GetMapping("/api/my-vehicles/{myVehicleId}/compatible-parts")
    public ResponseEntity<?> getCompatibleParts(@PathVariable Long myVehicleId) {
        Optional<MyVehicle> myVehicle = myVehicleRepository.findById(myVehicleId);
        if (myVehicle.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Long modelYearId = myVehicle.get().getModelYear().getId();
        List<CompatiblePartResponse> result = compatibilityRepository.findByModelYearId(modelYearId).stream()
                .map(c -> new CompatiblePartResponse(
                        c.getPart().getId(),
                        c.getPart().getCategory(),
                        c.getPart().getName(),
                        c.getPart().getPrice(),
                        c.getStatus(),
                        c.getNote()))
                .toList();

        return ResponseEntity.ok(result);
    }

    public record MyVehicleRequest(Long memberId, Long modelYearId, String photoUrl) {
    }

    public record CompatiblePartResponse(Long partId, String category, String name, Integer price, String status,
                                          String note) {
    }
}
