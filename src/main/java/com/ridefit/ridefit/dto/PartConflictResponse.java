package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.PartConflict;

public record PartConflictResponse(Long id, Long partAId, String partAName, Long partBId, String partBName,
                                    String reason) {

    public static PartConflictResponse from(PartConflict conflict) {
        return new PartConflictResponse(
                conflict.getId(),
                conflict.getPartA().getId(),
                conflict.getPartA().getName(),
                conflict.getPartB().getId(),
                conflict.getPartB().getName(),
                conflict.getReason());
    }
}
