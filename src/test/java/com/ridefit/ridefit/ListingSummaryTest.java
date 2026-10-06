package com.ridefit.ridefit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 부품 카드 "판매처 가격 미리보기" 요약: 등록된 실제 판매처만(예시 .test 제외), 가격 오름차순 최대 3곳 + 나머지 개수,
// "확인된 가격 중 최저"는 가격 확인된 실제 판매처 2곳 이상일 때만, 링크는 http(s) 상품 주소일 때만.
@SpringBootTest
@AutoConfigureMockMvc
class ListingSummaryTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void 판매처_요약은_실제_판매처만_가격순_최대_3곳과_나머지_개수를_돌려준다() throws Exception {
        String token = send(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content("""
                {"email":"listing-%d@test.dev","password":"list1234!","name":"판매처테스트"}
                """.formatted(System.nanoTime())), null, 201).get("token").asText();
        long many = createPart("판매처 많은 부품", token);
        long single = createPart("판매처 하나 부품", token);
        long none = createPart("판매처 없는 부품", token);

        addListing(many, "판매처C", 30000, "https://shop-c.example.com/products/3", token);
        addListing(many, "판매처A", 10000, "https://shop-a.example.com/products/1", token);
        addListing(many, "판매처B", 20000, "https://shop-b.example.com/products/2", token);
        addListing(many, "판매처D", 40000, "https://shop-d.example.com/products/4", token);
        addListing(many, "예시 판매처", 5000, "https://sample.test/item/1", token);      // 예시 - 제외(최저가도 아님)
        addListing(single, "단독 판매처", 15000, "ftp://not-a-product-link/1", token);  // http(s) 아님 - 링크 없음

        JsonNode rows = send(get("/api/parts/listings-summary?partIds=%d,%d,%d".formatted(many, single, none)), null, 200);
        assertThat(rows).hasSize(3);
        JsonNode m = byPart(rows, many), s = byPart(rows, single), n = byPart(rows, none);

        assertThat(m.get("sellerCount").asInt()).isEqualTo(4);
        assertThat(m.get("lowestPrice").asInt()).isEqualTo(10000);
        assertThat(m.get("moreSellers").asInt()).isEqualTo(1);
        assertThat(m.get("sellers")).hasSize(3);
        assertThat(m.get("sellers").get(0).get("sellerName").asText()).isEqualTo("판매처A");
        assertThat(m.get("sellers").get(1).get("price").asInt()).isEqualTo(20000);
        assertThat(m.get("sellers").get(0).get("productUrl").asText()).isEqualTo("https://shop-a.example.com/products/1");
        assertThat(m.get("latestCheckedAt").isNull()).isFalse();

        assertThat(s.get("sellerCount").asInt()).isEqualTo(1);
        assertThat(s.get("lowestPrice").isNull()).isTrue();          // 비교 대상이 1곳뿐이면 "최저" 없음
        assertThat(s.get("sellers").get(0).get("productUrl").isNull()).isTrue();

        assertThat(n.get("sellerCount").asInt()).isZero();
        assertThat(n.get("sellers")).isEmpty();
        assertThat(n.get("lowestPrice").isNull()).isTrue();
    }

    private long createPart(String name, String token) throws Exception {
        return send(post("/api/parts").contentType(MediaType.APPLICATION_JSON).content("""
                {"name":"%s %d","price":10000,"category":"캐리어","imageUrl":null,"sourceUrl":null,"modelYearId":null,"vehicleModelId":null}
                """.formatted(name, System.nanoTime())), token, 201).get("id").asLong();
    }

    private void addListing(long partId, String seller, int price, String url, String token) throws Exception {
        send(post("/api/parts/" + partId + "/listings").contentType(MediaType.APPLICATION_JSON).content("""
                {"sellerName":"%s","price":%d,"thumbnailUrl":null,"sourceUrl":"%s","productName":null,"externalProductId":null}
                """.formatted(seller, price, url)), token, 201);
    }

    private static JsonNode byPart(JsonNode rows, long partId) {
        for (JsonNode r : rows) if (r.get("partId").asLong() == partId) return r;
        throw new AssertionError("no summary for " + partId);
    }

    private JsonNode send(MockHttpServletRequestBuilder req, String token, int expected) throws Exception {
        if (token != null) req.header("Authorization", "Bearer " + token);
        String body = mockMvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return body.isBlank() ? objectMapper.nullNode() : objectMapper.readTree(body);
    }
}
