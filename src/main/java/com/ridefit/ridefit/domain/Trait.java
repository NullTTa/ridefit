package com.ridefit.ridefit.domain;

import java.util.List;

// 성향 테스트 질문과 차종 프로필이 함께 쓰는 성향 축. 키(name)는 DB(vehicle_profile_trait.trait)에도 저장된다.
public enum Trait {
    COMMUTE("출퇴근·생활"),
    TOURING("장거리·투어링"),
    DESIGN("디자인"),
    PERFORMANCE("속도·성능"),
    COMFORT("편안함"),
    ECONOMY("유지비"),
    TUNING("튜닝·커스텀"),
    CITY("도심 기동성");

    private final String label;

    Trait(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public static List<Trait> all() {
        return List.of(values());
    }
}
