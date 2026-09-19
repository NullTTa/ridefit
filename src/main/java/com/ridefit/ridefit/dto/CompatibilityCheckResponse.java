package com.ridefit.ridefit.dto;

public record CompatibilityCheckResponse(String status, boolean proceedAllowed, String note, String message) {
}
