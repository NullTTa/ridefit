package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Favorite;

// myVehicleId/myVehicleLabel: 어느 내 차량에 저장했는지. null이면 차량 구분 없이 저장한 예전 즐겨찾기.
public record FavoriteResponse(Long partId, String name, String category, Integer price, String imageUrl,
                               Long myVehicleId, String myVehicleLabel) {

    public static FavoriteResponse from(Favorite favorite) {
        var part = favorite.getPart();
        var vehicle = favorite.getMyVehicle();
        String label = vehicle == null ? null
                : (vehicle.getNickname() != null && !vehicle.getNickname().isBlank()
                        ? vehicle.getNickname() : ModelYearLabel.of(vehicle.getModelYear()));
        return new FavoriteResponse(part.getId(), part.getName(), part.getCategory(), part.getPrice(), part.getImageUrl(),
                vehicle == null ? null : vehicle.getId(), label);
    }
}
