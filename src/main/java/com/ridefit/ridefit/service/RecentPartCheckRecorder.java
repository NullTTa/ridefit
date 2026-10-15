package com.ridefit.ridefit.service;

import com.ridefit.ridefit.domain.RecentPartCheck;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.RecentPartCheckRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

// 마이페이지 "최근 확인한 부품" 기록 저장 - 호환성 판정(CompatibilityCheckService)과 트랜잭션을 분리한다.
//  - REQUIRES_NEW: 판정 트랜잭션과 따로 커밋/롤백된다(기록이 실패해도 판정 응답은 영향 없음).
//  - getReferenceById: 회원/부품/차량을 다시 읽지 않고 id만으로 INSERT한다. 이 트랜잭션의 첫 문장이 INSERT라 읽기 스냅샷이 없어서,
//    그 사이 같은 부품의 조회수가 바뀌어도 MariaDB 11.8 스냅샷 격리 오류(1020, 외래키 확인 중 "Record has changed since last read")가 나지 않는다.
// 판정 쪽에서 별도 빈으로 호출해야 프록시를 거쳐 새 트랜잭션이 열린다(같은 클래스 안 호출은 트랜잭션이 적용되지 않음).
@Component
@RequiredArgsConstructor
public class RecentPartCheckRecorder {

    private final RecentPartCheckRepository recentPartCheckRepository;
    private final MemberRepository memberRepository;
    private final PartRepository partRepository;
    private final MyVehicleRepository myVehicleRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(Long memberId, Long partId, Long myVehicleId, String status) {
        recentPartCheckRepository.save(RecentPartCheck.builder()
                .member(memberRepository.getReferenceById(memberId))
                .part(partRepository.getReferenceById(partId))
                .myVehicle(myVehicleRepository.getReferenceById(myVehicleId))
                .status(status)
                .checkedAt(LocalDateTime.now())
                .build());
    }
}
