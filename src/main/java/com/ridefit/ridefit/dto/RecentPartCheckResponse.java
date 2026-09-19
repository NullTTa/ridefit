package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.RecentPartCheck;

import java.time.LocalDateTime;

public record RecentPartCheckResponse(
        Long id, Long partId, String partName, String partImageUrl,
        Long myVehicleId, String vehicleLabel, String status, LocalDateTime checkedAt) {

    public static RecentPartCheckResponse from(RecentPartCheck check) {
        var vehicle = check.getMyVehicle();
        var modelYear = vehicle.getModelYear();
        String label = modelYear.getYear() + " " + modelYear.getVehicleModel().getName();

        return new RecentPartCheckResponse(
                check.getId(),
                check.getPart().getId(),
                check.getPart().getName(),
                check.getPart().getImageUrl(),
                vehicle.getId(),
                label,
                check.getStatus(),
                check.getCheckedAt());
    }
}
