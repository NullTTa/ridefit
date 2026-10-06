package com.ridefit.ridefit.service;

import com.ridefit.ridefit.domain.EngineOilType;
import com.ridefit.ridefit.domain.ShopMaintenancePrice;
import com.ridefit.ridefit.repository.ShopMaintenancePriceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

// 예약 서비스 1개의 금액 = 매장 기본가(ShopMaintenancePrice) + 엔진오일 종류 추가금. 예약 생성과 예약 결제가 같은 규칙을 쓴다
// (결제 때 다시 계산해서, 예약 이후 가격이 바뀌었거나 저장된 값이 조작됐으면 결제를 막는다). 프론트가 보낸 가격은 쓰지 않는다.
@Component
@RequiredArgsConstructor
public class ReservationPricing {

    private final ShopMaintenancePriceRepository shopMaintenancePriceRepository;

    // priceEntry: 매장 가격표 행(없으면 null), price: 확정 금액(가격표가 없으면 null = 가격 미확정).
    public record ItemPrice(ShopMaintenancePrice priceEntry, Integer price) {
    }

    public ItemPrice price(Long shopId, String serviceName, EngineOilType oilType) {
        ShopMaintenancePrice entry = shopMaintenancePriceRepository.findByShop_IdAndService_Name(shopId, serviceName).orElse(null);
        Integer price = entry == null ? null : entry.getPrice();
        if (price != null && oilType != null) {
            price += oilType.extraPrice();
        }
        return new ItemPrice(entry, price);
    }
}
