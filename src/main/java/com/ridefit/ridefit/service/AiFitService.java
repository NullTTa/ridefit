package com.ridefit.ridefit.service;

import com.ridefit.ridefit.domain.AiFitResult;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.VehicleModel;
import com.ridefit.ridefit.dto.AiFitDtos.AiFitResponse;
import com.ridefit.ridefit.dto.AiFitDtos.AiFitStatusResponse;
import com.ridefit.ridefit.exception.ApiException;
import com.ridefit.ridefit.repository.AiFitResultRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

// "AI로 장착해보기" - 차량 원본 사진 + 실제 부품 참조 이미지(+ 대표 이미지)를 이미지 편집 API(OpenAI 또는 Gemini, AiImageProvider가 선택)에 넣어
// 장착된 모습을 합성한다. 기존 2D FitRoom(좌표 오버레이)과 완전히 별개로 동작하며, 여기서 무슨 일이 생겨도
// FitRoom은 영향을 받지 않는다.
//
// 비용/남용 방지:
//  - 사용자가 버튼을 눌렀을 때만 generate()가 호출된다(상태 조회 status()는 API를 호출하지 않는다).
//  - 같은 입력이면 cacheKey로 저장된 결과를 재사용한다(API 재호출 없음, 사용량 차감 없음).
//  - 실제 호출은 회원당 일일 한도(RateLimitService, 링크 가져오기와 합산) + 서비스 전체 일일 한도로 막는다.
//  - 같은 cacheKey의 요청이 동시에 두 번 들어오면(더블클릭 등) 두 번째는 거절한다.
@Slf4j
@Service
@RequiredArgsConstructor
public class AiFitService {

    // 프롬프트를 바꾸면 이 값을 올려서 예전 캐시와 구분한다.
    private static final String PROMPT_VERSION = "v1";

    // 장착 위치가 명확해 결과가 안정적인 카테고리만 우선 지원한다. 값은 프롬프트에 넣을 영어 장착 위치 설명.
    // (보호대=차체 전체 커버, 휠/시트/에어필터/엔진가드 등은 위치·형태가 애매해 후순위로 제외)
    private static final Map<String, Placement> PLACEMENTS = Map.ofEntries(
            Map.entry("프론트바구니", new Placement("front basket",
                    "mounted at the very front of the motorcycle, above the front fender and in front of the headlight/handlebar area", false)),
            Map.entry("스크린", new Placement("windscreen",
                    "mounted in front of the handlebars, rising above the headlight", false)),
            Map.entry("미러", new Placement("rear-view mirrors",
                    "on the left and right ends of the handlebars", true)),
            Map.entry("리어백", new Placement("rear bag",
                    "strapped on top of the rear carrier or pillion seat behind the rider seat", false)),
            Map.entry("사이드백", new Placement("side bag",
                    "hanging on the side of the rear section beside the rear wheel, attached to the rear carrier/seat rail", false)),
            Map.entry("캐리어", new Placement("rear carrier rack",
                    "behind the seat, above the rear fender", true)),
            Map.entry("프론트캐리어", new Placement("front carrier rack",
                    "at the front of the motorcycle, in front of the handlebars", false)),
            Map.entry("머플러", new Placement("exhaust muffler",
                    "on the exhaust side of the motorcycle, at the position of the existing muffler", true)),
            Map.entry("스마트폰거치대", new Placement("smartphone mount",
                    "clamped on the handlebar near the center", false)),
            Map.entry("USB충전기", new Placement("USB charger",
                    "attached to the handlebar", false)),
            Map.entry("탑박스", new Placement("top box",
                    "mounted on the rear carrier behind the seat", false)),
            Map.entry("배달통", new Placement("delivery box",
                    "mounted on the rear carrier behind the seat", false)),
            Map.entry("핸들바가방", new Placement("handlebar bag",
                    "attached to the front of the handlebar", false)));

    private record Placement(String englishName, String location, boolean replacesStockPart) {
    }

    private final AiFitResultRepository aiFitResultRepository;
    private final CompatibilityCheckService compatibilityCheckService;
    private final RateLimitService rateLimitService;
    private final ImageStorageService imageStorageService;
    private final AiImageProvider aiImageProvider;

    @Value("${openai.image.daily-limit:30}")
    private int globalDailyLimit;

    private final Set<String> inFlight = ConcurrentHashMap.newKeySet();

    public static Set<String> supportedCategories() {
        return PLACEMENTS.keySet();
    }

    // 버튼을 활성화해도 되는지 + 이미 생성된 결과가 있는지. OpenAI를 호출하지 않는다.
    public AiFitStatusResponse status(Part part, MyVehicle vehicle, Double anchorX, Double anchorY) {
        Readiness r = readiness(part, vehicle);
        if (r.code() != null) {
            return new AiFitStatusResponse(false, r.code(), r.message(), null, null);
        }
        Optional<AiFitResult> cached = aiFitResultRepository.findByCacheKey(cacheKey(part, vehicle, anchorX, anchorY));
        if (cached.isPresent()) {
            return new AiFitStatusResponse(true, "CACHED", "이전에 만든 AI 장착 이미지가 있어요.",
                    cached.get().getGeneratedImage(), cached.get().getCreatedAt());
        }
        if (!aiImageProvider.isConfigured()) {
            return new AiFitStatusResponse(false, "NOT_CONFIGURED",
                    "AI 이미지 기능이 아직 설정되지 않았어요. 기본 장착 미리보기는 그대로 사용할 수 있어요.", null, null);
        }
        return new AiFitStatusResponse(true, "READY", "AI로 장착한 모습을 만들 수 있어요.", null, null);
    }

    public AiFitResponse generate(Part part, MyVehicle vehicle, Double anchorX, Double anchorY, Long memberId) {
        Readiness r = readiness(part, vehicle);
        if (r.code() != null) {
            throw new ApiException(HttpStatus.CONFLICT, r.message());
        }

        String key = cacheKey(part, vehicle, anchorX, anchorY);
        Optional<AiFitResult> cached = aiFitResultRepository.findByCacheKey(key);
        if (cached.isPresent()) {
            return new AiFitResponse(cached.get().getGeneratedImage(), true, cached.get().getModel(),
                    cached.get().getCreatedAt());
        }

        if (!aiImageProvider.isConfigured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AI 이미지 기능이 아직 설정되지 않았어요. 기본 장착 미리보기는 그대로 사용할 수 있어요.");
        }
        if (aiFitResultRepository.countByCreatedAtAfter(LocalDate.now().atStartOfDay()) >= globalDailyLimit) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                    "오늘 준비된 AI 이미지 생성량을 모두 사용했어요. 내일 다시 시도해주세요.");
        }
        if (!inFlight.add(key)) {
            throw new ApiException(HttpStatus.CONFLICT, "같은 조합의 AI 이미지를 이미 만들고 있어요. 잠시만 기다려주세요.");
        }

        try {
            rateLimitService.checkAndIncrement(memberId);

            String vehicleImagePath = vehicleImagePath(vehicle);
            ImageStorageService.StoredImage vehicleImage = imageStorageService.read(vehicleImagePath)
                    .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "차량 원본 이미지를 읽을 수 없어요."));
            ImageStorageService.StoredImage referenceImage = imageStorageService.read(part.getAiReferenceImageUrl())
                    .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "부품의 AI 장착용 이미지를 읽을 수 없어요."));

            List<OpenAiImageClient.InputImage> inputs = new ArrayList<>();
            inputs.add(new OpenAiImageClient.InputImage("vehicle." + vehicleImage.extension(), vehicleImage.mimeType(), vehicleImage.bytes()));
            inputs.add(new OpenAiImageClient.InputImage("part." + referenceImage.extension(), referenceImage.mimeType(), referenceImage.bytes()));

            // 대표 이미지가 참조 이미지와 다른 파일이고 읽을 수 있으면 "같은 제품의 다른 사진"으로 함께 넣는다.
            String productImagePath = null;
            if (part.getImageUrl() != null && !part.getImageUrl().equals(part.getAiReferenceImageUrl())) {
                Optional<ImageStorageService.StoredImage> product = imageStorageService.read(part.getImageUrl());
                if (product.isPresent()) {
                    productImagePath = part.getImageUrl();
                    inputs.add(new OpenAiImageClient.InputImage("product." + product.get().extension(),
                            product.get().mimeType(), product.get().bytes()));
                }
            }

            String prompt = buildPrompt(part, vehicle, anchorX, anchorY, productImagePath != null);
            byte[] generated = aiImageProvider.edit(inputs, prompt);
            String storedPath = imageStorageService.storeBytes(generated, "ai-fit");

            AiFitResult saved = aiFitResultRepository.save(AiFitResult.builder()
                    .cacheKey(key)
                    .part(part)
                    .vehicleModel(vehicle.getModelYear().getVehicleModel())
                    .sourceVehicleImage(vehicleImagePath)
                    .sourcePartImage(part.getAiReferenceImageUrl())
                    .sourceProductImage(productImagePath)
                    .generatedImage(storedPath)
                    .model(aiImageProvider.model())
                    .quality(aiImageProvider.quality())
                    .promptVersion(PROMPT_VERSION)
                    .requestedByMemberId(memberId)
                    .createdAt(LocalDateTime.now())
                    .build());
            return new AiFitResponse(saved.getGeneratedImage(), false, saved.getModel(), saved.getCreatedAt());
        } catch (OpenAiImageClient.OpenAiImageException e) {
            throw providerFailure(e.status());
        } catch (GeminiImageClient.GeminiImageException e) {
            throw providerFailure(e.status());
        } catch (MagicHourImageClient.MagicHourImageException e) {
            // 402 = 크레딧 부족/플랜 제한. 사용자에게는 429와 같은 "한도 초과" 안내를 보여준다.
            throw providerFailure(e.status() == 402 ? 429 : e.status());
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.warn("AI 장착 이미지 생성 실패: partId={}, cause={}", part.getId(), e.toString());
            throw new ApiException(HttpStatus.BAD_GATEWAY,
                    "AI 이미지를 만들지 못했어요. 잠시 후 다시 시도하거나 기본 장착 미리보기를 이용해주세요.");
        } finally {
            inFlight.remove(key);
        }
    }

    // AI 제공자(OpenAI/Gemini/Magic Hour)가 오류로 응답했을 때의 안내. 429는 한도/요금 문제.
    private ApiException providerFailure(int status) {
        if (status == 429) {
            return new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AI 서비스 사용 한도를 초과했어요. 기본 장착 미리보기를 이용해주세요.");
        }
        return new ApiException(HttpStatus.BAD_GATEWAY,
                "AI 이미지를 만들지 못했어요. 잠시 후 다시 시도하거나 기본 장착 미리보기를 이용해주세요.");
    }

    private record Readiness(String code, String message) {
    }

    private Readiness readiness(Part part, MyVehicle vehicle) {
        if (!compatibilityCheckService.isProceedAllowed(part.getId(), vehicle.getModelYear().getId())) {
            return new Readiness("NOT_COMPATIBLE", "이 차량과 호환이 확인되지 않은 부품은 AI 장착을 할 수 없어요.");
        }
        if (!PLACEMENTS.containsKey(part.getCategory())) {
            return new Readiness("UNSUPPORTED_CATEGORY",
                    "'" + part.getCategory() + "' 카테고리는 아직 AI 장착을 지원하지 않아요.");
        }
        if (part.getAiReferenceImageUrl() == null || part.getAiReferenceImageUrl().isBlank()) {
            return new Readiness("REFERENCE_MISSING", "AI 장착용 이미지 준비 필요 - 관리자가 부품 참조 이미지를 등록하면 사용할 수 있어요.");
        }
        if (vehicleImagePath(vehicle) == null) {
            return new Readiness("VEHICLE_IMAGE_MISSING", "차량 원본 이미지가 없어 AI 장착을 할 수 없어요.");
        }
        return new Readiness(null, null);
    }

    // 사용자가 올린 내 차량 사진이 있으면 그것을, 없으면 차종 대표 사진을 쓴다(FitRoom 화면과 같은 기준).
    private String vehicleImagePath(MyVehicle vehicle) {
        if (vehicle.getPhotoUrl() != null && !vehicle.getPhotoUrl().isBlank()) return vehicle.getPhotoUrl();
        String modelImage = vehicle.getModelYear().getVehicleModel().getImageUrl();
        return modelImage == null || modelImage.isBlank() ? null : modelImage;
    }

    private String cacheKey(Part part, MyVehicle vehicle, Double anchorX, Double anchorY) {
        String raw = String.join("|",
                PROMPT_VERSION, aiImageProvider.model(), aiImageProvider.quality(),
                String.valueOf(part.getId()), String.valueOf(part.getAiReferenceImageUrl()),
                String.valueOf(part.getImageUrl()), String.valueOf(vehicleImagePath(vehicle)),
                String.valueOf(vehicle.getModelYear().getId()), anchorText(anchorX), anchorText(anchorY));
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private String anchorText(Double v) {
        return v == null ? "-" : String.valueOf(Math.round(v));
    }

    private String buildPrompt(Part part, MyVehicle vehicle, Double anchorX, Double anchorY, boolean hasProductImage) {
        ModelYear year = vehicle.getModelYear();
        VehicleModel vm = year.getVehicleModel();
        String vehicleLabel = (year.getYear() != null ? year.getYear() + " " : "")
                + vm.getManufacturer().getName() + " " + vm.getName();
        Placement placement = PLACEMENTS.get(part.getCategory());

        StringBuilder p = new StringBuilder();
        p.append("You are editing a photo to preview how a real aftermarket part looks when installed on a motorcycle.\n\n");
        p.append("Image 1 is the original photo of a ").append(vehicleLabel).append(" motorcycle. ")
                .append("Keep this motorcycle exactly as it is: the same body shape, color, paint, decals, wheels, lighting, ")
                .append("background, camera angle, framing and composition.\n\n");
        p.append("Image 2 is the actual product to install: \"").append(part.getName()).append("\" (")
                .append(placement.englishName()).append(", category: ").append(part.getCategory()).append("). ");
        if (hasProductImage) {
            p.append("Image 3 is another photo of the same product, for reference only. ");
        }
        p.append("Install exactly this product. Keep its real shape, color, material, logo and proportions so it stays ")
                .append("recognizable as the same product. Do not replace it with a different or generic-looking product.\n\n");
        p.append("Mounting location: ").append(placement.location()).append(". ")
                .append("Choose the exact mounting point that makes sense for this motorcycle and this kind of part. ");
        if (anchorX != null && anchorY != null) {
            p.append("In Image 1, the mounting point is around ").append(Math.round(anchorX)).append("% from the left edge and ")
                    .append(Math.round(anchorY)).append("% from the top edge. ");
        }
        if (placement.replacesStockPart()) {
            p.append("If the motorcycle already has a stock ").append(placement.englishName())
                    .append(" at that location, replace it with the product instead of adding a second one. ");
        }
        p.append("\n\nScale the product realistically relative to the motorcycle - never unrealistically large or small. ")
                .append("Attach it naturally with plausible mounting hardware, matching the perspective and lighting of Image 1. ")
                .append("Do not change any other part of the motorcycle. Do not add riders, people, text, watermarks, ")
                .append("or any other accessories. Preserve everything except the installed product. ")
                .append("Output one photorealistic image with the same framing as Image 1.");
        return p.toString();
    }
}
