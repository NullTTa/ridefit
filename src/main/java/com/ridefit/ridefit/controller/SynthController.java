package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.dto.SynthResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.security.CurrentMember;
import com.ridefit.ridefit.service.AiSynthService;
import com.ridefit.ridefit.service.CompatibilityCheckService;
import com.ridefit.ridefit.service.RateLimitService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class SynthController {

    private final PartRepository partRepository;
    private final MyVehicleRepository myVehicleRepository;
    private final CompatibilityCheckService compatibilityCheckService;
    private final AiSynthService aiSynthService;
    private final RateLimitService rateLimitService;
    private final CurrentMember currentMember;

    // 호환성 검사를 통과한 부품에 대해서만 합성을 허용한다. 프론트가 통과했다고 보내도 서버에서 다시 검증한다.
    @PostMapping("/api/synth")
    public SynthResponse synthesize(@RequestBody SynthRequest request) {
        Part part = partRepository.findById(request.partId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "부품 정보를 찾을 수 없습니다."));
        MyVehicle vehicle = myVehicleRepository.findById(request.myVehicleId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "차량 정보를 찾을 수 없습니다."));

        if (!vehicle.getMember().getId().equals(currentMember.id())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "본인이 등록한 차량만 사용할 수 있습니다.");
        }

        boolean allowed = compatibilityCheckService.isProceedAllowed(part.getId(), vehicle.getModelYear().getId());
        if (!allowed) {
            throw new ApiException(HttpStatus.CONFLICT, "호환되지 않는 부품은 합성할 수 없습니다.");
        }

        rateLimitService.checkAndIncrement(currentMember.id());
        return aiSynthService.synthesize(part, vehicle);
    }

    public record SynthRequest(Long partId, Long myVehicleId) {
    }
}
