package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.MaintenanceSpec;

public record MaintenanceSpecResponse(
        Long id, String category, String itemName, String specSummary, Double changeVolumeL,
        Double changeVolumeWithFilterL, Integer firstIntervalKm, Integer firstIntervalMonths, Integer intervalKm,
        Integer intervalMonths, String sourceLabel, String sourceUrl, String note) {

    public static MaintenanceSpecResponse from(MaintenanceSpec spec) {
        return new MaintenanceSpecResponse(
                spec.getId(), spec.getCategory(), spec.getItemName(), spec.getSpecSummary(), spec.getChangeVolumeL(),
                spec.getChangeVolumeWithFilterL(), spec.getFirstIntervalKm(), spec.getFirstIntervalMonths(),
                spec.getIntervalKm(), spec.getIntervalMonths(), spec.getSourceLabel(), spec.getSourceUrl(),
                spec.getNote());
    }
}
