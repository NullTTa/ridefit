package com.ridefit.ridefit.service;

import com.ridefit.ridefit.domain.AiFitResult;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.VehicleModel;
import com.ridefit.ridefit.dto.AiFitDtos.AiFitCheckResponse;
import com.ridefit.ridefit.dto.AiFitDtos.AiFitPartStatus;
import com.ridefit.ridefit.dto.AiFitDtos.AiFitResponse;
import com.ridefit.ridefit.dto.AiFitDtos.AiFitResultItem;
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
import java.util.Arrays;
import java.util.Comparator;
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

    // 프롬프트/입력 구성을 바꾸면 이 값을 올려서 예전 캐시와 구분한다(예전 결과 행/파일은 그대로 남는다).
    // v2: 차량 이미지를 AI 전용으로 framing(투명 여백 제거 + 지원 비율에 맞춤) + aspect_ratio 지정.
    private static final String PROMPT_VERSION = "v2";

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

    // 함께 장착할 부품 하나(+ 장착 위치 힌트). 컨트롤러가 부품 존재/중복을 확인한 뒤 넘긴다.
    public record PartInput(Part part, Double anchorX, Double anchorY) {
    }

    // 한 번에 함께 합성할 수 있는 부품 수(입력 이미지 = 차량 1 + 부품 N). 너무 많으면 결과가 불안정하다.
    public static final int MAX_PARTS = 4;

    // 버튼을 활성화해도 되는지 + 이미 생성된 결과가 있는지(부품 1개, 예전 API). 이미지 API를 호출하지 않는다.
    public AiFitStatusResponse status(Part part, MyVehicle vehicle, Double anchorX, Double anchorY) {
        AiFitCheckResponse check = check(List.of(new PartInput(part, anchorX, anchorY)), vehicle);
        return new AiFitStatusResponse(check.canGenerate(), check.code(), check.message(),
                check.cachedImageUrl(), check.cachedAt());
    }

    // 선택한 부품들 각각을 합성에 넣을 수 있는지 + 넣을 수 있는 부품들의 조합으로 이미 만든 결과가 있는지. API 호출 없음.
    public AiFitCheckResponse check(List<PartInput> inputs, MyVehicle vehicle) {
        List<AiFitPartStatus> statuses = new ArrayList<>();
        List<PartInput> usable = new ArrayList<>();
        for (PartInput in : inputs) {
            Readiness r = readiness(in.part(), vehicle);
            if (r.code() == null && usable.size() < MAX_PARTS) {
                usable.add(in);
                statuses.add(new AiFitPartStatus(in.part().getId(), true, "READY", null));
            } else if (r.code() == null) {
                statuses.add(new AiFitPartStatus(in.part().getId(), false, "TOO_MANY",
                        "한 번에 " + MAX_PARTS + "개 부품까지 함께 장착할 수 있어요."));
            } else {
                statuses.add(new AiFitPartStatus(in.part().getId(), false, r.code(), r.message()));
            }
        }
        if (usable.isEmpty()) {
            // 넣을 수 있는 부품이 하나도 없으면 첫 번째 부품의 사유를 대표로 보여준다.
            AiFitPartStatus first = statuses.isEmpty() ? null : statuses.get(0);
            return new AiFitCheckResponse(false, first == null ? "NO_PART" : first.code(),
                    first == null ? "부품을 선택해주세요." : first.message(), statuses, null, null);
        }
        Optional<AiFitResult> cached = aiFitResultRepository.findFirstByCacheKeyOrderByCreatedAtDescIdDesc(cacheKey(usable, vehicle));
        if (cached.isPresent()) {
            return new AiFitCheckResponse(true, "CACHED", "이전에 만든 AI 장착 이미지가 있어요.", statuses,
                    cached.get().getGeneratedImage(), cached.get().getCreatedAt());
        }
        if (!aiImageProvider.isConfigured()) {
            return new AiFitCheckResponse(false, "NOT_CONFIGURED",
                    "AI 이미지 기능이 아직 설정되지 않았어요. 기본 장착 미리보기는 그대로 사용할 수 있어요.", statuses, null, null);
        }
        return new AiFitCheckResponse(true, "READY", "AI로 장착한 모습을 만들 수 있어요.", statuses, null, null);
    }

    public AiFitResponse generate(Part part, MyVehicle vehicle, Double anchorX, Double anchorY, Long memberId) {
        return generate(List.of(new PartInput(part, anchorX, anchorY)), vehicle, memberId, false);
    }

    // 차량 사진 + 선택한 부품들의 참조 이미지를 한 번에 넣어 "모두 장착된 한 장"을 만든다.
    // regenerate=false: 같은 조합의 결과가 있으면 그것을 돌려준다(API 재호출/사용량 차감 없음).
    // regenerate=true : 같은 조합이어도 새로 만든다. 새 결과는 새 파일(UUID 이름) + 새 DB 행으로 쌓이고, 예전 결과는 그대로 남는다.
    public AiFitResponse generate(List<PartInput> inputs, MyVehicle vehicle, Long memberId, boolean regenerate) {
        if (inputs.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "장착할 부품을 선택해주세요.");
        }
        if (inputs.size() > MAX_PARTS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "한 번에 " + MAX_PARTS + "개 부품까지 함께 장착할 수 있어요.");
        }
        for (PartInput in : inputs) {
            Readiness r = readiness(in.part(), vehicle);
            if (r.code() != null) {
                throw new ApiException(HttpStatus.CONFLICT, in.part().getName() + ": " + r.message());
            }
        }
        List<Long> partIds = inputs.stream().map(in -> in.part().getId()).toList();

        String key = cacheKey(inputs, vehicle);
        Optional<AiFitResult> cached = aiFitResultRepository.findFirstByCacheKeyOrderByCreatedAtDescIdDesc(key);
        if (cached.isPresent() && !regenerate) {
            log.info("AI 장착: 저장된 결과 재사용 resultId={}, partIds={}, myVehicleId={}, image={}",
                    cached.get().getId(), partIds, vehicle.getId(), cached.get().getGeneratedImage());
            return toResponse(cached.get(), true);
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
            log.info("AI 장착 요청 시작: partIds={}, myVehicleId={}, regenerate={}, model={}",
                    partIds, vehicle.getId(), regenerate, aiImageProvider.model());

            String vehicleImagePath = vehicleImagePath(vehicle);
            ImageStorageService.StoredImage vehicleImage = imageStorageService.read(vehicleImagePath)
                    .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "차량 원본 이미지를 읽을 수 없어요."));

            // 원본 차량 사진은 그대로 두고, AI에 보낼 사본만 차량이 화면을 꽉 채우도록 다시 구도를 잡는다.
            // 결과 비율을 지정할 수 없는 제공자면 framing하지 않는다(입력/출력 비율이 어긋나 차량이 눌릴 수 있으므로 예전 그대로).
            List<String> ratios = aiImageProvider.supportedAspectRatios();
            Optional<VehicleImageFramer.Framed> framed = ratios.isEmpty()
                    ? Optional.empty() : VehicleImageFramer.frame(vehicleImage.bytes(), ratios);
            String aspectRatio = framed.map(VehicleImageFramer.Framed::aspectRatio).orElse(null);
            framed.ifPresentOrElse(
                    f -> log.info("AI 차량 이미지 framing: {}x{} -> {}x{} ({}), 차량이 가로 {}% / 세로 {}% 차지",
                            f.sourceWidth(), f.sourceHeight(), f.width(), f.height(), f.aspectRatio(),
                            Math.round(f.vehicleWidthRatio() * 100), Math.round(f.vehicleHeightRatio() * 100)),
                    () -> log.info("AI 차량 이미지 framing 생략(투명 배경이 아닌 사진이거나 비율 지정 불가) - 원본 구도 그대로 사용"));
            List<PartInput> promptInputs = framed.isEmpty() ? inputs : inputs.stream()
                    .map(in -> new PartInput(in.part(), framed.get().mapX(in.anchorX()), framed.get().mapY(in.anchorY())))
                    .toList();

            List<OpenAiImageClient.InputImage> images = new ArrayList<>();
            if (framed.isPresent()) {
                images.add(new OpenAiImageClient.InputImage("vehicle.png", "image/png", framed.get().png()));
            } else {
                images.add(new OpenAiImageClient.InputImage("vehicle." + vehicleImage.extension(), vehicleImage.mimeType(), vehicleImage.bytes()));
            }
            for (int i = 0; i < inputs.size(); i++) {
                Part part = inputs.get(i).part();
                ImageStorageService.StoredImage ref = imageStorageService.read(part.getAiReferenceImageUrl())
                        .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT,
                                part.getName() + ": 부품의 AI 장착용 이미지를 읽을 수 없어요."));
                images.add(new OpenAiImageClient.InputImage("part" + (i + 1) + "." + ref.extension(), ref.mimeType(), ref.bytes()));
            }

            // 부품이 1개일 때만(예전과 같게) 대표 이미지가 참조 이미지와 다른 파일이면 "같은 제품의 다른 사진"으로 함께 넣는다.
            String productImagePath = null;
            Part first = inputs.get(0).part();
            if (inputs.size() == 1 && first.getImageUrl() != null && !first.getImageUrl().equals(first.getAiReferenceImageUrl())) {
                Optional<ImageStorageService.StoredImage> product = imageStorageService.read(first.getImageUrl());
                if (product.isPresent()) {
                    productImagePath = first.getImageUrl();
                    images.add(new OpenAiImageClient.InputImage("product." + product.get().extension(),
                            product.get().mimeType(), product.get().bytes()));
                }
            }

            PartInput one = promptInputs.get(0);
            String prompt = promptInputs.size() == 1
                    ? buildPrompt(one.part(), vehicle, one.anchorX(), one.anchorY(), productImagePath != null)
                    : buildMultiPrompt(promptInputs, vehicle);
            byte[] generated = aiImageProvider.edit(images, prompt, aspectRatio);
            log.info("AI 장착 응답 수신: partIds={}, 결과 이미지 1장, {} bytes", partIds, generated == null ? 0 : generated.length);
            if (generated == null || generated.length == 0) {
                throw new IllegalStateException("이미지 API가 빈 결과를 돌려줬습니다.");
            }
            String storedPath = imageStorageService.storeBytes(generated, "ai-fit");
            log.info("AI 장착 결과 파일 저장: url={}, file={}", storedPath, imageStorageService.absolutePathOf(storedPath));

            AiFitResult saved = aiFitResultRepository.save(AiFitResult.builder()
                    .cacheKey(key)
                    .part(first)
                    .partIds(String.join(",", partIds.stream().map(String::valueOf).toList()))
                    .myVehicleId(vehicle.getId())
                    .vehicleModel(vehicle.getModelYear().getVehicleModel())
                    .sourceVehicleImage(vehicleImagePath)
                    .sourcePartImage(String.join(",", inputs.stream().map(in -> String.valueOf(in.part().getAiReferenceImageUrl())).toList()))
                    .sourceProductImage(productImagePath)
                    .generatedImage(storedPath)
                    .model(aiImageProvider.model())
                    .quality(aiImageProvider.quality())
                    .promptVersion(PROMPT_VERSION)
                    .requestedByMemberId(memberId)
                    .createdAt(LocalDateTime.now())
                    .build());
            log.info("AI 장착 결과 DB 저장: resultId={}, image={}", saved.getId(), saved.getGeneratedImage());
            return toResponse(saved, false);
        } catch (OpenAiImageClient.OpenAiImageException e) {
            log.warn("AI 장착 이미지 생성 실패(OpenAI): partIds={}, status={}", partIds, e.status());
            throw providerFailure(e.status());
        } catch (GeminiImageClient.GeminiImageException e) {
            log.warn("AI 장착 이미지 생성 실패(Gemini): partIds={}, status={}", partIds, e.status());
            throw providerFailure(e.status());
        } catch (MagicHourImageClient.MagicHourImageException e) {
            log.warn("AI 장착 이미지 생성 실패(Magic Hour): partIds={}, status={}", partIds, e.status());
            // 402 = 크레딧 부족/플랜 제한. 사용자에게는 429와 같은 "한도 초과" 안내를 보여준다.
            throw providerFailure(e.status() == 402 ? 429 : e.status());
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.warn("AI 장착 이미지 생성 실패: partIds={}, cause={}", partIds, e.toString());
            throw new ApiException(HttpStatus.BAD_GATEWAY,
                    "AI 이미지를 만들지 못했어요. 잠시 후 다시 시도하거나 기본 장착 미리보기를 이용해주세요.");
        } finally {
            inFlight.remove(key);
        }
    }

    // 이 차량으로 만든 장착 결과 전체(최신순). 파일/DB 행은 지우지 않으므로 만든 만큼 모두 나온다.
    public List<AiFitResultItem> results(MyVehicle vehicle, Long memberId, Map<Long, String> partNames) {
        return aiFitResultRepository.findForMyVehicle(vehicle.getId(), memberId, vehicle.getModelYear().getVehicleModel().getId())
                .stream()
                .map(r -> {
                    List<Long> ids = partIdsOf(r);
                    return new AiFitResultItem(r.getId(), r.getGeneratedImage(), ids,
                            ids.stream().map(id -> partNames.getOrDefault(id, "삭제된 부품")).toList(),
                            r.getModel(), r.getCreatedAt());
                })
                .toList();
    }

    public static List<Long> partIdsOf(AiFitResult r) {
        if (r.getPartIds() != null && !r.getPartIds().isBlank()) {
            return Arrays.stream(r.getPartIds().split(",")).map(String::trim).filter(x -> !x.isEmpty())
                    .map(Long::valueOf).toList();
        }
        return r.getPart() == null ? List.of() : List.of(r.getPart().getId());
    }

    private AiFitResponse toResponse(AiFitResult r, boolean cached) {
        return new AiFitResponse(r.getId(), r.getGeneratedImage(), cached, r.getModel(), r.getCreatedAt(), partIdsOf(r));
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

    // 부품 1개: 예전과 똑같은 키(이미 만든 결과를 그대로 재사용). 여러 개: 부품 id 순으로 정렬한 조합 전체로 만든 키.
    private String cacheKey(List<PartInput> inputs, MyVehicle vehicle) {
        if (inputs.size() == 1) {
            PartInput in = inputs.get(0);
            return cacheKey(in.part(), vehicle, in.anchorX(), in.anchorY());
        }
        StringBuilder raw = new StringBuilder(String.join("|", "multi", PROMPT_VERSION, aiImageProvider.model(),
                aiImageProvider.quality(), String.valueOf(vehicleImagePath(vehicle)), String.valueOf(vehicle.getModelYear().getId())));
        inputs.stream()
                .sorted(Comparator.comparing(in -> in.part().getId()))
                .forEach(in -> raw.append("|").append(in.part().getId()).append(":").append(in.part().getAiReferenceImageUrl())
                        .append(":").append(anchorText(in.anchorX())).append(":").append(anchorText(in.anchorY())));
        return sha256(raw.toString());
    }

    private String cacheKey(Part part, MyVehicle vehicle, Double anchorX, Double anchorY) {
        String raw = String.join("|",
                PROMPT_VERSION, aiImageProvider.model(), aiImageProvider.quality(),
                String.valueOf(part.getId()), String.valueOf(part.getAiReferenceImageUrl()),
                String.valueOf(part.getImageUrl()), String.valueOf(vehicleImagePath(vehicle)),
                String.valueOf(vehicle.getModelYear().getId()), anchorText(anchorX), anchorText(anchorY));
        return sha256(raw);
    }

    private static String sha256(String raw) {
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

    // 여러 부품을 한 장에 함께 장착하는 프롬프트. Image 1 = 차량, Image 2.. = 각 부품(순서대로).
    private String buildMultiPrompt(List<PartInput> inputs, MyVehicle vehicle) {
        ModelYear year = vehicle.getModelYear();
        VehicleModel vm = year.getVehicleModel();
        String vehicleLabel = (year.getYear() != null ? year.getYear() + " " : "")
                + vm.getManufacturer().getName() + " " + vm.getName();

        StringBuilder p = new StringBuilder();
        p.append("You are editing a photo to preview how several real aftermarket parts look when installed together on a motorcycle.\n\n");
        p.append("Image 1 is the original photo of a ").append(vehicleLabel).append(" motorcycle. ")
                .append("Keep this motorcycle exactly as it is: the same body shape, color, paint, decals, wheels, lighting, ")
                .append("background, camera angle, framing and composition.\n\n");
        p.append("Install ALL of the following ").append(inputs.size()).append(" products at the same time, each at its own mounting location:\n");
        for (int i = 0; i < inputs.size(); i++) {
            PartInput in = inputs.get(i);
            Placement placement = PLACEMENTS.get(in.part().getCategory());
            p.append("- Image ").append(i + 2).append(": \"").append(in.part().getName()).append("\" (")
                    .append(placement.englishName()).append(", category: ").append(in.part().getCategory()).append("). ")
                    .append("Mounting location: ").append(placement.location()).append(". ");
            if (in.anchorX() != null && in.anchorY() != null) {
                p.append("In Image 1 this is around ").append(Math.round(in.anchorX())).append("% from the left edge and ")
                        .append(Math.round(in.anchorY())).append("% from the top edge. ");
            }
            if (placement.replacesStockPart()) {
                p.append("If the motorcycle already has a stock ").append(placement.englishName())
                        .append(" there, replace it instead of adding a second one. ");
            }
            p.append("\n");
        }
        p.append("\nKeep each product's real shape, color, material, logo and proportions so it stays recognizable as the same product. ")
                .append("Do not replace any of them with a different or generic-looking product, and do not skip any of them.\n\n")
                .append("Scale every product realistically relative to the motorcycle - never unrealistically large or small. ")
                .append("Attach each one naturally with plausible mounting hardware, matching the perspective and lighting of Image 1. ")
                .append("Do not change any other part of the motorcycle. Do not add riders, people, text, watermarks, ")
                .append("or any other accessories. Preserve everything except the installed products. ")
                .append("Output one photorealistic image with the same framing as Image 1.");
        return p.toString();
    }
}
