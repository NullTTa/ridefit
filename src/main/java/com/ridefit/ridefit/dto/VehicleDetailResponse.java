package com.ridefit.ridefit.dto;

import java.util.List;

public record VehicleDetailResponse(
        VehicleSummaryResponse vehicle, List<String> pros, List<String> cons, List<ModelYearResponse> years) {
}
