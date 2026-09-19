package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.Favorite;

public record FavoriteResponse(Long partId, String name, String category, Integer price, String imageUrl) {

    public static FavoriteResponse from(Favorite favorite) {
        var part = favorite.getPart();
        return new FavoriteResponse(part.getId(), part.getName(), part.getCategory(), part.getPrice(), part.getImageUrl());
    }
}
