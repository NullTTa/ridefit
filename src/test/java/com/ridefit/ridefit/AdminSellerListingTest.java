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

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 관리자 "판매처 가격 관리": 추가 -> 부품 카드 요약(listings-summary)에 바로 반영 -> 수정 -> 삭제.
// http(s)가 아닌 주소/검색 결과 주소/미래 확인일은 거절, 일반 회원은 403.
@SpringBootTest
@AutoConfigureMockMvc
class AdminSellerListingTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void 관리자가_판매처_가격을_추가_수정_삭제하면_카드_요약에_바로_반영된다() throws Exception {
        String admin = send(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"admin@ridefit.dev\",\"password\":\"admin1234!\"}"), null, 200).get("token").asText();
        long partId = send(post("/api/parts").contentType(MediaType.APPLICATION_JSON).content("""
                {"name":"관리자 가격 테스트 %d","price":10000,"category":"머플러","imageUrl":null,"sourceUrl":null,"modelYearId":null,"vehicleModelId":null}
                """.formatted(System.nanoTime())), admin, 201).get("id").asLong();
        String today = LocalDate.now().toString();

        JsonNode created = send(post("/api/admin/seller-listings").contentType(MediaType.APPLICATION_JSON).content("""
                {"partId":%d,"sellerName":"쿠팡","price":189000,"sourceUrl":"https://www.coupang.com/vp/products/123456","checkedAt":"%s"}
                """.formatted(partId, today)), admin, 201);
        long id = created.get("id").asLong();
        send(post("/api/admin/seller-listings").contentType(MediaType.APPLICATION_JSON).content("""
                {"partId":%d,"sellerName":"G마켓","price":195000,"sourceUrl":null,"checkedAt":"%s"}
                """.formatted(partId, today)), admin, 201);

        // 카드 요약: 2곳, 가격순, 최저 189000, URL 없는 판매처는 링크 없음
        JsonNode summary = send(get("/api/parts/listings-summary?partIds=" + partId), null, 200).get(0);
        assertThat(summary.get("sellerCount").asInt()).isEqualTo(2);
        assertThat(summary.get("lowestPrice").asInt()).isEqualTo(189000);
        assertThat(summary.get("sellers").get(0).get("sellerName").asText()).isEqualTo("쿠팡");
        assertThat(summary.get("sellers").get(0).get("productUrl").asText()).isEqualTo("https://www.coupang.com/vp/products/123456");
        assertThat(summary.get("sellers").get(1).get("productUrl").isNull()).isTrue();

        // 목록/판매처 이름 선택지
        JsonNode rows = send(get("/api/admin/seller-listings?partId=" + partId), admin, 200);
        assertThat(rows).hasSize(2);
        assertThat(send(get("/api/admin/seller-listings/sellers"), admin, 200).toString()).contains("쿠팡").contains("G마켓");

        // 수정 -> 요약 최저가가 바뀐다
        send(put("/api/admin/seller-listings/" + id).contentType(MediaType.APPLICATION_JSON).content("""
                {"partId":%d,"sellerName":"쿠팡","price":199000,"sourceUrl":"https://www.coupang.com/vp/products/123456","checkedAt":"%s"}
                """.formatted(partId, today)), admin, 200);
        assertThat(send(get("/api/parts/listings-summary?partIds=" + partId), null, 200).get(0).get("lowestPrice").asInt()).isEqualTo(195000);

        // 잘못된 입력은 거절
        String bad = "{\"partId\":%d,\"sellerName\":\"x\",\"price\":1000,\"sourceUrl\":\"%s\",\"checkedAt\":\"%s\"}";
        send(post("/api/admin/seller-listings").contentType(MediaType.APPLICATION_JSON).content(bad.formatted(partId, "ftp://shop/1", today)), admin, 400);
        send(post("/api/admin/seller-listings").contentType(MediaType.APPLICATION_JSON).content(bad.formatted(partId, "https://www.coupang.com/np/search?q=muffler", today)), admin, 400);
        send(post("/api/admin/seller-listings").contentType(MediaType.APPLICATION_JSON).content(bad.formatted(partId, "https://browse.gmarket.co.kr/search?keyword=muffler", today)), admin, 400);
        send(post("/api/admin/seller-listings").contentType(MediaType.APPLICATION_JSON).content(bad.formatted(partId, "https://shop.example.com/p/1", LocalDate.now().plusDays(1))), admin, 400);
        send(post("/api/admin/seller-listings").contentType(MediaType.APPLICATION_JSON).content("""
                {"partId":%d,"sellerName":"x","price":0,"sourceUrl":null,"checkedAt":"%s"}
                """.formatted(partId, today)), admin, 400);
        // 같은 부품 + 같은 상품 URL 중복은 409
        send(post("/api/admin/seller-listings").contentType(MediaType.APPLICATION_JSON).content("""
                {"partId":%d,"sellerName":"쿠팡","price":1,"sourceUrl":"https://www.coupang.com/vp/products/123456","checkedAt":"%s"}
                """.formatted(partId, today)), admin, 409);

        // 삭제
        send(delete("/api/admin/seller-listings/" + id), admin, 204);
        assertThat(send(get("/api/parts/listings-summary?partIds=" + partId), null, 200).get(0).get("sellerCount").asInt()).isEqualTo(1);

        // 일반 회원은 접근 불가
        String user = send(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content("""
                {"email":"seller-user-%d@test.dev","password":"user1234!","name":"일반"}
                """.formatted(System.nanoTime())), null, 201).get("token").asText();
        send(get("/api/admin/seller-listings"), user, 403);
    }

    private JsonNode send(MockHttpServletRequestBuilder req, String token, int expected) throws Exception {
        if (token != null) req.header("Authorization", "Bearer " + token);
        String body = mockMvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return body.isBlank() ? objectMapper.nullNode() : objectMapper.readTree(body);
    }
}
