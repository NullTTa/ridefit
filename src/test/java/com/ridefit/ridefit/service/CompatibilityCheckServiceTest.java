package com.ridefit.ridefit.service;

import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.RecentPartCheckRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
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
    private RecentPartCheckRepository recentPartCheckRepository;

    private CompatibilityCheckService service() {
        return new CompatibilityCheckService(partRepository, myVehicleRepository, compatibilityRepository,
                recentPartCheckRepository);
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
