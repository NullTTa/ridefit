package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.ModelYear;

import java.util.Comparator;

// 부품 하나가 호환 등록된 차량(차종 + 연식 + 세대 코드) 한 건. compatibility/model_year에 저장된 값 그대로다.
// year가 null이면 연식 값이 없는 레거시 연식이다(추측해서 채우지 않는다).
public record PartFitmentResponse(
        Long modelYearId, Long vehicleModelId, String manufacturerName, String vehicleModelName,
        Integer year, String chassisCode, String status, String note) {

    // 제조사 -> 차종 -> 연식(연식 없는 레거시는 맨 뒤) 순.
    public static final Comparator<PartFitmentResponse> ORDER = Comparator
            .comparing(PartFitmentResponse::manufacturerName, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(PartFitmentResponse::vehicleModelName, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(PartFitmentResponse::year, Comparator.nullsLast(Comparator.naturalOrder()));

    public static PartFitmentResponse from(Compatibility c) {
        ModelYear y = c.getModelYear();
        var model = y.getVehicleModel();
        return new PartFitmentResponse(
                y.getId(), model.getId(), model.getManufacturer().getName(), model.getName(),
                y.getYear(), y.getChassisCode(), c.getStatus(), c.getNote());
    }
}
