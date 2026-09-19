package com.ridefit.ridefit.controller.admin;

import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.dto.CompatibilityResponse;
import com.ridefit.ridefit.dto.admin.CompatibilityRequest;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.ModelYearRepository;
import com.ridefit.ridefit.repository.PartRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Compatibility(Part-VehicleModel 매칭) 표 CRUD. /api/admin/** 이므로 ROLE_ADMIN만 접근 가능(SecurityConfig).
@RestController
@RequestMapping("/api/admin/compatibilities")
@RequiredArgsConstructor
public class AdminCompatibilityController {

    private final CompatibilityRepository compatibilityRepository;
    private final PartRepository partRepository;
    private final ModelYearRepository modelYearRepository;

    @GetMapping
    public Page<CompatibilityResponse> list(@PageableDefault(size = 20) Pageable pageable) {
        return compatibilityRepository.findAll(pageable).map(CompatibilityResponse::from);
    }

    @PostMapping
    public ResponseEntity<CompatibilityResponse> create(@Valid @RequestBody CompatibilityRequest request) {
        Compatibility saved = compatibilityRepository.save(build(new Compatibility(), request));
        return ResponseEntity.status(HttpStatus.CREATED).body(CompatibilityResponse.from(saved));
    }

    @PutMapping("/{id}")
    public CompatibilityResponse update(@PathVariable Long id, @Valid @RequestBody CompatibilityRequest request) {
        Compatibility compatibility = compatibilityRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "호환성 데이터를 찾을 수 없습니다."));
        return CompatibilityResponse.from(compatibilityRepository.save(build(compatibility, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!compatibilityRepository.existsById(id)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "호환성 데이터를 찾을 수 없습니다.");
        }
        compatibilityRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private Compatibility build(Compatibility target, CompatibilityRequest request) {
        Part part = partRepository.findById(request.partId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "부품을 찾을 수 없습니다."));
        ModelYear modelYear = modelYearRepository.findById(request.modelYearId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "연식 정보를 찾을 수 없습니다."));

        target.setPart(part);
        target.setModelYear(modelYear);
        target.setStatus(request.status());
        target.setNote(request.note());
        return target;
    }
}
