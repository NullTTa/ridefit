package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.MyVehicle;

public record MyVehicleResponse(
        Long id, Long memberId, Long modelYearId, Long manufacturerId, Long vehicleModelId, String manufacturerName,
        String vehicleModelName, Integer year, String chassisCode, String modelYearLabel, String modelImageUrl,
        String vehicleClass, String nickname, String photoUrl) {

    public static MyVehicleResponse from(MyVehicle myVehicle) {
        ModelYear modelYear = myVehicle.getModelYear();

        return new MyVehicleResponse(
                myVehicle.getId(),
                myVehicle.getMember().getId(),
                modelYear.getId(),
                modelYear.getVehicleModel().getManufacturer().getId(),
                modelYear.getVehicleModel().getId(),
                modelYear.getVehicleModel().getManufacturer().getName(),
                modelYear.getVehicleModel().getName(),
                modelYear.getYear(),
                modelYear.getChassisCode(),
                ModelYearLabel.of(modelYear),
                modelYear.getVehicleModel().getImageUrl(),
                modelYear.getVehicleModel().getVehicleClass(),
                myVehicle.getNickname(),
                myVehicle.getPhotoUrl());
    }
}
