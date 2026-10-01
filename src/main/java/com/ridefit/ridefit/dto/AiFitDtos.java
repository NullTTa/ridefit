package com.ridefit.ridefit.dto;

import java.time.LocalDateTime;

public final class AiFitDtos {

    private AiFitDtos() {
    }

    // anchorX/anchorY: FitRoom 좌표(vehicleFitPositions.js)를 차량 사진 기준 0~100% 로 환산한 장착 위치 힌트. 없으면 null.
    public record AiFitRequest(Long partId, Long myVehicleId, Double anchorX, Double anchorY) {
    }

    // code: READY(생성 가능) / CACHED(이미 생성된 결과 있음) / UNSUPPORTED_CATEGORY / REFERENCE_MISSING
    //       / VEHICLE_IMAGE_MISSING / NOT_CONFIGURED(API 키 없음) / NOT_COMPATIBLE
    public record AiFitStatusResponse(
            boolean canGenerate, String code, String message, String cachedImageUrl, LocalDateTime cachedAt) {
    }

    public record AiFitResponse(String imageUrl, boolean cached, String model, LocalDateTime createdAt) {
    }
}
