package com.ridefit.ridefit.service;

import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.dto.CompatibilityCheckResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.PartRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompatibilityCheckService {

    static final Set<String> PROCEED_STATUSES = Set.of("호환가능", "브라켓필요");

    // 장착 진행 가능한 호환 상태인지(호환가능/브라켓필요). FitRoom 후보, 부품 적용 연식 표시가 같은 기준을 쓴다.
    public static boolean isProceedStatus(String status) {
        return status != null && PROCEED_STATUSES.contains(status);
    }
    private static final String NO_DATA_STATUS = "정보없음";

    private final PartRepository partRepository;
    private final MyVehicleRepository myVehicleRepository;
    private final CompatibilityRepository compatibilityRepository;
    private final RecentPartCheckRecorder recentPartCheckRecorder;

    // 차량을 선택하는 즉시(별도 확인 버튼 없이) 호출되는 핵심 판정 로직.
    // 판정은 읽기만 하고, "최근 확인한 부품" 기록은 RecentPartCheckRecorder가 별도 트랜잭션으로 저장한다 -
    // 기록 저장이 실패해도(예: MariaDB 스냅샷 격리 충돌) 이미 나온 판정 결과는 그대로 200으로 돌려준다.
    @Transactional(readOnly = true)
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

        try {
            recentPartCheckRecorder.record(memberId, part.getId(), myVehicle.getId(), status);
        } catch (RuntimeException e) {
            // 기록은 마이페이지 이력용이라 실패해도 판정은 유효하다. 로그에는 부품 id와 오류 종류/메시지만 남긴다(회원 정보·요청 값은 남기지 않음).
            Throwable root = e;
            while (root.getCause() != null && root.getCause() != root) root = root.getCause();
            log.warn("최근 확인 기록 저장 실패 - 판정 결과는 그대로 반환: partId={}, error={}: {}",
                    part.getId(), root.getClass().getSimpleName(), root.getMessage());
        }

        return new CompatibilityCheckResponse(status, proceedAllowed, note, message);
    }

    // AI 합성 등 다른 서비스에서 "이 부품이 이 차량과 호환되는지"만 부작용 없이(RecentPartCheck 기록 없이) 재확인할 때 사용.
    public boolean isProceedAllowed(Long partId, Long modelYearId) {
        return compatibilityRepository.findByPartIdAndModelYearId(partId, modelYearId)
                .map(Compatibility::getStatus)
                .filter(PROCEED_STATUSES::contains)
                .isPresent();
    }
}
