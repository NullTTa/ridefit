package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.domain.Favorite;
import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.dto.FavoriteResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.FavoriteRepository;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.security.CurrentMember;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

// 저장한 부품(즐겨찾기). 어느 내 차량에 저장했는지(myVehicleId)를 같이 기록한다.
//  - myVehicleId 있음: 그 차량에 저장한 부품만 조회/추가/삭제(내 차량이 아니면 403)
//  - myVehicleId 없음: 조회 = 전체(마이페이지), unassigned=true = 차량 구분 없이 저장된 예전 즐겨찾기만,
//    추가/삭제 = 차량 구분 없는 행(예전 방식)
@RestController
@RequestMapping("/api/me/favorites")
@RequiredArgsConstructor
public class FavoriteController {

    private final FavoriteRepository favoriteRepository;
    private final PartRepository partRepository;
    private final MemberRepository memberRepository;
    private final MyVehicleRepository myVehicleRepository;
    private final CurrentMember currentMember;

    @GetMapping
    public List<FavoriteResponse> list(@RequestParam(required = false) Long myVehicleId,
                                       @RequestParam(defaultValue = "false") boolean unassigned) {
        Long memberId = currentMember.id();
        List<Favorite> rows;
        if (myVehicleId != null) {
            requireOwnedVehicle(myVehicleId);
            rows = favoriteRepository.findByMemberIdAndMyVehicleIdOrderByCreatedAtDesc(memberId, myVehicleId);
        } else if (unassigned) {
            rows = favoriteRepository.findByMemberIdAndMyVehicleIsNullOrderByCreatedAtDesc(memberId);
        } else {
            rows = favoriteRepository.findByMemberIdOrderByCreatedAtDesc(memberId);
        }
        return rows.stream().map(FavoriteResponse::from).toList();
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Void> add(@RequestBody FavoriteRequest request) {
        Long memberId = currentMember.id();
        MyVehicle vehicle = request.myVehicleId() == null ? null : requireOwnedVehicle(request.myVehicleId());
        boolean exists = vehicle == null
                ? favoriteRepository.existsByMemberIdAndMyVehicleIsNullAndPartId(memberId, request.partId())
                : favoriteRepository.existsByMemberIdAndMyVehicleIdAndPartId(memberId, vehicle.getId(), request.partId());
        if (exists) {
            return ResponseEntity.noContent().build();
        }
        Part part = partRepository.findById(request.partId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "부품을 찾을 수 없습니다."));

        Favorite favorite = Favorite.builder()
                .member(memberRepository.getReferenceById(memberId))
                .part(part)
                .myVehicle(vehicle)
                .createdAt(LocalDateTime.now())
                .build();
        favoriteRepository.save(favorite);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/{partId}")
    @Transactional
    public ResponseEntity<Void> remove(@PathVariable Long partId, @RequestParam(required = false) Long myVehicleId) {
        Long memberId = currentMember.id();
        if (myVehicleId != null) {
            requireOwnedVehicle(myVehicleId);
            favoriteRepository.deleteByMemberIdAndMyVehicleIdAndPartId(memberId, myVehicleId, partId);
        } else {
            favoriteRepository.deleteByMemberIdAndMyVehicleIsNullAndPartId(memberId, partId);
        }
        return ResponseEntity.noContent().build();
    }

    private MyVehicle requireOwnedVehicle(Long myVehicleId) {
        MyVehicle vehicle = myVehicleRepository.findById(myVehicleId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "존재하지 않는 차량입니다."));
        if (!vehicle.getMember().getId().equals(currentMember.id())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "본인이 등록한 차량에만 저장할 수 있습니다.");
        }
        return vehicle;
    }

    // myVehicleId: 저장할 내 차량(없으면 차량 구분 없는 예전 방식)
    public record FavoriteRequest(Long partId, Long myVehicleId) {
    }
}
