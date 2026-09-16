package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.Part;
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
    public List<Part> getParts(@RequestParam(required = false) String category) {
        if (category != null) {
            return partRepository.findByCategory(category);
        }
        return partRepository.findAll();
    }
}
