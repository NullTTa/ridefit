package com.ridefit.ridefit.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.Manufacturer;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.PartType;
import com.ridefit.ridefit.domain.SellerListing;
import com.ridefit.ridefit.domain.VehicleModel;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.ManufacturerRepository;
import com.ridefit.ridefit.repository.ModelYearRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.SellerListingRepository;
import com.ridefit.ridefit.repository.VehicleModelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.function.Consumer;

// 실제 상품 부품(KITACO 캐리어, H2C 바스켓/윈드스크린, 범용 윈드스크린/사이드백, 아사히 사이드백)과
// 그 호환 데이터/판매처를 resources/seed/verified-parts.json 에서 채운다. 이 데이터는 원래 로컬 DB에서
// 관리자/API로만 만들어져 있었어서, 새 DB나 다른 PC에서도 같은 화면이 나오도록 스냅샷으로 옮겨둔 것이다.
//
// 원칙(다른 시더와 같음): 전부 "없으면 추가"라 몇 번을 재시작해도 중복되지 않는다.
//  - 부품: 이름으로 찾고, 있으면 비어 있는(null) 필드만 채운다(이미 있는 값은 덮어쓰지 않음).
//  - 호환: 같은 부품+연식이 이미 있으면 건드리지 않는다(수정/삭제 없음). 연식은 차종+연식으로 찾고,
//    세대 코드가 스냅샷과 다르면(다른 세대로 바뀐 DB) 만들지 않고 경고만 남긴다.
//  - 판매처: 같은 부품+상품 링크가 이미 있으면 새로 만들지 않고, 표시명(displayName)이 비어 있을 때만 채운다.
//    /uploads/... 썸네일 파일이 없는 환경이면 썸네일을 비워 두고 화면은 판매처 원본 이미지를 쓴다.
@Slf4j
@Component
@Order(3)
@RequiredArgsConstructor
public class VerifiedPartsSeeder implements CommandLineRunner {

    static final String SEED_FILE = "seed/verified-parts.json";

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final ManufacturerRepository manufacturerRepository;
    private final VehicleModelRepository vehicleModelRepository;
    private final ModelYearRepository modelYearRepository;
    private final PartRepository partRepository;
    private final CompatibilityRepository compatibilityRepository;
    private final SellerListingRepository sellerListingRepository;

    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    @Override
    @Transactional
    public void run(String... args) throws IOException {
        JsonNode root;
        try (InputStream in = new ClassPathResource(SEED_FILE).getInputStream()) {
            root = objectMapper.readTree(in);
        }
        int[] created = new int[3]; // 부품, 호환, 판매처
        for (JsonNode p : root.path("parts")) {
            Part part = upsertPart(p, created);
            for (JsonNode c : p.path("compatibilities")) {
                seedCompatibility(part, c, created);
            }
            for (JsonNode l : p.path("sellerListings")) {
                seedListing(part, l, created);
            }
        }
        log.info("실제 상품 부품 시드 확인/생성 완료: 새 부품 {}, 새 호환 {}, 새 판매처 {}", created[0], created[1], created[2]);
    }

    private Part upsertPart(JsonNode p, int[] created) {
        String name = p.get("name").asText();
        Optional<Part> existing = partRepository.findByName(name);
        if (existing.isEmpty()) {
            created[0]++;
            return partRepository.save(Part.builder()
                    .name(name)
                    .category(p.get("category").asText())
                    .price(p.get("price").asInt())
                    .imageUrl(text(p, "imageUrl"))
                    .imageSourceUrl(text(p, "imageSourceUrl"))
                    .aiReferenceImageUrl(text(p, "aiReferenceImageUrl"))
                    .sourceUrl(text(p, "sourceUrl"))
                    .installVideoUrl(text(p, "installVideoUrl"))
                    .partNumber(text(p, "partNumber"))
                    .brand(text(p, "brand"))
                    .partType(partType(p))
                    .build());
        }
        // 이미 있는 부품: 비어 있는 필드만 채운다(관리자가 바꿔 둔 값은 그대로).
        Part part = existing.get();
        boolean[] changed = {false};
        fillIfNull(part.getImageUrl(), text(p, "imageUrl"), part::setImageUrl, changed);
        fillIfNull(part.getImageSourceUrl(), text(p, "imageSourceUrl"), part::setImageSourceUrl, changed);
        fillIfNull(part.getAiReferenceImageUrl(), text(p, "aiReferenceImageUrl"), part::setAiReferenceImageUrl, changed);
        fillIfNull(part.getSourceUrl(), text(p, "sourceUrl"), part::setSourceUrl, changed);
        fillIfNull(part.getInstallVideoUrl(), text(p, "installVideoUrl"), part::setInstallVideoUrl, changed);
        fillIfNull(part.getPartNumber(), text(p, "partNumber"), part::setPartNumber, changed);
        fillIfNull(part.getBrand(), text(p, "brand"), part::setBrand, changed);
        fillIfNull(part.getPartType(), partType(p), part::setPartType, changed);
        return changed[0] ? partRepository.save(part) : part;
    }

    private void seedCompatibility(Part part, JsonNode c, int[] created) {
        Optional<ModelYear> year = manufacturerRepository.findByName(c.get("manufacturer").asText())
                .map(Manufacturer::getId)
                .flatMap(mid -> vehicleModelRepository.findByManufacturerIdAndName(mid, c.get("vehicleModel").asText()))
                .map(VehicleModel::getId)
                .flatMap(vid -> modelYearRepository.findByVehicleModelIdAndYear(vid, c.get("year").asInt()));
        if (year.isEmpty()) {
            log.warn("호환 시드 건너뜀(연식 없음): {} / {} {}", part.getName(), c.get("vehicleModel").asText(), c.get("year").asInt());
            return;
        }
        String expectedCode = text(c, "chassisCode");
        if (expectedCode != null && !expectedCode.equals(year.get().getChassisCode())) {
            log.warn("호환 시드 건너뜀(세대 코드 불일치: 스냅샷 {} / DB {}): {}", expectedCode, year.get().getChassisCode(), part.getName());
            return;
        }
        if (compatibilityRepository.findByPartIdAndModelYearId(part.getId(), year.get().getId()).isPresent()) {
            return;
        }
        compatibilityRepository.save(Compatibility.builder()
                .part(part).modelYear(year.get()).status(c.get("status").asText()).note(text(c, "note")).build());
        created[1]++;
    }

    private void seedListing(Part part, JsonNode l, int[] created) {
        String sourceUrl = l.get("sourceUrl").asText();
        Optional<SellerListing> existing = sellerListingRepository.findFirstByPartIdAndSourceUrl(part.getId(), sourceUrl);
        if (existing.isPresent()) {
            SellerListing listing = existing.get();
            if (listing.getDisplayName() == null && text(l, "displayName") != null) {
                listing.setDisplayName(text(l, "displayName"));
                sellerListingRepository.save(listing);
            }
            return;
        }
        sellerListingRepository.save(SellerListing.builder()
                .part(part)
                .sellerName(l.get("sellerName").asText())
                .productName(text(l, "productName"))
                .displayName(text(l, "displayName"))
                .price(l.hasNonNull("price") ? l.get("price").asInt() : null)
                .sourceUrl(sourceUrl)
                .thumbnailUrl(existingUploadOrNull(text(l, "thumbnailUrl")))
                .originalImageUrl(text(l, "originalImageUrl"))
                .externalProductId(text(l, "externalProductId"))
                .createdAt(time(l, "createdAt"))
                .checkedAt(time(l, "checkedAt"))
                .build());
        created[2]++;
    }

    // /uploads/... 는 git에 없는 로컬 파일이라, 파일이 실제로 있을 때만 쓴다(없으면 화면이 원본 이미지 URL로 대신 보여준다).
    private String existingUploadOrNull(String url) {
        if (url == null || !url.startsWith("/uploads/")) return url;
        return Files.exists(Path.of(uploadDir, url.substring("/uploads/".length()))) ? url : null;
    }

    private static <T> void fillIfNull(T current, T seed, Consumer<T> setter, boolean[] changed) {
        if (current == null && seed != null) {
            setter.accept(seed);
            changed[0] = true;
        }
    }

    private static PartType partType(JsonNode p) {
        String v = text(p, "partType");
        return v == null ? null : PartType.valueOf(v);
    }

    private static LocalDateTime time(JsonNode n, String field) {
        String v = text(n, field);
        return v == null ? null : LocalDateTime.parse(v);
    }

    private static String text(JsonNode n, String field) {
        return n.hasNonNull(field) ? n.get(field).asText() : null;
    }
}
