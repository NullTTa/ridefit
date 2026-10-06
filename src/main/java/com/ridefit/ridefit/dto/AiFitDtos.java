package com.ridefit.ridefit.dto;

import java.time.LocalDateTime;
import java.util.List;

public final class AiFitDtos {

    private AiFitDtos() {
    }

    // 함께 장착할 부품 하나 + FitRoom 좌표(vehicleFitPositions.js)를 차량 사진 기준 0~100% 로 환산한 장착 위치 힌트(없으면 null).
    public record AiFitPartInput(Long partId, Double anchorX, Double anchorY) {
    }

    // parts: 여러 부품을 한 장에 함께 장착할 때(우선 사용). 비어 있으면 예전 방식(partId/anchorX/anchorY 한 개)으로 처리한다.
    // regenerate: true면 같은 조합의 저장된 결과가 있어도 새로 만든다(이전 결과는 그대로 남는다).
    public record AiFitRequest(Long partId, Long myVehicleId, Double anchorX, Double anchorY,
                               List<AiFitPartInput> parts, Boolean regenerate) {
    }

    // 여러 부품의 준비 상태 확인용(API 호출 없음, 무료).
    public record AiFitCheckRequest(Long myVehicleId, List<AiFitPartInput> parts) {
    }

    // code: READY(생성 가능) / CACHED(이미 생성된 결과 있음) / UNSUPPORTED_CATEGORY / REFERENCE_MISSING
    //       / VEHICLE_IMAGE_MISSING / NOT_CONFIGURED(API 키 없음) / NOT_COMPATIBLE
    public record AiFitStatusResponse(
            boolean canGenerate, String code, String message, String cachedImageUrl, LocalDateTime cachedAt) {
    }

    // 부품별 준비 상태. included = 이 부품을 합성에 넣을 수 있는지.
    public record AiFitPartStatus(Long partId, boolean included, String code, String message) {
    }

    // 선택한 부품 전체에 대한 준비 상태. code/canGenerate는 "넣을 수 있는 부품들"로 만든 조합 기준.
    public record AiFitCheckResponse(boolean canGenerate, String code, String message,
                                     List<AiFitPartStatus> parts, String cachedImageUrl, LocalDateTime cachedAt) {
    }

    public record AiFitResponse(Long id, String imageUrl, boolean cached, String model, LocalDateTime createdAt,
                                List<Long> partIds) {
    }

    // 저장된 장착 결과(이 차량으로 만든 것) 목록의 한 줄.
    // myVehicleId: 결과를 만든 내 차량. 차량 구분 전에 만든 예전 결과는 null(같은 회원+같은 차종이라 FitRoom 목록에는 함께 나온다).
    public record AiFitResultItem(Long id, String imageUrl, List<Long> partIds, List<String> partNames,
                                  String model, LocalDateTime createdAt, Long myVehicleId) {
    }
}
