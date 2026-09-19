package com.ridefit.ridefit.controller.admin;

import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.dto.PartResponse;
import com.ridefit.ridefit.dto.admin.PartVideoRequest;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.PartRepository;
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

// 부품 카테고리별 "설치 방법 영상" 링크를 관리자가 등록/수정하는 최소 화면.
@RestController
@RequestMapping("/api/admin/parts")
@RequiredArgsConstructor
public class AdminPartController {

    private final PartRepository partRepository;

    @GetMapping
    public Page<PartResponse> list(@PageableDefault(size = 20) Pageable pageable) {
        return partRepository.findAll(pageable).map(PartResponse::from);
    }

    @PatchMapping("/{id}/video")
    public PartResponse updateInstallVideo(@PathVariable Long id, @RequestBody PartVideoRequest request) {
        Part part = partRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "부품을 찾을 수 없습니다."));
        part.setInstallVideoUrl(request.installVideoUrl());
        return PartResponse.from(partRepository.save(part));
    }
}
