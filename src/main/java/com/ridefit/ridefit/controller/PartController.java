package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.dto.PartResponse;
import com.ridefit.ridefit.repository.PartRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class PartController {

    private final PartRepository partRepository;

    @GetMapping("/api/parts")
    public List<PartResponse> getParts(@RequestParam(required = false) String category) {
        List<com.ridefit.ridefit.domain.Part> parts = category != null
                ? partRepository.findByCategory(category)
                : partRepository.findAll();
        return parts.stream().map(PartResponse::from).toList();
    }
}
