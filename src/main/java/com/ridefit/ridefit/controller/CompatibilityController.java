package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.dto.CompatibilityResponse;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class CompatibilityController {

    private final CompatibilityRepository compatibilityRepository;

    @GetMapping("/api/compatibility")
    public List<CompatibilityResponse> getCompatibilities() {
        return compatibilityRepository.findAll().stream().map(CompatibilityResponse::from).toList();
    }
}
