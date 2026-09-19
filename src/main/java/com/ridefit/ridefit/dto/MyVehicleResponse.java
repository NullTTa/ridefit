package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.MyVehicle;

public record MyVehicleResponse(
        Long id, Long memberId, String manufacturerName, String vehicleModelName, Integer year,
        String modelYearLabel, String photoUrl) {

    public static MyVehicleResponse from(MyVehicle myVehicle) {
        ModelYear modelYear = myVehicle.getModelYear();
        String modelYearLabel = modelYear.getYear() + " " + modelYear.getVehicleModel().getName();

        return new MyVehicleResponse(
                myVehicle.getId(),
                myVehicle.getMember().getId(),
                modelYear.getVehicleModel().getManufacturer().getName(),
                modelYear.getVehicleModel().getName(),
                modelYear.getYear(),
                modelYearLabel,
                myVehicle.getPhotoUrl());
    }
}
