package com.ridefit.ridefit.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

// 커뮤니티 게시글. installedPart + compatibleFeedback은 "이 부품을 이 차량에 달아봤는데
// 맞았다/안맞았다"는 사용자 후기로, 나중에 Compatibility 데이터를 보완하는 데 쓰일 수 있도록
// 구조만 만들어둔 것이다 (이번 범위에서 자동 반영 로직은 없음).
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    private Member author;

    private String title;

    @Lob
    private String content;

    @ManyToOne(fetch = FetchType.LAZY)
    private Part installedPart;

    // "MATCHED"(맞았어요) | "NOT_MATCHED"(안맞았어요) | null(해당 없음)
    private String compatibleFeedback;

    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    private MyVehicle myVehicle;

    // 실제 장착 사진 (POST /api/uploads로 먼저 올린 뒤 받은 URL을 저장).
    private String imageUrl;
}
