package com.ridefit.ridefit.controller.admin;

import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.dto.PartResponse;
import com.ridefit.ridefit.dto.admin.PartExternalRatingRequest;
import com.ridefit.ridefit.dto.admin.PartImageRequest;
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

// 부품 카테고리별 "설치 방법 영상"/대표 이미지/외부 평점을 관리자가 등록·수정하는 화면.
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

    @PatchMapping("/{id}/image")
    public PartResponse updateImage(@PathVariable Long id, @RequestBody PartImageRequest request) {
        Part part = partRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "부품을 찾을 수 없습니다."));
        part.setImageUrl(request.imageUrl());
        return PartResponse.from(partRepository.save(part));
    }

    // 외부 사이트 평점은 관리자가 실제로 확인한 값만 입력한다 (자동 추정 없음).
    // 평점을 지우면(null) 리뷰 수/출처도 함께 지워서 값이 서로 어긋나지 않게 한다.
    @PatchMapping("/{id}/external-rating")
    public PartResponse updateExternalRating(@PathVariable Long id, @RequestBody PartExternalRatingRequest request) {
        Part part = partRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "부품을 찾을 수 없습니다."));
        if (request.externalRating() == null) {
            part.setExternalRating(null);
            part.setExternalRatingCount(null);
            part.setExternalRatingSource(null);
        } else {
            part.setExternalRating(request.externalRating());
            part.setExternalRatingCount(request.externalRatingCount());
            part.setExternalRatingSource(request.externalRatingSource());
        }
        return PartResponse.from(partRepository.save(part));
    }
}
