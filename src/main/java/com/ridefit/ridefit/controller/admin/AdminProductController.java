package com.ridefit.ridefit.controller.admin;

import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.dto.CrawlResultResponse;
import com.ridefit.ridefit.dto.PartResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.ModelYearRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.service.ImageStorageService;
import com.ridefit.ridefit.service.PartCrawlService;
import com.ridefit.ridefit.service.SellerListingService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.Set;

// 관리자 "상품 URL로 부품 등록" 흐름:
//   상품 URL → preview(자동 추출, 실패 시 수동 입력 안내) → 관리자가 확인/수정 → 등록(부품 + 호환 + 판매처).
// 대표 이미지는 등록 시점에 우리 서버에 저장을 시도하고, 실패하면 원본 URL만 출처로 남긴다(깨진 이미지 표시 방지).
// AI 참조 이미지는 대표 이미지와 별개로, 관리자가 직접 확인한 이미지만 넣는다.
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminProductController {

    private static final Set<String> ALLOWED_COMPAT_STATUS = Set.of("호환가능", "브라켓필요");

    private final PartCrawlService partCrawlService;
    private final ImageStorageService imageStorageService;
    private final SellerListingService sellerListingService;
    private final PartRepository partRepository;
    private final ModelYearRepository modelYearRepository;
    private final CompatibilityRepository compatibilityRepository;

    public record PreviewRequest(@NotBlank String url) {
    }

    // price: 부품의 대표 가격(필수, 관리자가 확인한 값). listingPrice: 이 판매처의 확인된 가격(모르면 null).
    public record CreateProductRequest(
            @NotBlank @Size(max = 255, message = "URL/이름은 255자 이하만 저장할 수 있어요. 더 짧은 주소를 사용해주세요.") String name,
            @NotBlank @Size(max = 255, message = "URL/이름은 255자 이하만 저장할 수 있어요. 더 짧은 주소를 사용해주세요.") String category,
            @NotNull @Positive Integer price,
            @Size(max = 255, message = "URL/이름은 255자 이하만 저장할 수 있어요. 더 짧은 주소를 사용해주세요.") String sourceUrl,
            @Size(max = 255, message = "URL/이름은 255자 이하만 저장할 수 있어요. 더 짧은 주소를 사용해주세요.") String sellerName,
            @Positive Integer listingPrice,
            @Size(max = 255, message = "URL/이름은 255자 이하만 저장할 수 있어요. 더 짧은 주소를 사용해주세요.") String originalImageUrl,
            @Size(max = 255, message = "URL/이름은 255자 이하만 저장할 수 있어요. 더 짧은 주소를 사용해주세요.") String externalProductId,
            @Size(max = 255, message = "URL/이름은 255자 이하만 저장할 수 있어요. 더 짧은 주소를 사용해주세요.") String aiReferenceImageUrl,
            List<Long> modelYearIds,
            String compatStatus,
            String compatNote) {
    }

    public record CreateProductResponse(PartResponse part, boolean imageStored, String imageMessage,
                                        int compatibilityCount, boolean listingCreated) {
    }

    @PostMapping("/products/preview")
    public CrawlResultResponse preview(@Valid @RequestBody PreviewRequest request) {
        return partCrawlService.crawl(request.url());
    }

    @PostMapping("/products")
    @Transactional
    public ResponseEntity<CreateProductResponse> create(@Valid @RequestBody CreateProductRequest request) {
        String status = request.compatStatus() == null ? "호환가능" : request.compatStatus();
        if (!ALLOWED_COMPAT_STATUS.contains(status)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "호환 상태는 호환가능 또는 브라켓필요만 선택할 수 있어요.");
        }
        String aiReference = imageStorageService.requireReadableInternalImage(request.aiReferenceImageUrl());

        String storedImage = imageStorageService.storeFromUrl(request.originalImageUrl(), "parts").orElse(null);
        String imageMessage = request.originalImageUrl() == null || request.originalImageUrl().isBlank()
                ? "대표 이미지 없이 등록했어요."
                : storedImage != null ? "대표 이미지를 서버에 저장했어요."
                : "대표 이미지를 내려받지 못해 원본 URL만 출처로 보관했어요(화면에는 '이미지 준비중'으로 표시).";

        Part part = partRepository.save(Part.builder()
                .name(request.name().trim())
                .category(request.category().trim())
                .price(request.price())
                .imageUrl(storedImage)
                .imageSourceUrl(blankToNull(request.originalImageUrl()))
                .aiReferenceImageUrl(aiReference)
                .build());

        int compatCount = 0;
        if (request.modelYearIds() != null) {
            for (Long modelYearId : request.modelYearIds()) {
                ModelYear modelYear = modelYearRepository.findById(modelYearId)
                        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "선택한 연식 정보를 찾을 수 없습니다."));
                if (compatibilityRepository.findByPartIdAndModelYearId(part.getId(), modelYearId).isPresent()) continue;
                compatibilityRepository.save(Compatibility.builder()
                        .part(part)
                        .modelYear(modelYear)
                        .status(status)
                        .note(blankToNull(request.compatNote()) != null ? request.compatNote().trim() : "관리자가 상품 URL로 등록")
                        .build());
                compatCount++;
            }
        }

        boolean listingCreated = false;
        if (request.sourceUrl() != null && !request.sourceUrl().isBlank()
                && request.sellerName() != null && !request.sellerName().isBlank()) {
            sellerListingService.add(part, request.sellerName(), request.listingPrice(), request.originalImageUrl(),
                    storedImage, request.sourceUrl(), request.name(), request.externalProductId());
            listingCreated = true;
        }

        Part saved = partRepository.findById(part.getId()).orElse(part);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new CreateProductResponse(PartResponse.from(saved), storedImage != null, imageMessage,
                        compatCount, listingCreated));
    }

    // 관리자가 직접 올리는 부품 이미지(AI 참조 이미지 / 대표 이미지). PNG/JPG/WEBP만.
    @PostMapping("/uploads/part-image")
    public Map<String, String> uploadPartImage(@RequestParam("file") MultipartFile file) {
        return Map.of("url", imageStorageService.storeUpload(file, "parts"));
    }

    private String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
