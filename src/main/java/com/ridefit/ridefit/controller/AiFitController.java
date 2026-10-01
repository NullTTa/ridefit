package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.dto.AiFitDtos.AiFitCheckRequest;
import com.ridefit.ridefit.dto.AiFitDtos.AiFitCheckResponse;
import com.ridefit.ridefit.dto.AiFitDtos.AiFitPartInput;
import com.ridefit.ridefit.dto.AiFitDtos.AiFitRequest;
import com.ridefit.ridefit.dto.AiFitDtos.AiFitResponse;
import com.ridefit.ridefit.dto.AiFitDtos.AiFitResultItem;
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

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

// FitRoom의 "AI로 장착해보기". status/check는 버튼 상태/캐시 확인용(무료, API 호출 없음),
// POST /api/ai-fit 는 사용자가 버튼을 눌렀을 때만 호출된다. results는 이 차량으로 만든 결과 목록(저장된 것 전부).
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

    // 선택한 여러 부품의 준비 상태(부품별로 합성에 넣을 수 있는지 + 그 조합의 저장된 결과가 있는지).
    @PostMapping("/api/ai-fit/check")
    public AiFitCheckResponse check(@RequestBody AiFitCheckRequest request) {
        if (request.myVehicleId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "차량을 선택해주세요.");
        }
        return aiFitService.check(toInputs(request.parts(), Integer.MAX_VALUE), requireOwnedVehicle(request.myVehicleId()));
    }

    @PostMapping("/api/ai-fit")
    public AiFitResponse generate(@RequestBody AiFitRequest request) {
        if (request.myVehicleId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "부품과 차량을 선택해주세요.");
        }
        // parts(여러 부품)가 오면 그것을, 없으면 예전 형식(partId 하나)을 쓴다.
        List<AiFitPartInput> raw = request.parts() != null && !request.parts().isEmpty()
                ? request.parts()
                : request.partId() == null ? List.of() : List.of(new AiFitPartInput(request.partId(), request.anchorX(), request.anchorY()));
        if (raw.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "부품과 차량을 선택해주세요.");
        }
        return aiFitService.generate(toInputs(raw, AiFitService.MAX_PARTS), requireOwnedVehicle(request.myVehicleId()),
                currentMember.id(), Boolean.TRUE.equals(request.regenerate()));
    }

    // 이 차량으로 만든 장착 결과(최신순, 저장된 것 전부). 본인 차량만.
    @GetMapping("/api/ai-fit/results")
    public List<AiFitResultItem> results(@RequestParam Long myVehicleId) {
        MyVehicle vehicle = requireOwnedVehicle(myVehicleId);
        Map<Long, String> names = partRepository.findAll().stream()
                .collect(Collectors.toMap(Part::getId, Part::getName, (a, b) -> a));
        return aiFitService.results(vehicle, currentMember.id(), names);
    }

    // 부품 id 확인(존재/중복 제거, 순서 유지) + 위치 힌트 범위 정리.
    private List<AiFitService.PartInput> toInputs(List<AiFitPartInput> raw, int max) {
        if (raw == null || raw.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "장착할 부품을 선택해주세요.");
        }
        if (raw.size() > Math.max(max, 1) && max != Integer.MAX_VALUE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "한 번에 " + max + "개 부품까지 함께 장착할 수 있어요.");
        }
        Set<Long> seen = new HashSet<>();
        List<Long> ids = raw.stream().map(AiFitPartInput::partId).filter(id -> id != null && seen.add(id)).toList();
        Map<Long, Part> parts = partRepository.findAllById(ids).stream().collect(Collectors.toMap(Part::getId, Function.identity()));
        List<AiFitService.PartInput> inputs = new ArrayList<>();
        Set<Long> added = new HashSet<>();
        for (AiFitPartInput in : raw) {
            if (in.partId() == null || !added.add(in.partId())) continue;
            Part part = parts.get(in.partId());
            if (part == null) throw new ApiException(HttpStatus.NOT_FOUND, "부품 정보를 찾을 수 없습니다.");
            inputs.add(new AiFitService.PartInput(part, clampAnchor(in.anchorX()), clampAnchor(in.anchorY())));
        }
        return inputs;
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
