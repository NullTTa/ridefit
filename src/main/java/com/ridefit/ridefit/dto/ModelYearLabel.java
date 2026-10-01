package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.ModelYear;

// "2019 Super Cub 110 (JA44)"처럼, 세대/프레임 코드가 있으면 괄호로 덧붙이는 공통 라벨 포맷.
public final class ModelYearLabel {

    private ModelYearLabel() {
    }

    public static String of(ModelYear modelYear) {
        // 연식 값이 없는 레거시 연식은 "null Super Cub 110"이 되지 않도록 차종명만 쓴다(연식을 추측해 채우지 않음).
        String name = modelYear.getVehicleModel().getName();
        String base = modelYear.getYear() == null ? name : modelYear.getYear() + " " + name;
        String code = modelYear.getChassisCode();
        return (code == null || code.isBlank()) ? base : base + " (" + code + ")";
    }
}
