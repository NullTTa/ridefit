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

    private Integer price;

    private String thumbnailUrl;

    private String sourceUrl;

    private LocalDateTime createdAt;
}
