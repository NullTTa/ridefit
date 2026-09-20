package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Reservation;
import com.ridefit.ridefit.domain.ServiceShop;
import com.ridefit.ridefit.dto.ModelYearLabel;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.ReservationRepository;
import com.ridefit.ridefit.repository.ServiceShopRepository;
import com.ridefit.ridefit.security.CurrentMember;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
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
import java.util.List;

// RIDEFIT 안에서만 동작하는 "가상 예약". 실제 업체로 전달되지 않고 결제도 없다 - 예약 흐름을 체험하는 프로토타입이다.
@RestController
@RequiredArgsConstructor
public class ReservationController {

    private final ReservationRepository reservationRepository;
    private final ServiceShopRepository shopRepository;
    private final MyVehicleRepository myVehicleRepository;
    private final MemberRepository memberRepository;
    private final CurrentMember currentMember;

    @PostMapping("/api/reservations")
    @Transactional
    public ResponseEntity<ReservationResponse> create(@Valid @RequestBody CreateReservationRequest request) {
        Long memberId = currentMember.id();

        ServiceShop shop = shopRepository.findById(request.shopId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "매장 정보를 찾을 수 없습니다."));
        if (!shop.getMenus().contains(request.serviceName())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "이 매장에서 제공하지 않는 서비스입니다.");
        }
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

        Reservation saved = reservationRepository.save(Reservation.builder()
                .member(memberRepository.getReferenceById(memberId))
                .shop(shop)
                .myVehicle(vehicle)
                .serviceName(request.serviceName())
                .preferredAt(request.preferredAt())
                .memo(request.memo() == null || request.memo().isBlank() ? null : request.memo().trim())
                .status(Reservation.STATUS_REQUESTED)
                .createdAt(LocalDateTime.now())
                .build());
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
            @NotNull Long shopId, @NotBlank String serviceName, @NotNull LocalDateTime preferredAt,
            Long myVehicleId, String memo) {
    }

    // virtual은 항상 true - 화면에서 "실제 예약이 아님"을 명시하기 위한 값이다.
    public record ReservationResponse(
            Long id, Long shopId, String shopName, String shopType, String serviceName, LocalDateTime preferredAt,
            String vehicleLabel, String memo, String status, LocalDateTime createdAt, boolean virtual) {

        static ReservationResponse from(Reservation r) {
            return new ReservationResponse(
                    r.getId(), r.getShop().getId(), r.getShop().getName(),
                    ServiceShopController.TYPE_LABELS.getOrDefault(r.getShop().getType(), r.getShop().getType()),
                    r.getServiceName(), r.getPreferredAt(),
                    r.getMyVehicle() == null ? null : ModelYearLabel.of(r.getMyVehicle().getModelYear()),
                    r.getMemo(), r.getStatus(), r.getCreatedAt(), true);
        }
    }
}
