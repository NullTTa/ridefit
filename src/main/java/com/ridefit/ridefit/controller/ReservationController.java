package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.EngineOilType;
import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Reservation;
import com.ridefit.ridefit.domain.ReservationItem;
import com.ridefit.ridefit.domain.ServiceShop;
import com.ridefit.ridefit.domain.ShopMaintenancePrice;
import com.ridefit.ridefit.dto.ModelYearLabel;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.ReservationRepository;
import com.ridefit.ridefit.repository.ServiceShopRepository;
import com.ridefit.ridefit.repository.ShopMaintenancePriceRepository;
import com.ridefit.ridefit.security.CurrentMember;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

// RIDEFIT 서비스 안에서 신청하는 예약. 실제 업체 시스템으로 전달되거나 결제가 일어나지는 않는다.
@RestController
@RequiredArgsConstructor
public class ReservationController {

    // ShopMaintenancePrice/service-shop-prices.json의 서비스명과 정확히 일치해야 한다.
    public static final String ENGINE_OIL_SERVICE_NAME = "엔진오일 교환";

    private final ReservationRepository reservationRepository;
    private final ServiceShopRepository shopRepository;
    private final MyVehicleRepository myVehicleRepository;
    private final MemberRepository memberRepository;
    private final ShopMaintenancePriceRepository shopMaintenancePriceRepository;
    private final CurrentMember currentMember;

    @PostMapping("/api/reservations")
    @Transactional
    public ResponseEntity<ReservationResponse> create(@Valid @RequestBody CreateReservationRequest request) {
        Long memberId = currentMember.id();

        ServiceShop shop = shopRepository.findById(request.shopId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "매장 정보를 찾을 수 없습니다."));
        if (!request.preferredAt().isAfter(LocalDateTime.now())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "희망 일시는 현재 시각 이후여야 합니다.");
        }

        MyVehicle vehicle = null;
        if (request.myVehicleId() != null) {
            vehicle = myVehicleRepository.findById(request.myVehicleId())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "차량 정보를 찾을 수 없습니다."));
            if (!vehicle.getMember().getId().equals(memberId)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "본인이 등록한 차량만 선택할 수 있습니다.");
            }
        }

        Reservation reservation = Reservation.builder()
                .member(memberRepository.getReferenceById(memberId))
                .shop(shop)
                .myVehicle(vehicle)
                .preferredAt(request.preferredAt())
                .memo(request.memo() == null || request.memo().isBlank() ? null : request.memo().trim())
                .status(Reservation.STATUS_REQUESTED)
                .createdAt(LocalDateTime.now())
                .build();

        List<ReservationItem> items = new ArrayList<>();
        Set<String> seenServiceNames = new HashSet<>();
        int total = 0;
        boolean totalKnown = true;

        for (ReservationItemRequest itemRequest : request.items()) {
            String serviceName = itemRequest.serviceName();
            if (!shop.getMenus().contains(serviceName)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "이 매장에서 제공하지 않는 서비스입니다: " + serviceName);
            }
            if (!seenServiceNames.add(serviceName)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "같은 서비스를 두 번 선택할 수 없습니다: " + serviceName);
            }

            // 가격은 반드시 서버가 DB(ShopMaintenancePrice)에서 조회해 확정한다 - 요청 바디에 price가 있어도 무시한다.
            ShopMaintenancePrice priceEntry = shopMaintenancePriceRepository
                    .findByShop_IdAndService_Name(shop.getId(), serviceName)
                    .orElse(null);

            EngineOilType oilType = null;
            Integer price = priceEntry == null ? null : priceEntry.getPrice();
            if (itemRequest.oilType() != null && !itemRequest.oilType().isBlank()) {
                if (!ENGINE_OIL_SERVICE_NAME.equals(serviceName)) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "오일 종류는 엔진오일 교환 서비스에만 선택할 수 있습니다.");
                }
                try {
                    oilType = EngineOilType.valueOf(itemRequest.oilType());
                } catch (IllegalArgumentException e) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "올바르지 않은 오일 종류입니다.");
                }
                if (price != null) {
                    price += oilType.extraPrice();
                }
            }

            if (price == null) {
                totalKnown = false;
            } else {
                total += price;
            }

            items.add(ReservationItem.builder()
                    .reservation(reservation)
                    .service(priceEntry == null ? null : priceEntry.getService())
                    .serviceName(serviceName)
                    .price(price)
                    .oilType(oilType)
                    .build());
        }

        reservation.setItems(items);
        reservation.setTotalPrice(totalKnown ? total : null);

        Reservation saved = reservationRepository.save(reservation);
        return ResponseEntity.status(HttpStatus.CREATED).body(ReservationResponse.from(saved));
    }

    @GetMapping("/api/me/reservations")
    @Transactional(readOnly = true)
    public List<ReservationResponse> mine() {
        return reservationRepository.findByMemberIdOrderByCreatedAtDesc(currentMember.id()).stream()
                .map(ReservationResponse::from).toList();
    }

    @PostMapping("/api/reservations/{id}/cancel")
    @Transactional
    public ReservationResponse cancel(@PathVariable Long id) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "예약 정보를 찾을 수 없습니다."));
        if (!reservation.getMember().getId().equals(currentMember.id())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "본인의 예약만 취소할 수 있습니다.");
        }
        reservation.setStatus(Reservation.STATUS_CANCELED);
        return ReservationResponse.from(reservation);
    }

    public record CreateReservationRequest(
            @NotNull Long shopId, @NotEmpty List<@Valid ReservationItemRequest> items,
            @NotNull LocalDateTime preferredAt, Long myVehicleId, String memo) {
    }

    // oilType은 EngineOilType 코드명(MINERAL/SEMI_SYNTHETIC/FULL_SYNTHETIC)이며, "엔진오일 교환" 서비스일 때만 넣을 수 있다.
    public record ReservationItemRequest(@NotBlank String serviceName, String oilType) {
    }

    public record ReservationItemResponse(String serviceName, Integer price, String oilTypeLabel, Integer oilExtraPrice) {
        static ReservationItemResponse from(ReservationItem item) {
            return new ReservationItemResponse(
                    item.getServiceName(), item.getPrice(),
                    item.getOilType() == null ? null : item.getOilType().label(),
                    item.getOilType() == null ? null : item.getOilType().extraPrice());
        }
    }

    // totalPrice는 서버가 items의 price를 합산해 확정한 총액(원) - 항목 중 가격 미확정이 있으면 null.
    public record ReservationResponse(
            Long id, Long shopId, String shopName, String shopType,
            List<ReservationItemResponse> items, Integer totalPrice,
            LocalDateTime preferredAt, String vehicleLabel, String memo, String status, LocalDateTime createdAt) {

        static ReservationResponse from(Reservation r) {
            List<ReservationItemResponse> items = r.getItems().stream()
                    .sorted(Comparator.comparing(ReservationItem::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                    .map(ReservationItemResponse::from)
                    .toList();
            return new ReservationResponse(
                    r.getId(), r.getShop().getId(), r.getShop().getName(),
                    ServiceShopController.TYPE_LABELS.getOrDefault(r.getShop().getType(), r.getShop().getType()),
                    items, r.getTotalPrice(), r.getPreferredAt(),
                    r.getMyVehicle() == null ? null : ModelYearLabel.of(r.getMyVehicle().getModelYear()),
                    r.getMemo(), r.getStatus(), r.getCreatedAt());
        }
    }
}
