package com.ridefit.ridefit.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

// 하나의 Part(부품)에 대해 사용자가 등록해둔 여러 판매처 링크. "실시간 최저가 자동 검색"이 아니라
// 사용자가 직접 등록한 링크들끼리 가격을 비교하는 용도임을 분명히 한다.
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SellerListing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    private Part part;

    private String sellerName;

    // 판매처 페이지의 실제 상품명(판매처마다 표기가 달라 Part.name과 별도로 보관). 없으면 null.
    private String productName;

    // 확인된 가격만 넣는다. 확인하지 못했으면 null("가격 확인 필요")이며 0으로 채우지 않는다.
    private Integer price;

    // 화면에 표시할 이미지. 우리 서버에 저장했으면 "/uploads/parts/...", 저장하지 못했으면 null.
    private String thumbnailUrl;

    // 판매처가 제공한 원본 이미지 URL(출처 보존용).
    private String originalImageUrl;

    // 판매처 상품 페이지 URL.
    private String sourceUrl;

    // 판매처의 상품 ID(JSON-LD sku/productID 등에서 확인된 경우에만).
    private String externalProductId;

    private LocalDateTime createdAt;

    // 가격/정보를 마지막으로 확인한 시각. 확인일을 모르는 예전 데이터는 null.
    private LocalDateTime checkedAt;

    // RFC 2606 예약 도메인(.test)은 실제로 존재할 수 없는 주소다. 초기 시드의 예시 판매처가 여기에 해당하므로
    // 화면에서 "예시 데이터"로 구분하고 최저가 비교에서 제외한다(데이터 자체는 지우지 않는다).
    public boolean isSample() {
        if (sourceUrl == null) return false;
        try {
            String host = java.net.URI.create(sourceUrl).getHost();
            return host != null && (host.endsWith(".test") || host.equals("test"));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
