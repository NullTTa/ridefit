package com.ridefit.ridefit.service;

import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.Member;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.dto.CompatibilityCheckResponse;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.PartRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CompatibilityCheckServiceTest {

    @Mock
    private PartRepository partRepository;
    @Mock
    private MyVehicleRepository myVehicleRepository;
    @Mock
    private CompatibilityRepository compatibilityRepository;
    @Mock
    private RecentPartCheckRecorder recentPartCheckRecorder;

    private CompatibilityCheckService service() {
        return new CompatibilityCheckService(partRepository, myVehicleRepository, compatibilityRepository,
                recentPartCheckRecorder);
    }

    // 부품 1 / 회원 7의 차량 3(연식 10)에 "호환가능 + 메모" 호환 데이터가 있는 상태
    private void givenCompatiblePart() {
        when(partRepository.findById(1L)).thenReturn(Optional.of(Part.builder().id(1L).name("머플러").category("머플러").build()));
        MyVehicle vehicle = MyVehicle.builder().id(3L).member(Member.builder().id(7L).build()).modelYear(ModelYear.builder().id(10L).build()).build();
        when(myVehicleRepository.findById(3L)).thenReturn(Optional.of(vehicle));
        when(compatibilityRepository.findByPartIdAndModelYearId(1L, 10L))
                .thenReturn(Optional.of(Compatibility.builder().status("호환가능").note("정품 브라켓 포함").build()));
    }

    @Test
    void 판정이_끝나면_최근_확인_기록을_저장한다() {
        givenCompatiblePart();

        CompatibilityCheckResponse res = service().check(1L, 3L, 7L);

        assertThat(res.status()).isEqualTo("호환가능");
        assertThat(res.proceedAllowed()).isTrue();
        verify(recentPartCheckRecorder).record(7L, 1L, 3L, "호환가능");
    }

    @Test
    void 기록_저장이_실패해도_판정_결과는_그대로_반환한다() {
        givenCompatiblePart();
        // MariaDB 11.8 스냅샷 격리 충돌(1020) 같은 저장 실패
        doThrow(new org.springframework.orm.jpa.JpaSystemException(new RuntimeException("Record has changed since last read in table 'recent_part_check'")))
                .when(recentPartCheckRecorder).record(anyLong(), anyLong(), anyLong(), any());

        CompatibilityCheckResponse res = service().check(1L, 3L, 7L);

        assertThat(res.status()).isEqualTo("호환가능");
        assertThat(res.proceedAllowed()).isTrue();
        assertThat(res.note()).isEqualTo("정품 브라켓 포함");
    }

    @Test
    void 호환가능_상태면_다음_단계로_진행할_수_있다() {
        Compatibility compatibility = Compatibility.builder().status("호환가능").build();
        when(compatibilityRepository.findByPartIdAndModelYearId(1L, 10L)).thenReturn(Optional.of(compatibility));

        assertThat(service().isProceedAllowed(1L, 10L)).isTrue();
    }

    @Test
    void 브라켓필요_상태도_다음_단계로_진행할_수_있다() {
        Compatibility compatibility = Compatibility.builder().status("브라켓필요").build();
        when(compatibilityRepository.findByPartIdAndModelYearId(1L, 10L)).thenReturn(Optional.of(compatibility));

        assertThat(service().isProceedAllowed(1L, 10L)).isTrue();
    }

    @Test
    void 호환불가_상태면_다음_단계로_진행할_수_없다() {
        Compatibility compatibility = Compatibility.builder().status("호환불가").build();
        when(compatibilityRepository.findByPartIdAndModelYearId(1L, 10L)).thenReturn(Optional.of(compatibility));

        assertThat(service().isProceedAllowed(1L, 10L)).isFalse();
    }

    @Test
    void 호환_레코드가_없으면_다음_단계로_진행할_수_없다() {
        when(compatibilityRepository.findByPartIdAndModelYearId(1L, 10L)).thenReturn(Optional.empty());

        assertThat(service().isProceedAllowed(1L, 10L)).isFalse();
    }
}
