package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.PartConflict;
import com.ridefit.ridefit.repository.PartConflictRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PartConflictControllerTest {

    @Mock
    private PartConflictRepository partConflictRepository;

    private Part partWithId(long id, String name) {
        return Part.builder().id(id).name(name).build();
    }

    @Test
    void 선택한_부품_둘_다에_해당하는_충돌만_반환한다() {
        Part muffler = partWithId(1L, "머플러");
        Part carrier = partWithId(2L, "캐리어");
        Part screen = partWithId(3L, "스크린");

        PartConflict relevant = PartConflict.builder().id(100L).partA(muffler).partB(carrier).reason("간섭").build();
        // 서드파티(screen)가 끼어있는 충돌 레코드는, 선택한 목록에 partB(screen)가 없으므로 결과에서 제외되어야 한다.
        PartConflict irrelevant = PartConflict.builder().id(101L).partA(muffler).partB(screen).reason("간섭2").build();

        when(partConflictRepository.findByPartIdsInvolved(List.of(1L, 2L)))
                .thenReturn(List.of(relevant, irrelevant));

        PartConflictController controller = new PartConflictController(partConflictRepository);
        var result = controller.checkConflicts(new PartConflictController.CheckRequest(List.of(1L, 2L)));

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo(100L);
    }

    @Test
    void 충돌이_없으면_빈_목록을_반환한다() {
        when(partConflictRepository.findByPartIdsInvolved(List.of(5L, 6L))).thenReturn(List.of());

        PartConflictController controller = new PartConflictController(partConflictRepository);
        var result = controller.checkConflicts(new PartConflictController.CheckRequest(List.of(5L, 6L)));

        assertThat(result).isEmpty();
    }
}
