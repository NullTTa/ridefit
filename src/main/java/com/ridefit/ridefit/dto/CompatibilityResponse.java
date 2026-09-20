package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.ModelYear;

public record CompatibilityResponse(
        Long id, String status, String note, PartResponse part, Long modelYearId, String modelYearLabel) {

    public static CompatibilityResponse from(Compatibility compatibility) {
        ModelYear modelYear = compatibility.getModelYear();

        return new CompatibilityResponse(
                compatibility.getId(),
                compatibility.getStatus(),
                compatibility.getNote(),
                PartResponse.from(compatibility.getPart()),
                modelYear.getId(),
                ModelYearLabel.of(modelYear));
    }
}
