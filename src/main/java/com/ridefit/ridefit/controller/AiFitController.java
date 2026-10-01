package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.dto.AiFitDtos.AiFitRequest;
import com.ridefit.ridefit.dto.AiFitDtos.AiFitResponse;
import com.ridefit.ridefit.dto.AiFitDtos.AiFitStatusResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.security.CurrentMember;
import com.ridefit.ridefit.service.AiFitService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

// FitRoom의 "AI로 장착해보기". status는 버튼 상태/캐시 확인용(무료, API 호출 없음),
// POST는 사용자가 버튼을 눌렀을 때만 호출된다.
@RestController
@RequiredArgsConstructor
public class AiFitController {

    private final PartRepository partRepository;
    private final MyVehicleRepository myVehicleRepository;
    private final AiFitService aiFitService;
    private final CurrentMember currentMember;

    // AI 장착을 지원하는 부품 카테고리(관리자 화면에서 "AI 장착 대상" 표시용).
    @GetMapping("/api/ai-fit/supported-categories")
    public List<String> supportedCategories() {
        return AiFitService.supportedCategories().stream().sorted().toList();
    }

    @GetMapping("/api/ai-fit/status")
    public AiFitStatusResponse status(@RequestParam Long partId, @RequestParam Long myVehicleId,
                                      @RequestParam(required = false) Double anchorX,
                                      @RequestParam(required = false) Double anchorY) {
        return aiFitService.status(requirePart(partId), requireOwnedVehicle(myVehicleId),
                clampAnchor(anchorX), clampAnchor(anchorY));
    }

    @PostMapping("/api/ai-fit")
    public AiFitResponse generate(@RequestBody AiFitRequest request) {
        if (request.partId() == null || request.myVehicleId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "부품과 차량을 선택해주세요.");
        }
        return aiFitService.generate(requirePart(request.partId()), requireOwnedVehicle(request.myVehicleId()),
                clampAnchor(request.anchorX()), clampAnchor(request.anchorY()), currentMember.id());
    }

    private Part requirePart(Long partId) {
        return partRepository.findById(partId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "부품 정보를 찾을 수 없습니다."));
    }

    private MyVehicle requireOwnedVehicle(Long myVehicleId) {
        MyVehicle vehicle = myVehicleRepository.findById(myVehicleId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "차량 정보를 찾을 수 없습니다."));
        if (!vehicle.getMember().getId().equals(currentMember.id())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "본인이 등록한 차량만 사용할 수 있습니다.");
        }
        return vehicle;
    }

    // 0~100% 범위 밖이면 위치 힌트를 쓰지 않는다.
    private Double clampAnchor(Double v) {
        return v == null || v.isNaN() || v < 0 || v > 100 ? null : v;
    }
}
