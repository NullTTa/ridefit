package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.ModelYear;

public record ModelYearResponse(Long id, Integer year, String chassisCode, Long vehicleModelId) {

    public static ModelYearResponse from(ModelYear modelYear) {
        return new ModelYearResponse(
                modelYear.getId(),
                modelYear.getYear(),
                modelYear.getChassisCode(),
                modelYear.getVehicleModel().getId());
    }
}
