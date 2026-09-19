package com.ridefit.ridefit.controller.admin;

import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.PartConflict;
import com.ridefit.ridefit.dto.PartConflictResponse;
import com.ridefit.ridefit.dto.admin.PartConflictRequest;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.PartConflictRepository;
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

// PartConflict(Part-Part 충돌) 표 CRUD.
@RestController
@RequestMapping("/api/admin/part-conflicts")
@RequiredArgsConstructor
public class AdminPartConflictController {

    private final PartConflictRepository partConflictRepository;
    private final PartRepository partRepository;

    @GetMapping
    public Page<PartConflictResponse> list(@PageableDefault(size = 20) Pageable pageable) {
        return partConflictRepository.findAll(pageable).map(PartConflictResponse::from);
    }

    @PostMapping
    public ResponseEntity<PartConflictResponse> create(@Valid @RequestBody PartConflictRequest request) {
        PartConflict saved = partConflictRepository.save(build(new PartConflict(), request));
        return ResponseEntity.status(HttpStatus.CREATED).body(PartConflictResponse.from(saved));
    }

    @PutMapping("/{id}")
    public PartConflictResponse update(@PathVariable Long id, @Valid @RequestBody PartConflictRequest request) {
        PartConflict conflict = partConflictRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "충돌 데이터를 찾을 수 없습니다."));
        return PartConflictResponse.from(partConflictRepository.save(build(conflict, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!partConflictRepository.existsById(id)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "충돌 데이터를 찾을 수 없습니다.");
        }
        partConflictRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private PartConflict build(PartConflict target, PartConflictRequest request) {
        Part partA = partRepository.findById(request.partAId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "부품 A를 찾을 수 없습니다."));
        Part partB = partRepository.findById(request.partBId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "부품 B를 찾을 수 없습니다."));

        target.setPartA(partA);
        target.setPartB(partB);
        target.setReason(request.reason());
        return target;
    }
}
