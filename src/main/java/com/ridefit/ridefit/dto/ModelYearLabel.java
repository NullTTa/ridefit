package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.ModelYear;

// "2019 Super Cub 110 (JA44)"처럼, 세대/프레임 코드가 있으면 괄호로 덧붙이는 공통 라벨 포맷.
public final class ModelYearLabel {

    private ModelYearLabel() {
    }

    public static String of(ModelYear modelYear) {
        String base = modelYear.getYear() + " " + modelYear.getVehicleModel().getName();
        String code = modelYear.getChassisCode();
        return (code == null || code.isBlank()) ? base : base + " (" + code + ")";
    }
}
