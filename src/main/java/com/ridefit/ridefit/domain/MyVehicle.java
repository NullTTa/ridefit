package com.ridefit.ridefit.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.FetchType;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
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
public class MyVehicle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    private ModelYear modelYear;

    // 사용자가 직접 붙인 별명("내 애마" 같은). 없으면 프론트가 모델명을 그대로 보여준다.
    private String nickname;

    // 사용자가 직접 올린 내 차량 실사진. 없으면 프론트가 모델의 대표 이미지를 보여준다.
    private String photoUrl;
}
