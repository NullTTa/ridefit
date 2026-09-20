package com.ridefit.ridefit.dto;

import com.ridefit.ridefit.domain.VehicleModel;
import com.ridefit.ridefit.domain.VehicleProfile;

import java.util.Map;

// 차량 카드/목록용 요약. 프로필이 없는 차종은 스펙/성향 필드가 null이다(프론트는 그때 해당 영역만 숨긴다).
public record VehicleSummaryResponse(
        Long id, String name, String manufacturerName, String type, String imageUrl,
        Integer displacementCc, String bodyStyle, Integer priceTier, String priceTierLabel,
        String summary, Map<String, Integer> traitScores, String dataSource) {

    public static VehicleSummaryResponse of(VehicleModel model, VehicleProfile profile) {
        return new VehicleSummaryResponse(
                model.getId(), model.getName(), model.getManufacturer().getName(), model.getType(), model.getImageUrl(),
                profile == null ? null : profile.getDisplacementCc(),
                profile == null ? null : profile.getBodyStyle(),
                profile == null ? null : profile.getPriceTier(),
                profile == null ? null : priceTierLabel(profile.getPriceTier()),
                profile == null ? null : profile.getSummary(),
                profile == null ? null : Map.copyOf(profile.getTraitScores()),
                profile == null ? null : profile.getDataSource());
    }

    public static String priceTierLabel(Integer tier) {
        if (tier == null) {
            return null;
        }
        return switch (tier) {
            case 1 -> "입문·저렴한 편";
            case 2 -> "보급형";
            case 3 -> "중상급";
            default -> "고가(300cc급)";
        };
    }
}
