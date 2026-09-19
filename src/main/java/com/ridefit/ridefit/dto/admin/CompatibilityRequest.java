package com.ridefit.ridefit.dto.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CompatibilityRequest(
        @NotNull Long partId, @NotNull Long modelYearId, @NotBlank String status, String note) {
}
