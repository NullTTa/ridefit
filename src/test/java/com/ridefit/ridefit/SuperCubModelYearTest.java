package com.ridefit.ridefit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.VehicleModel;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.ManufacturerRepository;
import com.ridefit.ridefit.repository.ModelYearRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.VehicleModelRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Super Cub 110 연식/형식(Honda Japan 공식 보도자료 기준)과 "연식 없는 레거시 연식" 처리.
//  - 2021 = JA44(2017.11~), 2023/2025 = JA59(2022.04~). JA71은 C125 형식이라 110에 없어야 한다.
//  - 연식 값이 없는 연식은 신규 등록/변경을 막고, 사용자용 호환 목록에서 숨긴다(데이터는 지우지 않는다).
@SpringBootTest
@AutoConfigureMockMvc
class SuperCubModelYearTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ManufacturerRepository manufacturerRepository;
    @Autowired
    private VehicleModelRepository vehicleModelRepository;
    @Autowired
    private ModelYearRepository modelYearRepository;
    @Autowired
    private CompatibilityRepository compatibilityRepository;
    @Autowired
    private PartRepository partRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private VehicleModel superCub() {
        Long hondaId = manufacturerRepository.findAll().stream()
                .filter(m -> m.getName().equals("Honda")).findFirst().orElseThrow().getId();
        return vehicleModelRepository.findByManufacturerIdAndName(hondaId, "Super Cub 110").orElseThrow();
    }

    @Test
    void 슈퍼커브_연식별_형식코드가_공식자료와_일치한다() throws Exception {
        JsonNode years = getJson("/api/vehicle-models/" + superCub().getId() + "/model-years", null);
        Map<Integer, String> codeByYear = new HashMap<>();
        for (JsonNode y : years) {
            if (!y.get("year").isNull()) codeByYear.put(y.get("year").asInt(), y.get("chassisCode").asText());
        }
        assertThat(codeByYear).containsEntry(2021, "JA44").containsEntry(2023, "JA59").containsEntry(2025, "JA59");
        assertThat(codeByYear.values()).doesNotContain("JA71");
    }

    @Test
    @Transactional
    void 연식_없는_레거시_연식은_신규_등록이_막히고_호환_목록에서_숨겨진다() throws Exception {
        VehicleModel cub = superCub();
        ModelYear legacy = modelYearRepository.save(ModelYear.builder().vehicleModel(cub).chassisCode("JA07").build());
        ModelYear dated = modelYearRepository.findByVehicleModelIdAndYear(cub.getId(), 2023).orElseThrow();
        Part part = partRepository.save(Part.builder().name("레거시 연식 테스트 부품").category("캐리어").price(1000)
                .viewCount(0).fitSelectionCount(0).build());
        compatibilityRepository.save(Compatibility.builder().part(part).modelYear(legacy).status("호환가능").build());
        compatibilityRepository.save(Compatibility.builder().part(part).modelYear(dated).status("호환가능").build());

        String token = postJson("/api/auth/signup", """
                {"email":"legacy-%d@test.dev","password":"legacy1234!","name":"레거시"}
                """.formatted(System.nanoTime()), null, 201).get("token").asText();

        // 신규 등록: 연식 없는 연식은 400, 연식 있는 연식은 정상
        postJson("/api/my-vehicles", "{\"modelYearId\":%d}".formatted(legacy.getId()), token, 400);
        long myVehicleId = postJson("/api/my-vehicles", "{\"modelYearId\":%d}".formatted(dated.getId()), token, 201)
                .get("id").asLong();
        // 연식 변경도 연식 없는 연식으로는 불가
        send(patch("/api/my-vehicles/" + myVehicleId).contentType(MediaType.APPLICATION_JSON)
                .content("{\"modelYearId\":%d}".formatted(legacy.getId())), token, 400);

        // 사용자용 호환 차량 목록에는 연식 있는 연식만
        JsonNode fitments = getJson("/api/parts/" + part.getId() + "/compatibilities", null);
        assertThat(fitments).hasSize(1);
        assertThat(fitments.get(0).get("year").asInt()).isEqualTo(2023);
        assertThat(fitments.get(0).get("chassisCode").asText()).isEqualTo("JA59");

        // 레거시 연식 자체와 그 호환 데이터는 DB에 그대로 남아 있다
        assertThat(modelYearRepository.findById(legacy.getId())).isPresent();
        assertThat(compatibilityRepository.findByPartIdAndModelYearId(part.getId(), legacy.getId())).isPresent();
    }

    private JsonNode getJson(String url, String token) throws Exception {
        return send(get(url), token, 200);
    }

    private JsonNode postJson(String url, String body, String token, int expected) throws Exception {
        return send(post(url).contentType(MediaType.APPLICATION_JSON).content(body), token, expected);
    }

    private JsonNode send(MockHttpServletRequestBuilder req, String token, int expected) throws Exception {
        if (token != null) req.header("Authorization", "Bearer " + token);
        String body = mockMvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        return body.isBlank() ? objectMapper.nullNode() : objectMapper.readTree(body);
    }
}
