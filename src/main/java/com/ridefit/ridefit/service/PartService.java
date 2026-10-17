package com.ridefit.ridefit.service;

import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.dto.CreatePartRequest;
import com.ridefit.ridefit.dto.PartResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.ModelYearRepository;
import com.ridefit.ridefit.repository.PartRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PartService {

    private static final String COMPATIBLE = "호환가능";

    private final PartRepository partRepository;
    private final ModelYearRepository modelYearRepository;
    private final CompatibilityRepository compatibilityRepository;

    // 링크로 가져온(또는 수동 입력한) 커스텀 부품을 생성하고, 자동/수동으로 확인된 차종에 대해
    // Compatibility 레코드를 만들어둔다. 이후 "차량 선택 즉시 호환 여부 표시"는 이 레코드 존재 여부로 판단한다.
    @Transactional
    public PartResponse createPart(CreatePartRequest request) {
        Part part = Part.builder()
                .name(request.name())
                .price(request.price())
                .category(request.category())
                .imageUrl(request.imageUrl())
                .sourceUrl(request.sourceUrl())
                .build();
        Part saved = partRepository.save(part);

        List<ModelYear> targetYears;
        if (request.modelYearId() != null) {
            ModelYear modelYear = modelYearRepository.findById(request.modelYearId())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "선택한 연식 정보를 찾을 수 없습니다."));
            targetYears = List.of(modelYear);
        } else if (request.vehicleModelId() != null) {
            targetYears = modelYearRepository.findByVehicleModelId(request.vehicleModelId());
            if (targetYears.isEmpty()) {
                throw new ApiException(HttpStatus.NOT_FOUND, "선택한 모델의 연식 정보를 찾을 수 없습니다.");
            }
        } else {
            targetYears = List.of();
        }

        for (ModelYear year : targetYears) {
            // 근거 메모(note)는 비워 둔다 - 화면은 "호환가능 + 메모 없음"을 "호환 근거 미확인"으로 보여 준다(compatStatus.js).
            // 예전에는 "사용자가 등록한 링크 기반 커스텀 부품"이라는 메모가 근거처럼 들어가 확정 호환(초록)으로 보였다.
            // 관리자가 근거를 확인한 뒤 관리자 호환 관리(PUT /api/admin/compatibilities/{id})에서 메모를 넣으면 확정 표시가 된다.
            // 커스텀 부품인지는 Part.sourceUrl로 구분한다.
            Compatibility compatibility = Compatibility.builder()
                    .modelYear(year)
                    .part(saved)
                    .status(COMPATIBLE)
                    .build();
            compatibilityRepository.save(compatibility);
        }

        return PartResponse.from(saved);
    }
}
