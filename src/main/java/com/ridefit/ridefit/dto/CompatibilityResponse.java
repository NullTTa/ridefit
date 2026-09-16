package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.ModelYear;

public record CompatibilityResponse(Long id, String status, String note, PartResponse part, String modelYearLabel) {

    public static CompatibilityResponse from(Compatibility compatibility) {
        ModelYear modelYear = compatibility.getModelYear();
        String modelYearLabel = modelYear.getYear() + " " + modelYear.getVehicleModel().getName();

        return new CompatibilityResponse(
                compatibility.getId(),
                compatibility.getStatus(),
                compatibility.getNote(),
                PartResponse.from(compatibility.getPart()),
                modelYearLabel);
    }
}
