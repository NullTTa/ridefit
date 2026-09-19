package com.ridefit.ridefit.service;

import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.RecentPartCheck;
import com.ridefit.ridefit.dto.CompatibilityCheckResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.RecentPartCheckRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CompatibilityCheckService {

    private static final Set<String> PROCEED_STATUSES = Set.of("호환가능", "브라켓필요");
    private static final String NO_DATA_STATUS = "정보없음";

    private final PartRepository partRepository;
    private final MyVehicleRepository myVehicleRepository;
    private final CompatibilityRepository compatibilityRepository;
    private final RecentPartCheckRepository recentPartCheckRepository;

    // 차량을 선택하는 즉시(별도 확인 버튼 없이) 호출되는 핵심 판정 로직.
    @Transactional
    public CompatibilityCheckResponse check(Long partId, Long myVehicleId, Long memberId) {
        Part part = partRepository.findById(partId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "부품 정보를 찾을 수 없습니다."));
        MyVehicle myVehicle = myVehicleRepository.findById(myVehicleId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "차량 정보를 찾을 수 없습니다."));

        if (!myVehicle.getMember().getId().equals(memberId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "본인이 등록한 차량만 확인할 수 있습니다.");
        }

        Long modelYearId = myVehicle.getModelYear().getId();
        Optional<Compatibility> compatibility =
                compatibilityRepository.findByPartIdAndModelYearId(partId, modelYearId);

        String status = compatibility.map(Compatibility::getStatus).orElse(NO_DATA_STATUS);
        boolean proceedAllowed = PROCEED_STATUSES.contains(status);
        String note = compatibility.map(Compatibility::getNote).orElse(null);
        String message = proceedAllowed ? null : "호환되지 않음";

        RecentPartCheck record = RecentPartCheck.builder()
                .member(myVehicle.getMember())
                .part(part)
                .myVehicle(myVehicle)
                .status(status)
                .checkedAt(LocalDateTime.now())
                .build();
        recentPartCheckRepository.save(record);

        return new CompatibilityCheckResponse(status, proceedAllowed, note, message);
    }
}
