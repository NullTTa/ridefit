package com.ridefit.ridefit.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ridefit.ridefit.domain.Comment;
import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.GuideArticle;
import com.ridefit.ridefit.domain.MaintenanceService;
import com.ridefit.ridefit.domain.Manufacturer;
import com.ridefit.ridefit.domain.Member;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.Post;
import com.ridefit.ridefit.domain.PostCategory;
import com.ridefit.ridefit.domain.PostLike;
import com.ridefit.ridefit.domain.ServiceShop;
import com.ridefit.ridefit.domain.ShopMaintenancePrice;
import com.ridefit.ridefit.domain.Trait;
import com.ridefit.ridefit.domain.VehicleInterest;
import com.ridefit.ridefit.domain.VehicleModel;
import com.ridefit.ridefit.domain.VehicleProfile;
import com.ridefit.ridefit.repository.CommentRepository;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.GuideArticleRepository;
import com.ridefit.ridefit.repository.ManufacturerRepository;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.ModelYearRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.PostLikeRepository;
import com.ridefit.ridefit.repository.PostRepository;
import com.ridefit.ridefit.repository.MaintenanceServiceRepository;
import com.ridefit.ridefit.repository.ServiceShopRepository;
import com.ridefit.ridefit.repository.ShopMaintenancePriceRepository;
import com.ridefit.ridefit.repository.VehicleInterestRepository;
import com.ridefit.ridefit.repository.VehicleModelRepository;
import com.ridefit.ridefit.repository.VehicleProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

// 2차 확장 기능(성향 추천/정보 페이지/커뮤니티 섹션/정비 서비스)이 쓰는 초기 데이터를 채운다.
// 기존 DataSeeder 이후에 실행되며, 전부 "없으면 추가"하는 방식이라 몇 번을 재시작해도 중복되지 않는다.
//
// 데이터 출처 구분:
//  - resources/seed/*.json : 실제 값으로 교체하기 쉬운 편집/개발용 데이터 (파일만 고치면 다음 기동 때 반영)
//  - 차량 프로필(VehicleProfile)은 dataSource=DEV_SEED, 매장(ServiceShop)은 sample=true 로 저장되어 화면에도 표시된다.
//  - 커뮤니티 샘플 글은 개발용 테스트 계정(@ridefit.dev)이 작성한 것으로, 실제 사용자 글이 아니다.
@Slf4j
@Component
@Order(2)
@RequiredArgsConstructor
public class ContentSeeder implements CommandLineRunner {

    private static final String DEV_SEED = "DEV_SEED";
    private static final String EDITORIAL = "EDITORIAL";

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final ManufacturerRepository manufacturerRepository;
    private final VehicleModelRepository vehicleModelRepository;
    private final ModelYearRepository modelYearRepository;
    private final VehicleProfileRepository profileRepository;
    private final VehicleInterestRepository interestRepository;
    private final GuideArticleRepository guideRepository;
    private final ServiceShopRepository shopRepository;
    private final MaintenanceServiceRepository maintenanceServiceRepository;
    private final ShopMaintenancePriceRepository shopMaintenancePriceRepository;
    private final MemberRepository memberRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final PostLikeRepository postLikeRepository;
    private final PartRepository partRepository;
    private final CompatibilityRepository compatibilityRepository;

    @Override
    @Transactional
    public void run(String... args) throws IOException {
        seedVehicleProfiles();
        seedGuideArticles();
        seedShops();
        seedShopMaintenancePrices();
        seedExpansionVehicleParts();
        seedRiderAccessoryParts();
        backfillPostCategories();
        seedCommunityPosts();
        seedInterests();
        log.info("2차 콘텐츠 시드 확인/생성 완료: 프로필 {}, 정보글 {}, 매장 {}, 정비서비스가격 {}, 게시글 {}",
                profileRepository.count(), guideRepository.count(), shopRepository.count(),
                shopMaintenancePriceRepository.count(), postRepository.count());
    }

    // ------------------------------------------------------------------ 차량 프로필

    private void seedVehicleProfiles() throws IOException {
        JsonNode root = read("seed/vehicle-profiles.json");
        for (JsonNode v : root.path("vehicles")) {
            Manufacturer manufacturer = manufacturerRepository.findByName(v.path("manufacturer").asText())
                    .orElseGet(() -> manufacturerRepository.save(
                            Manufacturer.builder().name(v.path("manufacturer").asText()).build()));

            String modelName = v.path("model").asText();
            VehicleModel model = vehicleModelRepository.findByManufacturerIdAndName(manufacturer.getId(), modelName)
                    .orElse(null);

            // 시더가 알고 있는 신규 차종만 만든다(연식은 실제 판매 시기에 맞는 값만, 프레임 코드는 모르면 null).
            if (model == null && v.has("newModel")) {
                JsonNode nm = v.get("newModel");
                model = vehicleModelRepository.save(VehicleModel.builder()
                        .manufacturer(manufacturer).name(modelName).type(nm.path("type").asText()).build());
                for (JsonNode year : nm.path("years")) {
                    modelYearRepository.save(ModelYear.builder().vehicleModel(model).year(year.asInt()).build());
                }
            }
            if (model == null) {
                log.warn("프로필 시드 건너뜀 - 차종을 찾을 수 없음: {} {}", manufacturer.getName(), modelName);
                continue;
            }

            // DataSeeder.modelImage()와 동일한 패턴 - 이미 이미지가 있으면(관리자가 직접 등록했을 수도 있으니) 덮어쓰지 않는다.
            if (model.getImageUrl() == null && v.hasNonNull("imageUrl")) {
                model.setImageUrl(v.path("imageUrl").asText());
                vehicleModelRepository.save(model);
            }

            VehicleProfile profile = profileRepository.findByVehicleModelId(model.getId()).orElse(null);
            if (profile != null && !DEV_SEED.equals(profile.getDataSource())) {
                continue; // 관리자가 실제 값으로 바꿔둔 프로필은 덮어쓰지 않는다.
            }
            if (profile == null) {
                profile = VehicleProfile.builder().vehicleModel(model).build();
            }

            profile.setDisplacementCc(v.path("displacementCc").asInt());
            profile.setBodyStyle(v.path("bodyStyle").asText());
            profile.setPriceTier(v.path("priceTier").asInt());
            profile.setSummary(v.path("summary").asText());
            profile.setPros(joinLines(v.path("pros")));
            profile.setCons(joinLines(v.path("cons")));
            profile.setDataSource(DEV_SEED);

            Map<String, Integer> scores = new HashMap<>();
            for (Trait t : Trait.values()) {
                scores.put(t.name(), v.path("traits").path(t.name()).asInt(3));
            }
            profile.getTraitScores().clear();
            profile.getTraitScores().putAll(scores);
            profileRepository.save(profile);
        }
    }

    // ------------------------------------------------------------------ 정보(부품/소모품/DIY)

    private void seedGuideArticles() throws IOException {
        JsonNode root = read("seed/guide-articles.json");
        for (JsonNode a : root.path("articles")) {
            String slug = a.path("slug").asText();
            GuideArticle article = guideRepository.findBySlug(slug).orElse(null);
            if (article != null && !EDITORIAL.equals(article.getDataSource())) {
                continue;
            }
            if (article == null) {
                article = GuideArticle.builder().slug(slug).build();
            }
            article.setType(a.path("type").asText());
            article.setTitle(a.path("title").asText());
            article.setSummary(a.path("summary").asText());
            article.setEmoji(textOrNull(a, "emoji"));
            article.setPartCategory(textOrNull(a, "partCategory"));
            article.setAppliesTo(textOrNull(a, "appliesTo"));
            article.setApplicabilityNote(textOrNull(a, "applicabilityNote"));
            article.setDifficulty(textOrNull(a, "difficulty"));
            article.setEstimatedMinutes(a.hasNonNull("estimatedMinutes") ? a.get("estimatedMinutes").asInt() : null);
            article.setProfessionalRecommended(a.path("professionalRecommended").asBoolean(false));
            article.setSortOrder(a.path("sortOrder").asInt(0));
            article.setBody(objectMapper.writeValueAsString(a.path("body")));
            article.setDataSource(EDITORIAL);
            guideRepository.save(article);
        }
    }

    // ------------------------------------------------------------------ 정비/세차 매장 (개발용 샘플)

    private void seedShops() throws IOException {
        JsonNode root = read("seed/service-shops.json");
        for (JsonNode s : root.path("shops")) {
            String name = s.path("name").asText();
            if (shopRepository.findByName(name).isPresent()) {
                continue;
            }
            List<String> menus = new ArrayList<>();
            s.path("menus").forEach(m -> menus.add(m.asText()));
            shopRepository.save(ServiceShop.builder()
                    .name(name).type(s.path("type").asText()).region(s.path("region").asText())
                    .address(s.path("address").asText()).description(s.path("description").asText())
                    .lat(s.hasNonNull("lat") ? s.get("lat").asDouble() : null)
                    .lng(s.hasNonNull("lng") ? s.get("lng").asDouble() : null)
                    .menus(menus).sample(true).build());
        }
    }

    // 매장별 서비스 고정 가격. "버튼 누를 때마다 랜덤 가격" 금지 -> DB에 저장된 값만 쓴다(ReservationController 참고).
    private void seedShopMaintenancePrices() throws IOException {
        JsonNode root = read("seed/service-shop-prices.json");

        for (JsonNode s : root.path("services")) {
            String name = s.path("name").asText();
            if (maintenanceServiceRepository.findByName(name).isPresent()) {
                continue;
            }
            maintenanceServiceRepository.save(MaintenanceService.builder()
                    .name(name)
                    .description(textOrNull(s, "description"))
                    .durationMinutes(s.hasNonNull("durationMinutes") ? s.get("durationMinutes").asInt() : null)
                    .build());
        }

        for (JsonNode shopNode : root.path("shopPrices")) {
            String shopName = shopNode.path("shopName").asText();
            ServiceShop shop = shopRepository.findByName(shopName).orElse(null);
            if (shop == null) {
                continue;
            }
            for (JsonNode priceNode : shopNode.path("prices")) {
                String serviceName = priceNode.path("service").asText();
                MaintenanceService service = maintenanceServiceRepository.findByName(serviceName).orElse(null);
                if (service == null || shopMaintenancePriceRepository.findByShop_IdAndService_Name(shop.getId(), serviceName).isPresent()) {
                    continue;
                }
                shopMaintenancePriceRepository.save(ShopMaintenancePrice.builder()
                        .shop(shop).service(service).price(priceNode.path("price").asInt())
                        .build());
            }
        }
    }

    // ------------------------------------------------------------------ 2차 확장 차종(NMAX 125 / XMAX 300 / CB125R / Versys-X 300) 부품
    //
    // 이 4개 차종은 바로 위 seedVehicleProfiles()에서 만들어지므로(DataSeeder가 아니라 여기서), 부품/호환성도
    // 여기서 함께 시딩한다. 2026-09-21 실제 스펙(휠 사이즈 등) 검증 결과를 반영해, 근거가 불확실한
    // "제조사 범용" 재사용은 하지 않았다:
    //  - 그립: 손잡이관 규격이 스쿠터 전반에서 공통이라 신뢰할 수 있는 범용 부품 -> 그대로 재사용.
    //  - 미러: 마운트 나사 규격이 모델별로 다를 수 있어 "브라켓필요"+확인 필요 note로 낮춰서 재사용.
    //  - 휠 커버/머플러/스프로킷: 휠 사이즈·형식(또는 차체 카테고리)이 달라 확정 근거가 없어 연결하지 않고,
    //    대신 각 차종 전용 신규 부품만 만들었다.
    private void seedExpansionVehicleParts() {
        List<ModelYear> nmaxYears = modelYearsOf("Yamaha", "NMAX 125");
        List<ModelYear> xmaxYears = modelYearsOf("Yamaha", "XMAX 300");
        List<ModelYear> cb125rYears = modelYearsOf("Honda", "CB125R");
        List<ModelYear> versysYears = modelYearsOf("Kawasaki", "Versys-X 300");
        if (nmaxYears.isEmpty() || xmaxYears.isEmpty() || cb125rYears.isEmpty() || versysYears.isEmpty()) {
            return; // 차량 프로필이 아직 안 만들어졌으면 건너뛴다 - 다음 재기동 때 다시 시도된다.
        }

        // 그립/미러는 DataSeeder가 Tricity/Vino용으로 이미 만들어둔 것을 그대로 재사용한다.
        partRepository.findByName("야마하 범용 핸들바 그립 세트").ifPresent(grip -> {
            for (ModelYear y : nmaxYears) compat(y, grip, "호환가능", null);
            for (ModelYear y : xmaxYears) compat(y, grip, "호환가능", null);
        });
        partRepository.findByName("야마하 범용 사이드미러 세트").ifPresent(mirror -> {
            String note = "미러 마운트 나사 규격이 모델별로 다를 수 있어 장착 전 확인이 필요합니다";
            for (ModelYear y : nmaxYears) compat(y, mirror, "브라켓필요", note);
            for (ModelYear y : xmaxYears) compat(y, mirror, "브라켓필요", note);
        });
        // "야마하 범용 알로이 휠 커버 세트"는 NMAX(13")/XMAX(전15"·후14")가 서로 휠 사이즈가 달라 연결하지 않는다.

        Part cbMuffler = part("CB125R 숏 슬립온 머플러", "머플러", 259000);
        Part cbLamp = part("CB125R LED 테일램프 세트", "램프", 42000);
        Part cbHandlebar = part("CB125R 레이싱 클립온 핸들바", "핸들바", 89000);
        partImage(cbMuffler, "/assets/parts/cb125r-slipon-exhaust.png");
        for (ModelYear y : cb125rYears) {
            compat(y, cbMuffler, "호환가능", null);
            compat(y, cbLamp, "호환가능", null);
            compat(y, cbHandlebar, "호환가능", null);
        }

        // "가와사키 범용 레이싱 머플러/휠 스프로킷"은 Ninja125·Z125(네이키드/스포츠, 17" 캐스트휠) 전용으로
        // 만들어진 부품이라 차체 카테고리와 휠 사이즈·형식이 전혀 다른 Versys-X 300(어드벤처, 전19"·후17"
        // 스포크휠)에는 연결하지 않고, 이 차종 전용 부품만 새로 만든다.
        Part versysCarrier = part("베르시스-X 300 어드벤처 리어 캐리어", "캐리어", 115000);
        Part versysScreen = part("베르시스-X 300 롱 윈드스크린", "스크린", 92000);
        partImage(versysCarrier, "/assets/parts/versys-x300-rear-carrier.png");
        for (ModelYear y : versysYears) {
            compat(y, versysCarrier, "호환가능", null);
            compat(y, versysScreen, "호환가능", null);
        }
    }

    private List<ModelYear> modelYearsOf(String manufacturerName, String modelName) {
        return manufacturerRepository.findByName(manufacturerName)
                .flatMap(m -> vehicleModelRepository.findByManufacturerIdAndName(m.getId(), modelName))
                .map(vm -> modelYearRepository.findByVehicleModelId(vm.getId()))
                .orElse(List.of());
    }

    // modelYearsOf()와 같지만 특정 연식만 골라 가져온다(신형 플랫폼에만 붙는 부품 등, 특정 세대만 연결할 때 사용).
    private List<ModelYear> modelYearsOf(String manufacturerName, String modelName, int... years) {
        Optional<VehicleModel> vm = manufacturerRepository.findByName(manufacturerName)
                .flatMap(m -> vehicleModelRepository.findByManufacturerIdAndName(m.getId(), modelName));
        if (vm.isEmpty()) {
            return List.of();
        }
        List<ModelYear> result = new ArrayList<>();
        for (int year : years) {
            modelYearRepository.findByVehicleModelIdAndYear(vm.get().getId(), year).ifPresent(result::add);
        }
        return result;
    }

    // 한국 배달/출퇴근 라이더가 실제로 많이 쓰는 보호·수납·편의 품목을 확충한다(2026-09-22).
    // 그립처럼 손잡이관 규격이 공통인 항목은 범용으로 넓게 연결하고, 배달통/리어백처럼 리어 캐리어가
    // 있어야 고정할 수 있는 품목은 이미 리어 캐리어가 연결된 차종에만 연결한다. 실제 존재하지 않는
    // 브랜드명을 지어내지 않고 전부 "범용/스탠다드" 표기로 남긴다.
    private void seedRiderAccessoryParts() {
        List<ModelYear> cubRecent = modelYearsOf("Honda", "Super Cub 110", 2021, 2023);
        List<ModelYear> pcxRecent = modelYearsOf("Honda", "PCX", 2021, 2023);
        List<ModelYear> tricityRecent = modelYearsOf("Yamaha", "Tricity 125", 2021, 2023);
        List<ModelYear> vinoAll = modelYearsOf("Yamaha", "Vino 125", 2005, 2008);
        List<ModelYear> addressRecent = modelYearsOf("Suzuki", "Address 125", 2021, 2023);
        List<ModelYear> burgmanAll = modelYearsOf("Suzuki", "Burgman Street 125", 2023, 2025);
        List<ModelYear> ninjaAll = modelYearsOf("Kawasaki", "Ninja 125", 2019, 2023);
        List<ModelYear> z125All = modelYearsOf("Kawasaki", "Z125", 2021, 2023);
        List<ModelYear> nmaxAll = modelYearsOf("Yamaha", "NMAX 125");
        List<ModelYear> xmaxAll = modelYearsOf("Yamaha", "XMAX 300");
        List<ModelYear> cbAll = modelYearsOf("Honda", "CB125R");
        List<ModelYear> versysAll = modelYearsOf("Kawasaki", "Versys-X 300");

        List<ModelYear> allExisting = new ArrayList<>();
        for (List<ModelYear> l : List.of(cubRecent, pcxRecent, tricityRecent, vinoAll, addressRecent, burgmanAll,
                ninjaAll, z125All, nmaxAll, xmaxAll, cbAll, versysAll)) {
            allExisting.addAll(l);
        }
        if (allExisting.isEmpty()) {
            return; // 아직 차량 데이터가 안 만들어졌으면 건너뛴다 - 다음 재기동 때 다시 시도된다.
        }

        // 언더본/스쿠터(스텝스루) 차체 - 방수커버는 차체 형상이 비슷한 이 그룹에만 연결한다.
        List<ModelYear> stepThrough = new ArrayList<>();
        for (List<ModelYear> l : List.of(cubRecent, pcxRecent, tricityRecent, vinoAll, addressRecent, burgmanAll, nmaxAll, xmaxAll)) {
            stepThrough.addAll(l);
        }
        // 네이키드/스포츠(노출 핸들바) 차체 - 핸드가드/너클가드는 이 그룹에만 연결한다.
        List<ModelYear> exposedHandlebar = new ArrayList<>();
        for (List<ModelYear> l : List.of(cubRecent, ninjaAll, z125All, cbAll, versysAll)) {
            exposedHandlebar.addAll(l);
        }
        // 이미 리어 캐리어가 연결돼 있는 차종만 - 배달통/리어백은 캐리어 위에 고정하는 구조라서.
        List<ModelYear> hasCarrier = new ArrayList<>();
        for (List<ModelYear> l : List.of(cubRecent, pcxRecent, tricityRecent, addressRecent)) {
            hasCarrier.addAll(l);
        }

        // ---- 배달/실용 ----
        Part phoneMount = part("범용 방수 스마트폰 거치대", "스마트폰거치대", 22000);
        Part usbSocket = part("핸들바 USB 충전 소켓 세트", "USB충전기", 18000);
        Part deliveryBoxSquare = part("스탠다드 배달통 (사각)", "배달통", 45000);
        Part deliveryBoxRound = part("대형 배달통 (원형)", "배달통", 68000);
        Part rearBag = part("방수 리어백 (캐리어 거치형)", "리어백", 39000);
        Part handlebarPouch = part("핸들바 파우치 (방수)", "핸들바가방", 19000);

        for (ModelYear y : allExisting) {
            compat(y, phoneMount, "호환가능", "핸들바 클램프 방식(22~32mm 대응), 공구 없이 장착 가능");
            compat(y, usbSocket, "브라켓필요", "배터리 상시전원 배선 연결 필요");
            compat(y, handlebarPouch, "호환가능", "핸들바 스트랩 고정 방식, 범용");
        }
        for (ModelYear y : hasCarrier) {
            compat(y, deliveryBoxSquare, "브라켓필요", "리어 캐리어 장착 차량에 한해 고정 가능");
            compat(y, deliveryBoxRound, "브라켓필요", "리어 캐리어 장착 차량에 한해 고정 가능");
            compat(y, rearBag, "브라켓필요", "리어 캐리어 위에 스트랩으로 고정");
        }

        // ---- 보호/외장 ----
        Part waterproofCoverScooter = part("차체 방수 커버 (스쿠터/맥시스쿠터용)", "보호대", 32000);
        Part waterproofCoverNaked = part("차체 방수 커버 (네이키드/스포츠용)", "보호대", 29000);
        Part handguard = part("범용 핸드가드 세트", "핸드가드", 39000);
        Part knuckleGuard = part("너클가드 (동계 방한용)", "너클가드", 25000);
        Part frontBasket = part("프론트 유틸리티 바스켓", "프론트바구니", 34000);
        Part ledFogLight = part("LED 보조 안개등 세트", "램프", 47000);
        Part leverGuard = part("범용 브레이크 레버 프로텍터", "레버", 21000);
        Part heatedGrip = part("열선 그립 세트", "핸들바", 55000);

        for (ModelYear y : stepThrough) {
            compat(y, waterproofCoverScooter, "호환가능", "차체 사이즈 기준 프리사이즈");
        }
        for (ModelYear y : exposedHandlebar) {
            compat(y, waterproofCoverNaked, "호환가능", "차체 사이즈 기준 프리사이즈");
            compat(y, handguard, "호환가능", "핸들바 외경 22mm 기준 클램프");
            compat(y, knuckleGuard, "호환가능", "핸들바 외경 22mm 기준 클램프");
        }
        for (ModelYear y : cubRecent) {
            compat(y, frontBasket, "브라켓필요", "헤드라이트 스테이 교체형 브라켓 필요");
        }
        for (ModelYear y : addressRecent) {
            compat(y, frontBasket, "브라켓필요", "핸들바 클램프형 브라켓 필요");
        }
        for (ModelYear y : vinoAll) {
            compat(y, frontBasket, "브라켓필요", "핸들바 클램프형 브라켓 필요");
        }
        for (ModelYear y : allExisting) {
            compat(y, ledFogLight, "호환가능", "핸들바 또는 포크 클램프 마운트, 배터리 배선 연결 필요");
            compat(y, leverGuard, "호환가능", "레버 볼트에 함께 고정하는 범용 클램프형");
            // 그립은 손잡이관 규격이 공통이라(2026-09-21 검증 기준) 전 차종 범용으로 연결한다.
            compat(y, heatedGrip, "브라켓필요", "배터리 상시전원 배선 연결 필요");
        }

        // ---- 엔진별 전용 부품(에어필터는 흡기 규격이 엔진마다 달라 범용 연결하지 않는다) ----
        Part cubAirFilter = part("슈퍼커브 110 고성능 에어필터 (교환식)", "에어필터", 26000);
        Part pcxAirFilter = part("PCX 고성능 에어필터 (교환식)", "에어필터", 29000);
        for (ModelYear y : cubRecent) {
            compat(y, cubAirFilter, "호환가능", "순정 에어박스 그대로 사용");
        }
        for (ModelYear y : pcxRecent) {
            compat(y, pcxAirFilter, "호환가능", "순정 에어박스 그대로 사용");
        }
    }

    // DataSeeder와 동일한 find-or-create 패턴.
    private Part part(String name, String category, int price) {
        return partRepository.findByName(name)
                .orElseGet(() -> partRepository.save(Part.builder().name(name).category(category).price(price).build()));
    }

    // DataSeeder.modelImage()/partImage()와 동일한 패턴 - 이미 이미지가 있으면 덮어쓰지 않는다.
    private void partImage(Part part, String imageUrl) {
        if (part.getImageUrl() != null) {
            return;
        }
        part.setImageUrl(imageUrl);
        partRepository.save(part);
    }

    private void compat(ModelYear modelYear, Part part, String status, String note) {
        if (compatibilityRepository.findByPartIdAndModelYearId(part.getId(), modelYear.getId()).isPresent()) {
            return;
        }
        compatibilityRepository.save(Compatibility.builder()
                .modelYear(modelYear).part(part).status(status).note(note).build());
    }

    // ------------------------------------------------------------------ 커뮤니티

    // 섹션이 생기기 전에 쓰인 글에 category/topic을 채운다(내용을 바꾸지 않고 분류만 부여).
    private void backfillPostCategories() {
        for (Post post : postRepository.findByCategoryIsNull()) {
            if (post.getInstalledPart() != null) {
                post.setCategory(PostCategory.VETERAN.name());
                post.setTopic("NOT_MATCHED".equals(post.getCompatibleFeedback()) ? "실패 경험" : "추천 부품");
            } else if (post.getTitle().contains("?") || post.getTitle().contains("까요")) {
                post.setCategory(PostCategory.NEWBIE.name());
                post.setTopic("부품 호환 질문");
            } else {
                post.setCategory(PostCategory.FREE.name());
                post.setTopic("잡담");
            }
        }
    }

    private void seedCommunityPosts() {
        Member user = member("user@ridefit.dev");
        Member riderMin = member("rider_min@ridefit.dev");
        Member scooterFan = member("scooter_fan@ridefit.dev");
        Member commuterKim = member("commuter_kim@ridefit.dev");
        Member newbiePark = member("newbie_park@ridefit.dev");
        if (user == null || riderMin == null || scooterFan == null || commuterKim == null || newbiePark == null) {
            return; // 시드 계정이 없으면 샘플 글도 만들지 않는다.
        }
        List<Member> everyone = List.of(user, riderMin, scooterFan, commuterKim, newbiePark);

        // --- 고인물 소통공간
        Post p1 = post(commuterKim, PostCategory.VETERAN, "정비 경험", 9, 3,
                "커브 3년 타면서 자리 잡은 정비 루틴 정리",
                "거창한 건 없고 이렇게만 해도 잔고장이 확 줄었어요.\n\n"
                        + "- 주행 전: 타이어 공기압(차가울 때) 눈으로 확인\n"
                        + "- 500km 안팎마다: 체인 청소 + 루브\n"
                        + "- 오일: 매뉴얼 주기보다 조금 빠르게 (저는 단거리가 많아서요)\n"
                        + "- 6개월마다: 브레이크 패드 두께 눈으로 확인\n\n"
                        + "결국 기록해 두는 게 제일 중요해요. 메모 앱에 날짜만 남겨도 다음 교환 시기 놓치지 않아요.", 61);
        comment(p1, newbiePark, "기록 팁 감사합니다! 오늘부터 메모 앱에 적어볼게요.");
        comment(p1, riderMin, "체인은 비 온 다음 날 꼭 한 번 더 봐주세요. 저도 그렇게 하고 있어요.");
        like(p1, everyone.subList(1, 5));

        Post p2 = post(riderMin, PostCategory.VETERAN, "실패 경험", 6, 5,
                "머플러 소리만 믿고 샀다가 후회한 이야기",
                "영상으로 소리 듣고 바로 주문했는데, 실제로 달아 보니 아이들링에서 너무 커서 아파트 단지에서 눈치가 보이더라고요. "
                        + "영상 소리는 마이크에 따라 완전히 다르게 들려요. 그리고 소음 기준도 미리 확인하고 사야 한다는 걸 이번에 배웠습니다. "
                        + "다음에는 호환 여부와 소음 기준 둘 다 확인하고 살 생각이에요.", 58);
        comment(p2, scooterFan, "저도 비슷한 경험이 있어요. 소리는 직접 들어보는 게 제일 정확해요.");
        like(p2, List.of(user, scooterFan, commuterKim));
        // 글 내용이 "호환 여부 확인 안 하고 샀다가 후회"라, 카탈로그에서 그 상황과 정확히 맞는
        // 유일한 머플러(구형 PCX 호환/신형 불가)와 연결한다.
        if (p2 != SKIP) {
            partRepository.findByName("구형 머플러 (2018 PCX 호환, 신형 불가)").ifPresent(part -> {
                p2.setInstalledPart(part);
                p2.setCompatibleFeedback("NOT_MATCHED");
                p2.setRating(2);
                postRepository.save(p2);
            });
        }

        Post p3 = post(scooterFan, PostCategory.VETERAN, "장거리 주행 후기", 4, 8,
                "125cc급으로 당일 300km 투어 다녀온 후기와 준비물",
                "생각보다 힘들지만 할 만했어요. 핵심은 '쉬는 간격'이었어요. 1시간마다 쉬고, 공기압/체인만 눈으로 점검했습니다.\n\n"
                        + "챙긴 것: 우비, 보조배터리, 타이어 펑크 응급 키트, 장갑 여분, 물.\n"
                        + "아쉬웠던 점: 시트가 딱딱해서 3시간 지나니 엉덩이가 아팠어요. 다음엔 시트 쪽을 손볼 생각입니다.", 72);
        comment(p3, commuterKim, "시트 때문에 고민이었는데 참고할게요!");
        comment(p3, newbiePark, "쉬는 간격 팁 좋네요. 다음 주말에 따라 해볼게요.");
        like(p3, List.of(user, riderMin, commuterKim, newbiePark));

        Post p4 = post(user, PostCategory.VETERAN, "초보자에게 팁", 3, 2,
                "초보자에게 꼭 알려주고 싶은 장갑·헬멧 팁",
                "처음에는 성능보다 안전 장비에 먼저 투자하세요. 헬멧은 꼭 써보고 사고, 사이즈가 조금이라도 헐거우면 다음 사이즈로 가지 마세요. "
                        + "장갑은 여름용/겨울용 두 개를 두면 좋고, 손목 부분이 긴 걸 추천해요.", 45);
        like(p4, List.of(riderMin, scooterFan, newbiePark));

        // --- 뉴비 질문공간
        Post q1 = post(newbiePark, PostCategory.NEWBIE, "소모품·오일", 5, 1,
                "엔진오일 10W-30이랑 10W-40이 뭐가 다른가요?",
                "정비소에서 오일 뭐 쓸지 물어보는데 잘 모르겠어요. 숫자가 큰 게 더 좋은 건가요? 그리고 오토바이 전용이 따로 있다던데 맞나요?", 39);
        comment(q1, commuterKim, "뒤 숫자는 엔진이 뜨거울 때의 끈적함이에요. 큰 게 더 좋은 게 아니라 매뉴얼에 적힌 걸 쓰는 게 맞아요. "
                + "오토바이는 JASO MA/MB 같은 표기도 확인해보세요. 정보 메뉴의 엔진오일 글에 정리돼 있어요.");
        comment(q1, riderMin, "저도 처음엔 큰 게 좋은 줄 알았어요 ㅎㅎ 매뉴얼 기준이 정답입니다.");
        like(q1, List.of(user, commuterKim));

        Post q2 = post(newbiePark, PostCategory.NEWBIE, "구매·입문", 8, 6,
                "처음 바이크 사면 제일 먼저 해야 할 것 알려주세요",
                "다음 주에 첫 바이크를 받아요. 보험이랑 헬멧 말고 또 뭐부터 하면 좋을까요?", 51);
        comment(q2, user, "1) 공기압/오일량 확인 2) 사이드스탠드·브레이크 작동 확인 3) 한적한 곳에서 제동 연습 순서로 해보세요.");
        comment(q2, scooterFan, "차고에 등록해두면 호환 부품 확인하기 좋아요. 사이트에서 차량 등록부터 해보세요!");
        like(q2, List.of(user, riderMin, scooterFan));

        Post q3 = post(commuterKim, PostCategory.NEWBIE, "이 증상 정상인가요?", 2, 10,
                "출발할 때 뒤에서 '드르륵' 소리가 나는데 정상인가요?",
                "스쿠터인데 출발할 때만 살짝 드르륵 소리가 나요. 몇 주 전부터 시작됐어요. 이런 소리 원래 나나요?", 28);
        comment(q3, scooterFan, "정확한 진단은 직접 보고 해야 해서, 소리가 계속되면 정비소에서 확인해보시는 걸 추천해요.");
        like(q3, List.of(newbiePark));

        Post q4 = post(newbiePark, PostCategory.NEWBIE, "투어 준비", 1, 3,
                "첫 1박 2일 투어, 준비물 뭐 챙기세요?",
                "다음 달에 처음으로 1박 2일 투어를 가보려고 해요. 장비 말고 정비 쪽으로 미리 확인해야 할 게 있을까요?", 33);
        comment(q4, riderMin, "출발 전에 타이어 공기압, 체인 상태, 오일량, 브레이크 정도는 꼭 보세요. 정보 메뉴의 DIY 가이드에 점검 방법이 있어요.");
        like(q4, List.of(user, scooterFan));

        // --- 자유게시판
        Post f1 = post(user, PostCategory.FREE, "사진", 7, 4,
                "퇴근길 노을 사진 한 장",
                "오늘 퇴근길에 잠깐 세워서 찍은 사진이에요. 이런 날이면 돌아가는 길도 즐거워요.", 47);
        like(f1, List.of(riderMin, scooterFan, commuterKim));

        Post f2 = post(scooterFan, PostCategory.FREE, "라이딩", 5, 6,
                "주말 라이딩 코스 추천 받아요",
                "왕복 100km 안쪽으로 다녀올 수 있는 한적한 코스 있으면 추천 부탁드려요. 국도 위주면 더 좋아요.", 30);
        comment(f2, commuterKim, "강변 코스 좋아요. 평일 이른 아침이 제일 한적했어요.");
        comment(f2, riderMin, "저는 산 넘어가는 국도를 좋아하는데 커브길은 속도 조심하세요!");
        like(f2, List.of(user, riderMin));

        Post f3 = post(commuterKim, PostCategory.FREE, "차량 자랑", 3, 9,
                "오늘 세차하고 나니 기분 최고",
                "오랜만에 손세차하고 왁스까지 쳤더니 새 차 같아요. 바이크는 닦은 만큼 티가 나는 것 같아요.", 25);
        like(f3, List.of(newbiePark, scooterFan));

        Post f4 = post(riderMin, PostCategory.FREE, "잡담", 1, 2,
                "겨울에 다들 뭐 하세요?",
                "날이 추워지니 라이딩을 쉬게 되네요. 여러분은 겨울에 바이크 어떻게 보관하고 어떻게 지내세요?", 19);
        comment(f4, user, "배터리 충전기 물려두고 정비 공부하고 있어요 ㅎㅎ");
        like(f4, List.of(user));

        // 각 글의 추천수 카운터는 방금 만든 PostLike 행 개수에 맞춘다.
        for (Post p : List.of(p1, p2, p3, p4, q1, q2, q3, q4, f1, f2, f3, f4)) {
            if (p != SKIP) {
                postLikeRepository.flush();
                p.setLikeCount((int) postLikeRepository.countByPostId(p.getId()));
            }
        }
    }

    private void seedInterests() {
        Member user = member("user@ridefit.dev");
        if (user == null || !interestRepository.findByMemberIdOrderByCreatedAtDesc(user.getId()).isEmpty()) {
            return;
        }
        for (String[] target : new String[][] {{"Yamaha", "NMAX 125"}, {"Kawasaki", "Ninja 125"}}) {
            manufacturerRepository.findByName(target[0])
                    .flatMap(m -> vehicleModelRepository.findByManufacturerIdAndName(m.getId(), target[1]))
                    .ifPresent(model -> interestRepository.save(VehicleInterest.builder()
                            .member(user).vehicleModel(model).createdAt(LocalDateTime.now()).build()));
        }
    }

    // ------------------------------------------------------------------ helpers

    private Post post(Member author, PostCategory category, String topic, int daysAgo, int hoursAgo,
                      String title, String content, int viewCount) {
        // 같은 제목의 글이 이미 있으면(재기동) 새로 만들지 않고, 기존 글은 null을 돌려 후속 처리(댓글/추천)를 건너뛴다.
        if (postRepository.existsByTitle(title)) {
            return SKIP;
        }
        return postRepository.save(Post.builder()
                .author(author).category(category.name()).topic(topic).title(title).content(content)
                .viewCount(viewCount)
                .createdAt(LocalDateTime.now().minusDays(daysAgo).minusHours(hoursAgo))
                .build());
    }

    // 이미 있던 글을 가리키는 표식(재기동 시). 댓글/추천 시드를 건너뛰는 데만 쓴다.
    private static final Post SKIP = Post.builder().build();

    private void comment(Post post, Member author, String content) {
        if (post == SKIP) return;
        commentRepository.save(Comment.builder()
                .post(post).author(author).content(content)
                .createdAt(post.getCreatedAt().plusHours(1 + commentRepository.findByPostIdOrderByCreatedAtAsc(post.getId()).size()))
                .build());
    }

    private void like(Post post, List<Member> members) {
        if (post == SKIP) return;
        for (Member m : members) {
            postLikeRepository.save(PostLike.builder()
                    .post(post).member(m).createdAt(post.getCreatedAt().plusHours(2)).build());
        }
    }

    private Member member(String email) {
        return memberRepository.findByEmail(email).orElse(null);
    }

    private JsonNode read(String path) throws IOException {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return objectMapper.readTree(in);
        }
    }

    private static String textOrNull(JsonNode node, String field) {
        return node.hasNonNull(field) ? node.get(field).asText() : null;
    }

    private static String joinLines(JsonNode array) {
        List<String> lines = new ArrayList<>();
        array.forEach(n -> lines.add(n.asText()));
        return String.join("\n", lines);
    }
}
