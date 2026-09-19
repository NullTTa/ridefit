package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.dto.PartConflictResponse;
import com.ridefit.ridefit.repository.PartConflictRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

// 여러 부품을 한 차량에 동시에 장착하려 할 때, 서로 충돌하는 조합이 있는지 확인한다.
@RestController
@RequiredArgsConstructor
public class PartConflictController {

    private final PartConflictRepository partConflictRepository;

    @PostMapping("/api/part-conflicts/check")
    public List<PartConflictResponse> checkConflicts(@RequestBody CheckRequest request) {
        List<Long> partIds = request.partIds();
        return partConflictRepository.findByPartIdsInvolved(partIds).stream()
                .filter(c -> partIds.contains(c.getPartA().getId()) && partIds.contains(c.getPartB().getId()))
                .map(PartConflictResponse::from)
                .toList();
    }

    public record CheckRequest(List<Long> partIds) {
    }
}
