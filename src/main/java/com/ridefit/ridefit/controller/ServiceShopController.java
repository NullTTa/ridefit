package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.EngineOilType;
import com.ridefit.ridefit.domain.MaintenanceService;
import com.ridefit.ridefit.domain.ServiceShop;
import com.ridefit.ridefit.domain.ShopMaintenancePrice;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.ServiceShopRepository;
import com.ridefit.ridefit.repository.ShopMaintenancePriceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// 주변 정비/세차 서비스 목록. 지금은 목록형(지도 연동 전)이고, 매장 데이터는 개발용 샘플이다(sample 플래그).
@RestController
@RequiredArgsConstructor
public class ServiceShopController {

    public static final Map<String, String> TYPE_LABELS = Map.of(
            "REPAIR", "정비소",
            "OIL", "오일 교환",
            "TIRE", "타이어",
            "WASH", "세차장",
            "SELF_WASH", "셀프 세차",
            "SELF_REPAIR", "셀프 정비",
            "SPECIALTY", "전문점");

    private final ServiceShopRepository shopRepository;
    private final ShopMaintenancePriceRepository shopMaintenancePriceRepository;

    @GetMapping("/api/services/types")
    public List<Map<String, String>> types() {
        return List.of("REPAIR", "OIL", "TIRE", "WASH", "SELF_WASH", "SELF_REPAIR", "SPECIALTY").stream()
                .map(code -> Map.of("code", code, "label", TYPE_LABELS.get(code)))
                .toList();
    }

    @GetMapping("/api/services/shops")
    public List<ShopResponse> list(@RequestParam(required = false) String type) {
        List<ServiceShop> shops = (type == null || type.isBlank())
                ? shopRepository.findAll()
                : shopRepository.findByTypeOrderByIdAsc(type.toUpperCase());
        return shops.stream().map(this::toShopResponse).toList();
    }

    @GetMapping("/api/services/shops/{id}")
    public ShopResponse detail(@PathVariable Long id) {
        ServiceShop shop = shopRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "매장 정보를 찾을 수 없습니다."));
        return toShopResponse(shop);
    }

    // "엔진오일 교환" 서비스를 선택했을 때 고를 수 있는 오일 종류 + 추가금. RIDEFIT이 정한 옵션 가격이며
    // 실제 매장/브랜드별 시세를 조사한 값이 아니다(화면에도 안내 문구를 함께 표시한다).
    @GetMapping("/api/services/engine-oil-types")
    public List<EngineOilTypeResponse> engineOilTypes() {
        return java.util.Arrays.stream(EngineOilType.values())
                .map(t -> new EngineOilTypeResponse(t.name(), t.label(), t.description(), t.extraPrice()))
                .toList();
    }

    public record EngineOilTypeResponse(String code, String label, String description, int extraPrice) {
    }

    // 매장 메뉴(menus) 순서 그대로, 각 메뉴에 매칭되는 고정 가격/소요시간을 같이 내려준다.
    // 아직 가격이 seed되지 않은 메뉴는 price/durationMinutes가 null로 내려가고, 화면은 "가격 정보 준비중"으로 처리한다.
    private ShopResponse toShopResponse(ServiceShop s) {
        Map<String, ShopMaintenancePrice> priceByServiceName = shopMaintenancePriceRepository.findByShopId(s.getId()).stream()
                .collect(Collectors.toMap(p -> p.getService().getName(), p -> p, (a, b) -> a));

        List<ServicePriceResponse> services = s.getMenus().stream()
                .map(menuName -> {
                    ShopMaintenancePrice priceEntry = priceByServiceName.get(menuName);
                    MaintenanceService service = priceEntry == null ? null : priceEntry.getService();
                    return new ServicePriceResponse(
                            menuName,
                            priceEntry == null ? null : priceEntry.getPrice(),
                            service == null ? null : service.getDurationMinutes(),
                            service == null ? null : service.getDescription());
                })
                .toList();

        return new ShopResponse(s.getId(), s.getName(), s.getType(), TYPE_LABELS.getOrDefault(s.getType(), s.getType()),
                s.getRegion(), s.getAddress(), s.getDescription(), s.getLat(), s.getLng(),
                List.copyOf(s.getMenus()), services, s.isSample());
    }

    public record ShopResponse(
            Long id, String name, String type, String typeLabel, String region, String address, String description,
            Double lat, Double lng, List<String> menus, List<ServicePriceResponse> services, boolean sample) {
    }

    // 서비스 1건의 이름 + 이 매장에서의 고정 가격 + 예상 소요시간. price/durationMinutes는 seed 안 된 메뉴면 null.
    public record ServicePriceResponse(String name, Integer price, Integer durationMinutes, String description) {
    }
}
