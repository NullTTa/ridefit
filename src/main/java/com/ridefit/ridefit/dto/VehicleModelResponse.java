package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.VehicleModel;

public record VehicleModelResponse(
        Long id, String name, String type, Long manufacturerId, String manufacturerName, String imageUrl) {

    public static VehicleModelResponse from(VehicleModel vehicleModel) {
        return new VehicleModelResponse(
                vehicleModel.getId(),
                vehicleModel.getName(),
                vehicleModel.getType(),
                vehicleModel.getManufacturer().getId(),
                vehicleModel.getManufacturer().getName(),
                vehicleModel.getImageUrl());
    }
}
