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
            Compatibility compatibility = Compatibility.builder()
                    .modelYear(year)
                    .part(saved)
                    .status(COMPATIBLE)
                    .note("사용자가 등록한 링크 기반 커스텀 부품")
                    .build();
            compatibilityRepository.save(compatibility);
        }

        return PartResponse.from(saved);
    }
}
