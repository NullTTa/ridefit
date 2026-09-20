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

    // 관련 영상(유튜브 링크). 게시글 작성자가 등록.
    private String videoUrl;

    // 장착 부품에 대한 평점(1~5). installedPart가 있을 때만 선택적으로 입력. AI나 시드가
    // 임의로 채우지 않고, 실제 작성자가 입력했을 때만 값이 들어간다.
    private Integer rating;

    // 커뮤니티 섹션(PostCategory 이름: VETERAN / NEWBIE / FREE)과 그 안의 주제(topic).
    // 기존 게시글은 null일 수 있어서 응답에서는 null을 FREE로 취급한다.
    private String category;

    private String topic;

    // 상세 화면을 열 때마다 +1 (POST /api/posts/{id}/view). 화면용 숫자가 아니라 실제 카운터다.
    @Builder.Default
    private int viewCount = 0;

    // PostLike 행 개수와 같은 값을 유지하는 비정규화 카운터 (추천순 정렬을 위해 둠).
    @Builder.Default
    private int likeCount = 0;
}
