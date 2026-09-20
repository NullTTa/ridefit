package com.ridefit.ridefit.domain;

import java.util.List;
import java.util.Optional;

// 커뮤니티 섹션 정의. 섹션 이름/설명/주제 목록은 여기 한 곳에서만 관리하고, 프론트는 /api/posts/categories로 받아서 쓴다.
public enum PostCategory {

    VETERAN("고인물 소통공간", "경험 많은 라이더가 노하우와 실패담을 나누는 곳",
            List.of("튜닝 경험", "정비 경험", "장거리 주행 후기", "차량 세팅", "추천 부품", "실패 경험", "초보자에게 팁")),
    NEWBIE("뉴비 질문공간", "처음이라 막막한 것들, 부담 없이 물어보세요",
            List.of("소모품·오일", "부품 호환 질문", "구매·입문", "이 증상 정상인가요?", "투어 준비", "기타 질문")),
    FREE("자유게시판", "일상, 라이딩, 여행, 사진, 차량 자랑까지 자유롭게",
            List.of("일상", "라이딩", "여행", "사진", "차량 자랑", "잡담"));

    private final String label;
    private final String description;
    private final List<String> topics;

    PostCategory(String label, String description, List<String> topics) {
        this.label = label;
        this.description = description;
        this.topics = topics;
    }

    public String label() {
        return label;
    }

    public String description() {
        return description;
    }

    public List<String> topics() {
        return topics;
    }

    public static Optional<PostCategory> parse(String value) {
        if (value == null || value.isBlank()) {
            return Optional.empty();
        }
        for (PostCategory c : values()) {
            if (c.name().equalsIgnoreCase(value.trim())) {
                return Optional.of(c);
            }
        }
        return Optional.empty();
    }
}
