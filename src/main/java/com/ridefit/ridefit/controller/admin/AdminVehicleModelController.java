package com.ridefit.ridefit.controller.admin;

import com.ridefit.ridefit.domain.VehicleModel;
import com.ridefit.ridefit.dto.VehicleModelResponse;
import com.ridefit.ridefit.dto.admin.VehicleModelImageRequest;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.VehicleModelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// 차종(VehicleModel)별 대표 이미지를 관리자가 등록/수정하는 화면.
// 사용자는 차량 등록 시 사진 URL을 직접 입력하지 않고, 이 모델 이미지가 자동으로 적용된다.
@RestController
@RequestMapping("/api/admin/vehicle-models")
@RequiredArgsConstructor
public class AdminVehicleModelController {

    private final VehicleModelRepository vehicleModelRepository;

    @GetMapping
    public Page<VehicleModelResponse> list(@PageableDefault(size = 20) Pageable pageable) {
        return vehicleModelRepository.findAll(pageable).map(VehicleModelResponse::from);
    }

    @PatchMapping("/{id}/image")
    public VehicleModelResponse updateImage(@PathVariable Long id, @RequestBody VehicleModelImageRequest request) {
        VehicleModel vehicleModel = vehicleModelRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "차종을 찾을 수 없습니다."));
        vehicleModel.setImageUrl(request.imageUrl());
        return VehicleModelResponse.from(vehicleModelRepository.save(vehicleModel));
    }
}
