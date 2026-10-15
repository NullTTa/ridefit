package com.ridefit.ridefit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ridefit.ridefit.domain.Member;
import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.RecentPartCheckRepository;
import com.ridefit.ridefit.service.PartPopularityService;
import com.ridefit.ridefit.service.RecentPartCheckRecorder;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.orm.jpa.JpaSystemException;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 부품 상세 조회수(원자적 +1, 차량 확인 뒤에만 기록)와 호환성 확인 기록(판정과 분리, 실패해도 판정은 200)을 확인한다.
// MariaDB 11.8 스냅샷 격리 오류(1020) 자체는 H2에서 재현되지 않으므로, 기록 저장 실패는 기록 빈이 예외를 던지게 해서 확인한다.
@SpringBootTest
@AutoConfigureMockMvc
class PartViewAndCheckTest {

    private static final String MUFFLER = "순정 스타일 스테인리스 머플러 (Cub 110)";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private PartRepository partRepository;
    @Autowired
    private MemberRepository memberRepository;
    @Autowired
    private MyVehicleRepository myVehicleRepository;
    @Autowired
    private CompatibilityRepository compatibilityRepository;
    @Autowired
    private RecentPartCheckRepository recentPartCheckRepository;
    @Autowired
    private PartPopularityService partPopularityService;
    @MockitoSpyBean
    private RecentPartCheckRecorder recentPartCheckRecorder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void 동시에_조회해도_조회수가_빠지지_않고_장착_시도_수와_섞이지_않는다() throws Exception {
        Part part = partRepository.findByName(MUFFLER).orElseThrow();
        int views = part.getViewCount();
        int fits = part.getFitSelectionCount();

        runConcurrently(30, () -> partPopularityService.recordView(part.getId()));
        Part afterViews = partRepository.findById(part.getId()).orElseThrow();
        assertThat(afterViews.getViewCount()).isEqualTo(views + 30);
        assertThat(afterViews.getFitSelectionCount()).isEqualTo(fits);

        runConcurrently(12, () -> partPopularityService.recordFitSelection(part.getId()));
        Part afterFits = partRepository.findById(part.getId()).orElseThrow();
        assertThat(afterFits.getFitSelectionCount()).isEqualTo(fits + 12);
        assertThat(afterFits.getViewCount()).isEqualTo(views + 30);
    }

    @Test
    void 부품_상세는_차량_확인이_통과한_요청만_조회수로_센다() throws Exception {
        Part part = partRepository.findByName(MUFFLER).orElseThrow();
        String userToken = login("user@ridefit.dev", "user1234!");
        MyVehicle mine = vehicleOf("user@ridefit.dev");
        MyVehicle others = vehicleOf("admin@ridefit.dev");
        int before = partRepository.findById(part.getId()).orElseThrow().getViewCount();

        // 내 차량 기준 상세 = 1번 기록, 응답 조회수 = DB에 저장된 값
        JsonNode detail = objectMapper.readTree(mockMvc.perform(get("/api/parts/" + part.getId()).param("myVehicleId", mine.getId().toString())
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        int afterOne = partRepository.findById(part.getId()).orElseThrow().getViewCount();
        assertThat(afterOne).isEqualTo(before + 1);
        assertThat(detail.get("stats").get("viewCount").asLong()).isEqualTo(afterOne);

        // 다른 회원 차량(403) / 없는 차량(404) / 없는 부품(404)은 조회로 세지 않는다
        mockMvc.perform(get("/api/parts/" + part.getId()).param("myVehicleId", others.getId().toString())
                .header("Authorization", "Bearer " + userToken)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/parts/" + part.getId()).param("myVehicleId", "999999")
                .header("Authorization", "Bearer " + userToken)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/parts/999999")).andExpect(status().isNotFound());
        assertThat(partRepository.findById(part.getId()).orElseThrow().getViewCount()).isEqualTo(afterOne);
    }

    @Test
    void 호환성_확인은_기록에_성공하면_한_건_남기고_실패해도_판정을_200으로_돌려준다() throws Exception {
        Part part = partRepository.findByName(MUFFLER).orElseThrow();
        String userToken = login("user@ridefit.dev", "user1234!");
        Member user = memberRepository.findByEmail("user@ridefit.dev").orElseThrow();
        MyVehicle mine = vehicleOf("user@ridefit.dev");
        String expected = compatibilityRepository.findByPartIdAndModelYearId(part.getId(), mine.getModelYear().getId())
                .map(c -> c.getStatus()).orElse("정보없음");
        long before = countChecks(user.getId());

        // 1) 기록 성공
        JsonNode ok = check(part.getId(), mine.getId(), userToken);
        assertThat(ok.get("status").asText()).isEqualTo(expected);
        assertThat(countChecks(user.getId())).isEqualTo(before + 1);

        // 2) 기록 실패(예: MariaDB 1020) - 판정은 같은 결과로 200, 기록은 늘지 않음
        try {
            doThrow(new JpaSystemException(new RuntimeException("Record has changed since last read in table 'recent_part_check'")))
                    .when(recentPartCheckRecorder).record(anyLong(), anyLong(), anyLong(), any());
            JsonNode failed = check(part.getId(), mine.getId(), userToken);
            assertThat(failed.get("status").asText()).isEqualTo(expected);
            assertThat(failed.get("proceedAllowed").asBoolean()).isEqualTo(ok.get("proceedAllowed").asBoolean());
            assertThat(failed.get("note").asText(null)).isEqualTo(ok.get("note").asText(null));
            assertThat(countChecks(user.getId())).isEqualTo(before + 1);
        } finally {
            Mockito.reset(recentPartCheckRecorder);
        }

        // 3) 판정 자체의 오류(남의 차량)는 그대로 403
        mockMvc.perform(get("/api/parts/" + part.getId() + "/check").param("myVehicleId", vehicleOf("admin@ridefit.dev").getId().toString())
                .header("Authorization", "Bearer " + userToken)).andExpect(status().isForbidden());
    }

    private JsonNode check(Long partId, Long myVehicleId, String token) throws Exception {
        return objectMapper.readTree(mockMvc.perform(get("/api/parts/" + partId + "/check").param("myVehicleId", myVehicleId.toString())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private long countChecks(Long memberId) {
        return recentPartCheckRepository.findAll().stream().filter(r -> r.getMember().getId().equals(memberId)).count();
    }

    // 그 회원의 Super Cub 110 차량(없으면 시드 연식으로 하나 만든다)
    private MyVehicle vehicleOf(String email) {
        Member member = memberRepository.findByEmail(email).orElseThrow();
        Part muffler = partRepository.findByName(MUFFLER).orElseThrow();
        return myVehicleRepository.findByMemberId(member.getId()).stream().findFirst()
                .orElseGet(() -> myVehicleRepository.save(MyVehicle.builder().member(member)
                        .modelYear(compatibilityRepository.findAll().stream()
                                .filter(c -> c.getPart().getId().equals(muffler.getId()))
                                .findFirst().orElseThrow().getModelYear())
                        .build()));
    }

    private void runConcurrently(int n, Runnable task) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(Math.min(n, 10));
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            futures.add(pool.submit(() -> {
                start.await();
                task.run();
                return null;
            }));
        }
        start.countDown();
        for (Future<?> f : futures) f.get(30, TimeUnit.SECONDS);
        pool.shutdown();
    }

    private String login(String email, String password) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("token").asText();
    }
}
