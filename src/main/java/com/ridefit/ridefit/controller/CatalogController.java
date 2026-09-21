package com.ridefit.ridefit.controller;

import com.ridefit.ridefit.dto.ManufacturerResponse;
import com.ridefit.ridefit.dto.MaintenanceSpecResponse;
import com.ridefit.ridefit.dto.ModelYearResponse;
import com.ridefit.ridefit.dto.VehicleModelResponse;
import com.ridefit.ridefit.repository.ManufacturerRepository;
import com.ridefit.ridefit.repository.MaintenanceSpecRepository;
import com.ridefit.ridefit.repository.ModelYearRepository;
import com.ridefit.ridefit.repository.VehicleModelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

// 제조사 -> 모델 -> 연식 순으로 내려가는 캐스케이딩 선택 UI(수동 입력 폼, 차량 등록 등)를 위한 카탈로그 조회 API.
@RestController
@RequiredArgsConstructor
public class CatalogController {

    private final ManufacturerRepository manufacturerRepository;
    private final VehicleModelRepository vehicleModelRepository;
    private final ModelYearRepository modelYearRepository;
    private final MaintenanceSpecRepository maintenanceSpecRepository;

    @GetMapping("/api/manufacturers")
    public List<ManufacturerResponse> getManufacturers() {
        return manufacturerRepository.findAll().stream().map(ManufacturerResponse::from).toList();
    }

    @GetMapping("/api/manufacturers/{manufacturerId}/vehicle-models")
    public List<VehicleModelResponse> getVehicleModels(@PathVariable Long manufacturerId) {
        return vehicleModelRepository.findByManufacturerId(manufacturerId).stream()
                .map(VehicleModelResponse::from).toList();
    }

    @GetMapping("/api/vehicle-models/{vehicleModelId}/model-years")
    public List<ModelYearResponse> getModelYears(@PathVariable Long vehicleModelId) {
        return modelYearRepository.findByVehicleModelId(vehicleModelId).stream()
                .map(ModelYearResponse::from).toList();
    }

    // 이 차종에 등록된 제조사 권장 정비/소모품 스펙(엔진오일 등). 차량을 선택했을 때만 "이 차량에 맞는 값"만 보여주기 위함.
    @GetMapping("/api/vehicle-models/{vehicleModelId}/maintenance-specs")
    public List<MaintenanceSpecResponse> getMaintenanceSpecs(@PathVariable Long vehicleModelId) {
        return maintenanceSpecRepository.findByVehicleModelId(vehicleModelId).stream()
                .map(MaintenanceSpecResponse::from).toList();
    }
}
