package com.ridefit.ridefit.dto.admin;

import jakarta.validation.constraints.NotNull;

public record PartConflictRequest(@NotNull Long partAId, @NotNull Long partBId, String reason) {
}
