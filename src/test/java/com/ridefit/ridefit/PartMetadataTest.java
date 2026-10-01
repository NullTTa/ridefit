package com.ridefit.ridefit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.PartType;
import com.ridefit.ridefit.repository.PartRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 부품 메타데이터(품번/브랜드/구분): 값이 있으면 그대로, 없으면 null로 내려간다(서버가 임의로 채우지 않는다).
@SpringBootTest
@AutoConfigureMockMvc
class PartMetadataTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private PartRepository partRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @Transactional
    void 부품_상세와_목록에_메타데이터가_그대로_내려간다() throws Exception {
        Part known = partRepository.save(Part.builder().name("메타 테스트 캐리어").category("캐리어").price(10000)
                .partNumber("80-539-11530").brand("KITACO").partType(PartType.AFTERMARKET).build());
        Part unknown = partRepository.save(Part.builder().name("메타 없는 부품").category("캐리어").price(10000).build());

        JsonNode k = getJson("/api/parts/" + known.getId());
        assertThat(k.get("partNumber").asText()).isEqualTo("80-539-11530");
        assertThat(k.get("brand").asText()).isEqualTo("KITACO");
        assertThat(k.get("partType").asText()).isEqualTo("AFTERMARKET");

        JsonNode u = getJson("/api/parts/" + unknown.getId());
        assertThat(u.get("partNumber").isNull()).isTrue();
        assertThat(u.get("brand").isNull()).isTrue();
        assertThat(u.get("partType").isNull()).isTrue();

        JsonNode list = getJson("/api/parts?category=캐리어");
        JsonNode fromList = null;
        for (JsonNode p : list) if (p.get("id").asLong() == known.getId()) fromList = p;
        assertThat(fromList).isNotNull();
        assertThat(fromList.get("brand").asText()).isEqualTo("KITACO");
    }

    private JsonNode getJson(String url) throws Exception {
        String body = mockMvc.perform(get(url)).andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readTree(body);
    }
}
