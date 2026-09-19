package com.ridefit.ridefit.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Part {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String category;

    private String name;

    private Integer price;

    private String imageUrl;

    // null이면 관리자/시드로 등록된 카탈로그 부품, 값이 있으면 사용자가 링크로 가져온 커스텀 부품.
    @Column(name = "source_url")
    private String sourceUrl;
}
