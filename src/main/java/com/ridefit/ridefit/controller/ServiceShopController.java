package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.ServiceShop;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.ServiceShopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

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
        return shops.stream().map(ShopResponse::from).toList();
    }

    @GetMapping("/api/services/shops/{id}")
    public ShopResponse detail(@PathVariable Long id) {
        return shopRepository.findById(id).map(ShopResponse::from)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "매장 정보를 찾을 수 없습니다."));
    }

    public record ShopResponse(
            Long id, String name, String type, String typeLabel, String region, String address, String description,
            Double lat, Double lng, List<String> menus, boolean sample) {

        public static ShopResponse from(ServiceShop s) {
            return new ShopResponse(s.getId(), s.getName(), s.getType(), TYPE_LABELS.getOrDefault(s.getType(), s.getType()),
                    s.getRegion(), s.getAddress(), s.getDescription(), s.getLat(), s.getLng(),
                    List.copyOf(s.getMenus()), s.isSample());
        }
    }
}
