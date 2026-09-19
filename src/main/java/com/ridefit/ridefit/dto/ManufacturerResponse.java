package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Manufacturer;

public record ManufacturerResponse(Long id, String name) {

    public static ManufacturerResponse from(Manufacturer manufacturer) {
        return new ManufacturerResponse(manufacturer.getId(), manufacturer.getName());
    }
}
