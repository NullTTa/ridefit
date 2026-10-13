package com.ridefit.ridefit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.repository.PartRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 호환 근거 메모(note)가 화면까지 전달되는지 확인한다. 화면은 "호환가능 + 메모 없음"을 "호환 근거 미확인"으로 따로 보여 주므로,
// 호환 판정을 내려주는 API(부품 상세 호환 차량, 차량 상세 연식별 호환)가 메모를 빠뜨리면 미확인 데이터가 확정 호환처럼 보인다.
// 데이터는 테스트 프로필의 DataSeeder 시드(호환가능+메모 / 호환가능+메모 없음 / 브라켓필요 / 호환불가)를 그대로 쓴다.
@SpringBootTest
@AutoConfigureMockMvc
class CompatEvidenceResponseTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PartRepository partRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void 부품_상세_호환_차량에_상태별_근거_메모가_그대로_내려온다() throws Exception {
        // 머플러: 2021 JA44 / 2023 JA59 모두 "호환가능" + 메모 있음
        JsonNode muffler = fitments("순정 스타일 스테인리스 머플러 (Cub 110)");
        assertThat(muffler).isNotEmpty();
        muffler.forEach(f -> {
            assertThat(f.get("status").asText()).isEqualTo("호환가능");
            assertThat(f.get("note").asText()).isEqualTo("정품 브라켓 포함");
        });

        // 리어 캐리어: 2023은 "호환가능" + 메모 없음(근거 미확인), 2021은 "브라켓필요" + 메모
        JsonNode carrier = fitments("리어 확장 캐리어 (Cub 110)");
        JsonNode y2023 = byYear(carrier, 2023);
        assertThat(y2023.get("status").asText()).isEqualTo("호환가능");
        assertThat(y2023.has("note")).isTrue();
        assertThat(y2023.get("note").isNull()).isTrue();
        JsonNode y2021 = byYear(carrier, 2021);
        assertThat(y2021.get("status").asText()).isEqualTo("브라켓필요");
        assertThat(y2021.get("note").asText()).isEqualTo("별도 서브 브라켓 구매 필요");

        // 호환불가도 근거 메모와 함께 내려온다(목록에서 숨기지 않고 상태 그대로)
        JsonNode oldMuffler = fitments("구형 머플러 (2018 PCX 호환, 신형 불가)");
        assertThat(oldMuffler).isNotEmpty();
        oldMuffler.forEach(f -> {
            assertThat(f.get("status").asText()).isEqualTo("호환불가");
            assertThat(f.get("note").asText()).isNotBlank();
        });
    }

    @Test
    void 차량_상세_연식별_호환에도_근거_메모가_포함된다() throws Exception {
        Part carrier = partRepository.findByName("리어 확장 캐리어 (Cub 110)").orElseThrow();
        long vehicleModelId = fitments("리어 확장 캐리어 (Cub 110)").get(0).get("vehicleModelId").asLong();

        JsonNode parts = getJson("/api/vehicles/" + vehicleModelId + "/parts");
        JsonNode row = StreamSupport.stream(parts.spliterator(), false)
                .filter(p -> p.get("partId").asLong() == carrier.getId())
                .findFirst().orElseThrow();
        JsonNode y2023 = byYear(row.get("years"), 2023);
        assertThat(y2023.get("status").asText()).isEqualTo("호환가능");
        assertThat(y2023.has("note")).isTrue();
        assertThat(y2023.get("note").isNull()).isTrue();
        JsonNode y2021 = byYear(row.get("years"), 2021);
        assertThat(y2021.get("status").asText()).isEqualTo("브라켓필요");
        assertThat(y2021.get("note").asText()).isEqualTo("별도 서브 브라켓 구매 필요");
    }

    private JsonNode fitments(String partName) throws Exception {
        Part part = partRepository.findByName(partName).orElseThrow();
        return getJson("/api/parts/" + part.getId() + "/compatibilities");
    }

    private static JsonNode byYear(JsonNode rows, int year) {
        return StreamSupport.stream(rows.spliterator(), false)
                .filter(r -> !r.get("year").isNull() && r.get("year").asInt() == year)
                .findFirst().orElseThrow(() -> new AssertionError(year + "년식 행이 없음: " + rows));
    }

    private JsonNode getJson(String url) throws Exception {
        String body = mockMvc.perform(get(url)).andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return objectMapper.readTree(body);
    }
}
