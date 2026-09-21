package com.ridefit.ridefit.config;

import com.ridefit.ridefit.domain.Comment;
import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.Favorite;
import com.ridefit.ridefit.domain.MaintenanceSpec;
import com.ridefit.ridefit.domain.Manufacturer;
import com.ridefit.ridefit.domain.Member;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.PartConflict;
import com.ridefit.ridefit.domain.Post;
import com.ridefit.ridefit.domain.RecentPartCheck;
import com.ridefit.ridefit.domain.Role;
import com.ridefit.ridefit.domain.SellerListing;
import com.ridefit.ridefit.domain.VehicleModel;
import com.ridefit.ridefit.repository.CommentRepository;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.FavoriteRepository;
import com.ridefit.ridefit.repository.ManufacturerRepository;
import com.ridefit.ridefit.repository.MaintenanceSpecRepository;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.ModelYearRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.PartConflictRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.PostRepository;
import com.ridefit.ridefit.repository.RecentPartCheckRepository;
import com.ridefit.ridefit.repository.SellerListingRepository;
import com.ridefit.ridefit.repository.VehicleModelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

// 개발/데모용 시드 데이터. Honda/Yamaha/Suzuki/Kawasaki 기준 샘플 차량+부품+호환성+충돌 데이터,
// 판매처(최저가 비교), 커뮤니티 게시글, 테스트 계정을 넣어둔다.
// 항목마다 이미 존재하면 건너뛰는 방식(idempotent)이라, DB가 이미 예전 시드로 채워져 있어도
// 앱을 재시작하면 새로 추가된 시드만 안전하게 채워진다.
@Slf4j
@Order(1)
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final ManufacturerRepository manufacturerRepository;
    private final VehicleModelRepository vehicleModelRepository;
    private final MaintenanceSpecRepository maintenanceSpecRepository;
    private final ModelYearRepository modelYearRepository;
    private final PartRepository partRepository;
    private final CompatibilityRepository compatibilityRepository;
    private final PartConflictRepository partConflictRepository;
    private final SellerListingRepository sellerListingRepository;
    private final MemberRepository memberRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final MyVehicleRepository myVehicleRepository;
    private final FavoriteRepository favoriteRepository;
    private final RecentPartCheckRepository recentPartCheckRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        Manufacturer honda = manufacturer("Honda");
        Manufacturer yamaha = manufacturer("Yamaha");
        Manufacturer suzuki = manufacturer("Suzuki");
        Manufacturer kawasaki = manufacturer("Kawasaki");

        VehicleModel superCub = vehicleModel(honda, "Super Cub 110", "커브");
        VehicleModel pcx = vehicleModel(honda, "PCX", "맥시스쿠터");
        VehicleModel tricity = vehicleModel(yamaha, "Tricity 125", "쓰리휠 스쿠터");
        VehicleModel vino = vehicleModel(yamaha, "Vino 125", "스쿠터");
        VehicleModel address = vehicleModel(suzuki, "Address 125", "스쿠터");
        VehicleModel burgmanStreet = vehicleModel(suzuki, "Burgman Street 125", "맥시스쿠터");
        VehicleModel ninja125 = vehicleModel(kawasaki, "Ninja 125", "스포츠");
        VehicleModel z125 = vehicleModel(kawasaki, "Z125", "네이키드");

        // 실제 차량 사진이 있는 모델만 등록해둔다. 나머지는 프론트에서 임시 아이콘을 그대로 보여준다.
        modelImage(superCub, "/assets/vehicles/super-cub-110.png");

        // 슈퍼커브 110 엔진오일: 교환주기/오일량은 혼다 공식 고객지원 FAQ 기준(신뢰도 높음).
        // 점도(SAE)/JASO/API 등급은 혼다 순정 오일 제품라인(Ultra G1 STANDARD) 표기를 참고한 값으로,
        // 슈퍼커브110에 정확히 지정된 등급인지는 별도 확인이 필요해 note에 그대로 남겨둔다.
        // 커뮤니티에서 흔한 "합성유면 3,000km 이상 더 타도 된다" 같은 주장은 제조사 근거가 없어 반영하지 않았다.
        maintenanceSpec(superCub, "ENGINE_OIL", "엔진오일",
                "SAE 5W-30 · JASO MA · API SL (혼다 순정 오일 제품라인 기준 — 슈퍼커브110 전용 지정 등급 재확인 필요)",
                0.8, 0.85, 1000, 1, 3000, 12,
                "Honda 공식 고객지원 FAQ (일본)",
                "https://faq.honda.co.jp/",
                "교환주기(초회 1,000km·1개월 / 이후 3,000km·1년)와 오일량(0.8L, 필터 교환 시 0.85L)은 혼다 공식 FAQ 기준입니다. "
                        + "점도/JASO/API 등급은 혼다 순정 오일 제품라인 표기를 참고한 값이라 슈퍼커브110 전용 지정 등급인지 재확인이 필요합니다. "
                        + "\"합성유는 3,000km 이상 타도 된다\"처럼 제조사 근거 없이 커뮤니티에서만 통용되는 주장은 반영하지 않았습니다.");

        // 연식/세대(프레임 코드)는 검색으로 확인한 실제 값만 사용한다(지어내지 않음). 코드가 붙어있으면
        // "같은 코드끼리는 부품이 호환된다"는 걸 사용자가 알아볼 수 있게 라벨에 그대로 노출된다(ModelYearLabel).
        // 혼다 커브/PCX는 세대별 코드가 국내에 잘 알려져 있어 예전 연식까지 추가해서 세대 대비를 보여준다.
        // 확실한 코드를 찾지 못한 모델(야마하/스즈키/가와사키 일부)은 코드를 지어내는 대신 null로 비워두되,
        // 연식 자체는 실제 판매/생산 시기에 맞게 바로잡았다.
        //
        // Honda Super Cub 110: JA07(2009~, "동글이") -> JA10(2011~2017, "각진놈") -> JA44(2018~, 복고 디자인)
        ModelYear cub10 = modelYear(superCub, 2010, "JA07");
        ModelYear cub15 = modelYear(superCub, 2015, "JA10");
        ModelYear cub21 = modelYear(superCub, 2021, "JA44");
        ModelYear cub23 = modelYear(superCub, 2023, "JA44");
        // Honda PCX125: JF28(2010~2013) -> JF56(2014~2017) -> JF81(2018~). 예전 시드의 "KF30"은
        // 검색해보니 실제로는 다른(150cc 계열) 코드라 잘못된 값이었어서 JF81로 바로잡는다.
        ModelYear pcx11 = modelYear(pcx, 2011, "JF28");
        ModelYear pcx16 = modelYear(pcx, 2016, "JF56");
        ModelYear pcx21 = modelYear(pcx, 2021, "JF81");
        ModelYear pcx23 = modelYear(pcx, 2023, "JF81");
        setChassisCode(pcx21, "KF30", "JF81");
        setChassisCode(pcx23, "KF30", "JF81");

        ModelYear tricity21 = modelYear(tricity, 2021, null);
        ModelYear tricity23 = modelYear(tricity, 2023, null);
        // Yamaha Vino 125: 국내엔 2004~2009년식으로만 판매되고 단종됨(2021/2023년식은 존재하지 않아 실제
        // 판매 시기로 바로잡음). 코드는 국내 부품몰 분류 기준 "5YR" 사용.
        ModelYear vino05 = modelYear(vino, 2005, "5YR");
        ModelYear vino08 = modelYear(vino, 2008, "5YR");
        // Suzuki Address 125: 2008년 국내 첫 출시(구형 플랫폼) -> 2021년 풀체인지(프레임/엔진 신설계).
        ModelYear address15 = modelYear(address, 2015, null);
        ModelYear address21 = modelYear(address, 2021, null);
        ModelYear address23 = modelYear(address, 2023, null);
        // Suzuki Burgman Street 125: 국내엔 2023년에야 처음 출시되어, 그 이전 연식은 존재하지 않는다
        // (예전 시드의 2021년식은 실제로 국내에 없던 연식이라 바로잡음).
        ModelYear burgman23 = modelYear(burgmanStreet, 2023, null);
        ModelYear burgman25 = modelYear(burgmanStreet, 2025, null);
        ModelYear ninja19 = modelYear(ninja125, 2019, null);
        ModelYear ninja23 = modelYear(ninja125, 2023, null);
        // Kawasaki Z125: 형식코드 BR125(K/L 세부형식까지는 연식별로 명확히 확인되지 않아 접두 코드만 사용).
        ModelYear z12521 = modelYear(z125, 2021, "BR125");
        ModelYear z12523 = modelYear(z125, 2023, "BR125");
        setChassisCode(z12521, null, "BR125");
        setChassisCode(z12523, null, "BR125");

        // ---- Honda 부품 (기존) ----
        Part cubMuffler = part("순정 스타일 스테인리스 머플러 (Cub 110)", "머플러", 189000);
        Part cubCarrier = part("리어 확장 캐리어 (Cub 110)", "캐리어", 65000);
        Part cubMirror = part("범용 백미러 세트 (Cub 110)", "미러", 32000);
        Part cubSeat = part("펀칭 가죽 시트 커버 (Cub 110)", "시트", 48000);
        Part pcxScreen = part("스포츠 윈드스크린 (PCX)", "스크린", 79000);
        Part pcxCarrier = part("탑박스 캐리어 (PCX)", "캐리어", 95000);
        Part pcxLever = part("알루미늄 브레이크 레버 세트 (PCX)", "레버", 54000);
        Part pcxLamp = part("LED 방향지시등 세트 (PCX)", "램프", 38000);
        Part pcxOldMuffler = part("구형 머플러 (2018 PCX 호환, 신형 불가)", "머플러", 210000);

        // JA44 세대(2018~) 전용 부품 — 바디/배기 형상이 이전 세대(JA07/JA10)와 달라서 옛 연식엔 안 맞는다.
        compat(cub21, cubMuffler, "호환가능", "정품 브라켓 포함");
        compat(cub23, cubMuffler, "호환가능", "정품 브라켓 포함");
        compat(cub21, cubCarrier, "브라켓필요", "별도 서브 브라켓 구매 필요");
        compat(cub23, cubCarrier, "호환가능", null);
        compat(cub23, cubSeat, "호환가능", null);
        // 범용 클램프온 미러는 핸들바 규격이 같아서 세대를 넘어 두루 호환된다 — 세대별로 다른 부품과 대비됨.
        for (ModelYear y : List.of(cub10, cub15, cub21, cub23)) {
            compat(y, cubMirror, "호환가능", null);
        }

        // JF81 세대(2018~) 전용 부품. JF28/JF56은 프레임 자체가 언더본->더블크래들로 바뀌어서 대부분 안 맞는다.
        compat(pcx21, pcxScreen, "호환가능", null);
        compat(pcx23, pcxScreen, "호환가능", null);
        compat(pcx21, pcxCarrier, "호환가능", "탑케이스 별매");
        compat(pcx23, pcxCarrier, "호환가능", "탑케이스 별매");
        compat(pcx21, pcxLever, "호환가능", null);
        compat(pcx23, pcxLever, "호환가능", null);
        compat(pcx21, pcxOldMuffler, "호환불가", "구형 배기 매니폴드 규격이 달라 장착 불가");
        compat(pcx23, pcxOldMuffler, "호환불가", "구형 배기 매니폴드 규격이 달라 장착 불가");
        // LED 방향지시등은 커넥터 규격이 오래 유지돼서 구형(JF28/JF56)에도 그대로 맞는다.
        for (ModelYear y : List.of(pcx11, pcx16, pcx21, pcx23)) {
            compat(y, pcxLamp, "호환가능", null);
        }

        // ---- Yamaha 부품 (Tricity 125 / Vino 125) ----
        Part yamahaGrip = part("야마하 범용 핸들바 그립 세트", "핸들바", 18000);
        Part yamahaMirror = part("야마하 범용 사이드미러 세트", "미러", 29000);
        Part tricityCarrier = part("트리시티 프론트 유틸리티 캐리어", "캐리어", 89000);
        Part tricityScreen = part("트리시티 스포츠 윈드스크린", "스크린", 95000);
        Part vinoSeat = part("비노 레트로 시트 커버", "시트", 42000);
        Part vinoMuffler = part("비노 크롬 슬립온 머플러", "머플러", 175000);
        // "야마하 범용 알로이 휠 커버 세트"는 카탈로그(및 아래 부품 충돌 데이터)에는 남겨두되
        // compatibility는 연결하지 않는다 — Tricity(전14"/후12")와 Vino(10")조차 서로 휠 사이즈가
        // 달라, 하나의 휠 커버가 두 차종 모두에 확정 호환된다고 볼 근거가 없다(2026-09-21 검증).
        // 이후 NMAX/XMAX에도 같은 이유로 연결하지 않았다 — ContentSeeder.seedExpansionVehicleParts() 참고.
        Part yamahaWheel = part("야마하 범용 알로이 휠 커버 세트", "휠", 36000);

        for (ModelYear y : List.of(tricity21, tricity23, vino05, vino08)) {
            compat(y, yamahaGrip, "호환가능", null);
            compat(y, yamahaMirror, "호환가능", null);
        }
        compat(tricity21, tricityCarrier, "호환가능", null);
        compat(tricity23, tricityCarrier, "호환가능", null);
        compat(tricity21, tricityScreen, "브라켓필요", "별도 스크린 마운트 브라켓 필요");
        compat(tricity23, tricityScreen, "브라켓필요", "별도 스크린 마운트 브라켓 필요");
        // vino05/vino08은 같은 세대(5YR)라 부품이 그대로 호환된다.
        compat(vino05, vinoSeat, "호환가능", null);
        compat(vino08, vinoSeat, "호환가능", null);
        compat(vino05, vinoMuffler, "호환가능", "정품 개스킷 포함");
        compat(vino08, vinoMuffler, "호환가능", "정품 개스킷 포함");

        // ---- Suzuki 부품 (Address 125 / Burgman Street 125) ----
        Part suzukiLamp = part("스즈키 범용 LED 방향지시등 세트", "램프", 33000);
        Part addressCarrier = part("어드레스 언더시트 수납 캐리어", "캐리어", 58000);
        Part addressWheel = part("어드레스 경량 알로이 휠", "휠", 210000);
        Part burgmanSeat = part("버그만 스트리트 통풍 시트", "시트", 68000);
        Part burgmanMirror = part("버그만 스트리트 크롬 사이드미러", "미러", 47000);
        Part suzukiMuffler = part("스즈키 범용 스포츠 머플러", "머플러", 198000);
        Part addressVisor = part("어드레스 스크린 바이저", "스크린", 39000);

        // address15(풀체인지 이전 구형 플랫폼)는 일부러 이 범용 목록에서 빼둔다 — 지금 카탈로그의
        // 부품들은 2021년 풀체인지 이후 신형 플랫폼 기준이라 구형엔 실제로 맞지 않을 가능성이 높다.
        for (ModelYear y : List.of(address21, address23, burgman23, burgman25)) {
            compat(y, suzukiLamp, "호환가능", null);
            compat(y, suzukiMuffler, "브라켓필요", "전용 마운트 브라켓 별매");
        }
        compat(address21, addressCarrier, "호환가능", null);
        compat(address23, addressCarrier, "호환가능", null);
        compat(address23, addressWheel, "브라켓필요", "타이어 사이즈 변경 필요");
        compat(burgman23, burgmanSeat, "호환가능", null);
        compat(burgman25, burgmanSeat, "호환가능", null);
        compat(burgman23, burgmanMirror, "호환가능", null);
        compat(burgman25, burgmanMirror, "호환가능", null);
        compat(address21, addressVisor, "호환가능", null);
        compat(address23, addressVisor, "호환가능", null);
        compat(address15, addressVisor, "호환불가", "2021년 풀체인지 이전 구형 플랫폼은 전면부 형상이 달라 장착 불가");

        // ---- Kawasaki 부품 (Ninja 125 / Z125) ----
        Part kawasakiMuffler = part("가와사키 범용 레이싱 머플러", "머플러", 245000);
        Part ninjaScreen = part("닌자125 스포츠 윈드스크린", "스크린", 87000);
        Part ninjaClipOn = part("닌자125 레이싱 클립온 핸들바", "핸들바", 132000);
        Part z125Mirror = part("Z125 스트리트 사이드미러 세트", "미러", 41000);
        Part z125Lever = part("Z125 브레이크 레버 세트", "레버", 56000);
        Part kawasakiWheel = part("가와사키 범용 휠 스프로킷 세트", "휠", 119000);
        Part ninjaSeatCowl = part("닌자125 레이스 시트카울", "시트", 145000);

        for (ModelYear y : List.of(ninja19, ninja23, z12521, z12523)) {
            compat(y, kawasakiMuffler, "브라켓필요", "레이스용 서브 브라켓 필요");
            compat(y, kawasakiWheel, "호환가능", null);
        }
        compat(ninja19, ninjaScreen, "호환가능", null);
        compat(ninja23, ninjaScreen, "호환가능", null);
        compat(ninja23, ninjaClipOn, "호환가능", "순정 핸들바 제거 필요");
        compat(z12521, z125Mirror, "호환가능", null);
        compat(z12523, z125Mirror, "호환가능", null);
        compat(z12521, z125Lever, "호환가능", null);
        compat(z12523, z125Lever, "호환가능", null);
        compat(ninja19, ninjaSeatCowl, "호환가능", null);
        compat(ninja23, ninjaSeatCowl, "호환불가", "페어링 형상이 변경되어 장착 불가");

        // ---- 부품 충돌 ----
        conflict(pcxCarrier, pcxScreen, "탑박스 캐리어 장착 시 스크린 브라켓과 볼트 위치가 겹쳐 동시 장착이 어렵습니다.");
        conflict(cubCarrier, cubSeat, "확장 캐리어의 후방 스테이가 시트 커버 고정 클립과 간섭합니다.");
        conflict(tricityCarrier, tricityScreen, "전면 마운트 브라켓 위치가 겹쳐 동시 장착이 어렵습니다.");
        conflict(vinoMuffler, yamahaWheel, "배기열이 휠 커버 소재에 변형을 일으킬 수 있습니다.");
        conflict(addressWheel, suzukiMuffler, "머플러 장착 시 휠과의 배기 클리어런스가 부족합니다.");
        conflict(burgmanMirror, suzukiLamp, "미러 스테이와 방향지시등 마운트 위치가 겹칩니다.");
        conflict(ninjaScreen, ninjaClipOn, "클립온 핸들바 장착 시 스크린 마운트와 간섭이 발생합니다.");

        // ---- 설치 방법 영상 (관리자 "설치 영상 관리" 화면이 비어 보이지 않도록 일부만 채움) ----
        installVideo(cubMuffler, "https://www.youtube.com/watch?v=49VFFTYepdA");
        installVideo(cubCarrier, "https://www.youtube.com/watch?v=is2SxPzgBAY");
        installVideo(pcxCarrier, "https://www.youtube.com/watch?v=5J07BCV-34I");

        // ---- 판매처(최저가 비교) ----
        listing(cubMuffler, "바이크나라", 189000, "https://example-shop.test/bikenara/cub-muffler");
        listing(cubMuffler, "모토스토어", 179000, "https://example-shop.test/motostore/cub-muffler");
        listing(cubMuffler, "라이더샵", 195000, "https://example-shop.test/ridershop/cub-muffler");
        listing(pcxCarrier, "PCX전문샵", 95000, "https://example-shop.test/pcxshop/carrier");
        listing(pcxCarrier, "스쿠터월드", 89000, "https://example-shop.test/scooterworld/pcx-carrier");
        listing(tricityCarrier, "야마하부품샵", 89000, "https://example-shop.test/yamahaparts/tricity-carrier");
        listing(tricityCarrier, "트리시티클럽", 84000, "https://example-shop.test/tricityclub/carrier");
        listing(tricityCarrier, "스쿠터마켓", 92000, "https://example-shop.test/scootermarket/tricity-carrier");
        listing(addressCarrier, "스즈키부품몰", 58000, "https://example-shop.test/suzukiparts/address-carrier");
        listing(addressCarrier, "어드레스클럽", 61000, "https://example-shop.test/addressclub/carrier");
        listing(z125Mirror, "가와사키파츠", 41000, "https://example-shop.test/kawasakiparts/z125-mirror");
        listing(z125Mirror, "네이키드샵", 38000, "https://example-shop.test/nakedshop/z125-mirror");
        listing(z125Mirror, "바이크팩토리", 43000, "https://example-shop.test/bikefactory/z125-mirror");
        listing(cubMirror, "커브가족", 30000, "https://example-shop.test/cubfamily/basic-mirror");
        listing(cubMirror, "바이크나라", 33000, "https://example-shop.test/bikenara/cub-mirror");
        listing(cubSeat, "커브가족", 46000, "https://example-shop.test/cubfamily/punching-seat-cover");
        listing(cubSeat, "바이크나라", 49500, "https://example-shop.test/bikenara/cub-seat-cover");
        listing(pcxLever, "PCX전문샵", 52000, "https://example-shop.test/pcxshop/brake-lever");
        listing(pcxLever, "라이더샵", 55500, "https://example-shop.test/ridershop/pcx-lever");
        listing(pcxLamp, "스쿠터마켓", 36500, "https://example-shop.test/scootermarket/led-blinker");
        listing(pcxLamp, "PCX전문샵", 39000, "https://example-shop.test/pcxshop/led-signal");
        listing(tricityScreen, "야마하부품샵", 91000, "https://example-shop.test/yamahaparts/tricity-screen");
        listing(tricityScreen, "트리시티클럽", 97000, "https://example-shop.test/tricityclub/screen");

        // ---- 인기 부품 초기 지표 (실사용 기록이 쌓이기 전, 데모에서 "인기 부품" 섹션을 보여주기 위한 값) ----
        // popularity()는 view/fitSelection이 아직 0/0일 때만 값을 채운다 - 실사용자가 실제로 조회/장착해본
        // 뒤에는(0이 아니게 된 뒤에는) 재기동해도 이 초기값으로 덮어쓰지 않는다.
        popularity(cubCarrier, 33, 8);
        popularity(tricityCarrier, 21, 5);
        popularity(addressCarrier, 18, 3);
        popularity(kawasakiMuffler, 26, 7);
        popularity(z125Mirror, 15, 2);
        popularity(ninjaSeatCowl, 12, 4);

        // ---- 실제 확보한 부품 사진 연결 (2026-09-21, 사용자가 직접 구한 이미지만 사용) ----
        // Super Cub 110 이미지 3장은 이 시더가 만드는 cub10/15/21/23(JA07/JA10/JA44)이 아니라,
        // 실제로 등록된 데모 차고 3건이 전부 쓰는 "2025년식(JA71, model_year id=1)"의 호환 부품
        // (id 13/15/19)에 연결한다 - 그 부품들은 이 시더가 아니라 이전에 DB에 직접 만들어진
        // 것들이라(findByName만, 없으면 조용히 건너뜀) 아래에서 이름으로 찾아 연결한다.
        // 위 이름의 부품이 없는 DB(시더가 만든 Cub 110 부품만 있는 경우)에서는 시더가 만든 부품에 직접 연결한다.
        // partImage()는 이미 이미지가 있으면 덮어쓰지 않으므로 위/아래 어느 쪽이 먼저 걸려도 안전하다.
        partImage(cubMuffler, "/assets/parts/cub110-stainless-exhaust.png");
        partImage(cubMirror, "/assets/parts/cub110-mirror.png");
        partImage(cubCarrier, "/assets/parts/cub110-rear-carrier.png");
        partRepository.findByName("OSAKA 슬립온 머플러 (Super Cub 110)").ifPresent(p -> partImage(p, "/assets/parts/cub110-stainless-exhaust.png"));
        partRepository.findByName("네이키드 라운드 미러 세트").ifPresent(p -> partImage(p, "/assets/parts/cub110-mirror.png"));
        partRepository.findByName("리어 캐리어 랙 (Super Cub)").ifPresent(p -> partImage(p, "/assets/parts/cub110-rear-carrier.png"));
        // 실제 KITACO 공식 사이트(kitaco.co.jp)에서 확인한 Super Cub 50/110(JA44 포함) 리어 캐리어 제품 사진.
        partRepository.findByName("KITACO 캐리어").ifPresent(p -> partImage(p, "/assets/parts/kitaco-rear-carrier.png"));
        partImage(pcxCarrier, "/assets/parts/pcx-topbox-carrier.png");
        partImage(pcxOldMuffler, "/assets/parts/pcx-old-exhaust.png");
        partImage(yamahaGrip, "/assets/parts/yamaha-handlebar-grips.png");
        partImage(tricityCarrier, "/assets/parts/tricity-front-carrier.png");
        partImage(addressCarrier, "/assets/parts/address-underseat-carrier.png");
        partImage(kawasakiMuffler, "/assets/parts/ninja125-racing-exhaust.png");

        // ---- 회원 ----
        Member testUser = member("user@ridefit.dev", "user1234!", "테스트유저", Role.USER);
        member("admin@ridefit.dev", "admin1234!", "관리자", Role.ADMIN);
        // 실제로 가입되어 있는 회원을 관리자로 지정. 없으면 만들지 않고, role만 idempotent하게 맞춘다.
        promoteToAdminIfExists("sk05ek@naver.com");
        Member riderMin = member("rider_min@ridefit.dev", "rider1234!", "라이더민수", Role.USER);
        Member scooterFan = member("scooter_fan@ridefit.dev", "rider1234!", "스쿠터매니아", Role.USER);
        Member commuterKim = member("commuter_kim@ridefit.dev", "rider1234!", "출퇴근김씨", Role.USER);
        Member newbiePark = member("newbie_park@ridefit.dev", "rider1234!", "바이크초보", Role.USER);
        Member cubJihoon = member("cub_jihoon@ridefit.dev", "rider1234!", "커브지훈", Role.USER);

        // ---- 테스트 계정 마이페이지가 비어 보이지 않도록 즐겨찾기/최근 확인 기록 보강 ----
        favorite(testUser, cubMuffler);
        favorite(testUser, pcxCarrier);
        favorite(testUser, tricityCarrier);
        seedRecentChecksIfEmpty(testUser, List.of(cubMuffler, cubCarrier, cubMirror, cubSeat));

        // ---- 커뮤니티 게시글 (게시글이 거의 없을 때만 시드) ----
        if (postRepository.count() == 0) {
            Post post1 = post(commuterKim, "PCX 탑박스 캐리어 장착 후기 - 만족스럽네요",
                    "출퇴근용으로 PCX 타는데 탑박스 캐리어 달고 나서 수납 걱정이 확 줄었어요. "
                            + "장착도 어렵지 않았고 주행 중 흔들림도 없습니다. 추천!",
                    pcxCarrier, "MATCHED", "https://www.youtube.com/watch?v=Dx3SzecQ5-A");
            comment(post1, riderMin, "저도 이거 고민 중이었는데 후기 감사합니다!");
            comment(post1, newbiePark, "탑케이스는 따로 사셨나요?");

            post(newbiePark, "슈퍼커브 110에 리어 캐리어 달아보신 분 계신가요?",
                    "커브 막 입문했는데 캐리어 달고 배달통 올리고 싶어서요. 2021년식인데 바로 달리나요?",
                    null, null, null);

            Post post3 = post(scooterFan, "어드레스125 2023년식 알로이 휠 장착 후기 - 딱 맞아요",
                    "경량 알로이휠로 바꾸니까 가속 반응이 확실히 좋아졌어요. 브라켓 추가로 필요하다고 해서 "
                            + "같이 주문했더니 장착 문제 없었습니다.",
                    addressWheel, "MATCHED", null);
            comment(post3, commuterKim, "타이어 사이즈도 같이 바뀌나요?");

            Post post4 = post(riderMin, "트리시티125 프론트 캐리어 + 윈드스크린 동시장착 시도하다가 실패한 썰",
                    "캐리어 달고 스크린도 같이 달려고 했는데 마운트 브라켓 위치가 겹쳐서 결국 스크린은 포기했습니다. "
                            + "둘 다 달고 싶으신 분은 참고하세요.",
                    tricityCarrier, "MATCHED", null);
            comment(post4, scooterFan, "아 그거 부품 충돌 목록에도 있더라고요 ㅋㅋ 저도 캐리어만 달았어요.");
            comment(post4, newbiePark, "정보 감사합니다, 스크린은 나중에 다른 방법 찾아봐야겠네요.");

            post(newbiePark, "닌자125 레이싱 클립온 핸들바 2019년식에도 될까요?",
                    "중고로 2019년식 닌자125 구했는데 클립온 핸들바 장착 정보 보니까 2023년식만 나와있어서요. "
                            + "혹시 아시는 분?",
                    ninjaClipOn, null, null);

            Post post6 = post(scooterFan, "어드레스125 풀체인지 전 구형엔 스크린 바이저 장착 안 됩니다 (주의)",
                    "2021년 풀체인지 이후 나온 스크린 바이저인데, 그 전 구형 어드레스는 전면부 형상 자체가 달라서 "
                            + "장착이 안 된다고 하네요. 중고로 구형 사신 분들은 구매 전에 꼭 연식 확인하세요.",
                    addressVisor, "NOT_MATCHED", null);
            comment(post6, riderMin, "오 저도 몰랐던 정보네요, 알려주셔서 감사합니다.");

            Post post7 = post(riderMin, "Z125 브레이크 레버 교체 - 손맛이 달라졌어요",
                    "순정 레버가 좀 뻑뻑했는데 알루미늄 레버로 바꾸니 제동감이 훨씬 좋아졌습니다. "
                            + "장착도 15분이면 끝나요.",
                    z125Lever, "MATCHED", "https://www.youtube.com/watch?v=is2SxPzgBAY");
            comment(post7, commuterKim, "공구는 육각렌치만 있으면 되나요?");

            post(commuterKim, "버그만 스트리트 통풍시트 실제 방열 효과 있나요?",
                    "여름 출퇴근용으로 통풍시트 고민 중인데 실제로 체감될 정도인지 궁금합니다.",
                    burgmanSeat, null, null);

            post(testUser, "슈퍼커브110 순정 머플러 + 캐리어 조합 만족 후기",
                    "스테인리스 머플러랑 리어 캐리어 같이 달았는데 소리도 적당히 경쾌해지고 짐 싣기도 편해졌어요. "
                            + "커브 입문하시는 분들께 추천하는 조합입니다.",
                    cubMuffler, "MATCHED", "https://www.youtube.com/watch?v=49VFFTYepdA");

            Post mirrorReview = post(cubJihoon, "Super Cub 110 미러 후기",
                    "커브 탄 지 얼마 안 됐는데 순정 미러가 너무 작아서 뒤가 잘 안 보이더라고요. "
                            + "범용 백미러 세트로 바꾸니까 시야도 넓어지고 각도 조절도 편해졌어요. "
                            + "볼트 규격도 그대로 맞아서 장착도 어렵지 않았습니다.",
                    cubMirror, "MATCHED", null);
            mirrorReview.setRating(5);
            mirrorReview.setViewCount(34);
            postRepository.save(mirrorReview);
        }

        // vehicleClass 컬럼 추가 이전에 만들어진 모든 차종을 백필한다(현재는 전부 오토바이).
        vehicleModelRepository.findAll().stream()
                .filter(vm -> vm.getVehicleClass() == null)
                .forEach(vm -> {
                    vm.setVehicleClass("MOTORCYCLE");
                    vehicleModelRepository.save(vm);
                });

        log.info("시드 데이터 확인/생성 완료: 제조사 {}, 모델 {}, 부품 {}, 판매처 {}, 충돌 {}, 회원 {}, 게시글 {}",
                manufacturerRepository.count(), vehicleModelRepository.count(), partRepository.count(),
                sellerListingRepository.count(), partConflictRepository.count(), memberRepository.count(),
                postRepository.count());
    }

    private Manufacturer manufacturer(String name) {
        return manufacturerRepository.findByName(name)
                .orElseGet(() -> manufacturerRepository.save(Manufacturer.builder().name(name).build()));
    }

    private VehicleModel vehicleModel(Manufacturer manufacturer, String name, String type) {
        VehicleModel model = vehicleModelRepository.findByManufacturerIdAndName(manufacturer.getId(), name)
                .orElseGet(() -> vehicleModelRepository.save(
                        VehicleModel.builder().manufacturer(manufacturer).name(name).type(type).build()));
        // vehicleClass 컬럼이 없던 시절 생성된 기존 행은 백필한다 (지금은 전부 오토바이).
        if (model.getVehicleClass() == null) {
            model.setVehicleClass("MOTORCYCLE");
            vehicleModelRepository.save(model);
        }
        return model;
    }

    private MaintenanceSpec maintenanceSpec(
            VehicleModel vehicleModel, String category, String itemName, String specSummary,
            Double changeVolumeL, Double changeVolumeWithFilterL, Integer firstIntervalKm, Integer firstIntervalMonths,
            Integer intervalKm, Integer intervalMonths, String sourceLabel, String sourceUrl, String note) {
        return maintenanceSpecRepository.findByVehicleModelIdAndCategory(vehicleModel.getId(), category)
                .orElseGet(() -> maintenanceSpecRepository.save(MaintenanceSpec.builder()
                        .vehicleModel(vehicleModel)
                        .category(category)
                        .itemName(itemName)
                        .specSummary(specSummary)
                        .changeVolumeL(changeVolumeL)
                        .changeVolumeWithFilterL(changeVolumeWithFilterL)
                        .firstIntervalKm(firstIntervalKm)
                        .firstIntervalMonths(firstIntervalMonths)
                        .intervalKm(intervalKm)
                        .intervalMonths(intervalMonths)
                        .sourceLabel(sourceLabel)
                        .sourceUrl(sourceUrl)
                        .note(note)
                        .build()));
    }

    private ModelYear modelYear(VehicleModel vehicleModel, int year, String chassisCode) {
        return modelYearRepository.findByVehicleModelIdAndYear(vehicleModel.getId(), year)
                .orElseGet(() -> modelYearRepository.save(
                        ModelYear.builder().vehicleModel(vehicleModel).year(year).chassisCode(chassisCode).build()));
    }

    // 이미 시드된 ModelYear의 세대 코드가 비어있거나(oldValue=null) 알려진 잘못된 값(oldValue)일 때만
    // 새 코드로 바로잡는다. 관리자가 직접 다른 값으로 고쳐뒀다면 건드리지 않는다.
    private void setChassisCode(ModelYear modelYear, String oldValue, String newCode) {
        String current = modelYear.getChassisCode();
        boolean matchesExpectedOld = (oldValue == null) ? (current == null) : oldValue.equals(current);
        if (!matchesExpectedOld || newCode.equals(current)) {
            return;
        }
        modelYear.setChassisCode(newCode);
        modelYearRepository.save(modelYear);
    }

    private void modelImage(VehicleModel vehicleModel, String imageUrl) {
        if (vehicleModel.getImageUrl() != null) {
            return;
        }
        vehicleModel.setImageUrl(imageUrl);
        vehicleModelRepository.save(vehicleModel);
    }

    // modelImage()와 동일한 패턴 - 이미 이미지가 있으면(관리자가 직접 바꿨을 수도 있으니) 덮어쓰지 않는다.
    private void partImage(Part part, String imageUrl) {
        if (part.getImageUrl() != null) {
            return;
        }
        part.setImageUrl(imageUrl);
        partRepository.save(part);
    }

    private Part part(String name, String category, int price) {
        return partRepository.findByName(name)
                .orElseGet(() -> partRepository.save(Part.builder().name(name).category(category).price(price).build()));
    }

    private void compat(ModelYear modelYear, Part part, String status, String note) {
        if (compatibilityRepository.findByPartIdAndModelYearId(part.getId(), modelYear.getId()).isPresent()) {
            return;
        }
        compatibilityRepository.save(Compatibility.builder()
                .modelYear(modelYear).part(part).status(status).note(note).build());
    }

    private void conflict(Part partA, Part partB, String reason) {
        boolean exists = partConflictRepository.findByPartIdsInvolved(List.of(partA.getId(), partB.getId())).stream()
                .anyMatch(c -> (c.getPartA().getId().equals(partA.getId()) && c.getPartB().getId().equals(partB.getId()))
                        || (c.getPartA().getId().equals(partB.getId()) && c.getPartB().getId().equals(partA.getId())));
        if (exists) {
            return;
        }
        partConflictRepository.save(PartConflict.builder().partA(partA).partB(partB).reason(reason).build());
    }

    // 데모용 초기 인기 지표. 이미 0이 아니게 됐다면(실사용 기록이 쌓였다면) 건드리지 않는다.
    private void popularity(Part part, int viewCount, int fitSelectionCount) {
        if (part.getViewCount() != 0 || part.getFitSelectionCount() != 0) {
            return;
        }
        part.setViewCount(viewCount);
        part.setFitSelectionCount(fitSelectionCount);
        partRepository.save(part);
    }

    private void listing(Part part, String sellerName, int price, String sourceUrl) {
        boolean exists = sellerListingRepository.findByPartIdOrderByPriceAsc(part.getId()).stream()
                .anyMatch(l -> l.getSellerName().equals(sellerName));
        if (exists) {
            return;
        }
        sellerListingRepository.save(SellerListing.builder()
                .part(part).sellerName(sellerName).price(price).sourceUrl(sourceUrl)
                .createdAt(LocalDateTime.now()).build());
    }

    // 이미 존재하는 회원의 role만 ADMIN으로 바꾼다. 없으면 아무 것도 하지 않는다(임의로 계정을 만들지 않음).
    private void promoteToAdminIfExists(String email) {
        memberRepository.findByEmail(email).ifPresent(existing -> {
            if (existing.getRole() != Role.ADMIN) {
                existing.setRole(Role.ADMIN);
                memberRepository.save(existing);
                log.info("{} 계정을 ADMIN으로 승격했습니다.", email);
            }
        });
    }

    private Member member(String email, String rawPassword, String name, Role role) {
        return memberRepository.findByEmail(email)
                .orElseGet(() -> memberRepository.save(Member.builder()
                        .email(email).password(passwordEncoder.encode(rawPassword)).name(name).role(role).build()));
    }

    private Post post(Member author, String title, String content, Part installedPart, String compatibleFeedback,
                       String videoUrl) {
        Post post = Post.builder()
                .author(author).title(title).content(content).installedPart(installedPart)
                .compatibleFeedback(compatibleFeedback).videoUrl(videoUrl).createdAt(LocalDateTime.now())
                .build();
        return postRepository.save(post);
    }

    private void comment(Post post, Member author, String content) {
        commentRepository.save(Comment.builder()
                .post(post).author(author).content(content).createdAt(LocalDateTime.now()).build());
    }

    private void installVideo(Part part, String url) {
        if (part.getInstallVideoUrl() != null) {
            return;
        }
        part.setInstallVideoUrl(url);
        partRepository.save(part);
    }

    private void favorite(Member member, Part part) {
        if (favoriteRepository.existsByMemberIdAndPartId(member.getId(), part.getId())) {
            return;
        }
        favoriteRepository.save(Favorite.builder().member(member).part(part).createdAt(LocalDateTime.now()).build());
    }

    // member가 이미 등록해둔 차량이 있을 때만, 최근 확인한 부품 몇 건을 채워 마이페이지가 비어 보이지 않게 한다.
    // 차량이 아직 없으면(빈 DB 등) 임의로 차량을 만들지 않고 그대로 둔다.
    private void seedRecentChecksIfEmpty(Member member, List<Part> candidateParts) {
        if (!recentPartCheckRepository.findByMemberIdOrderByCheckedAtDesc(member.getId(), PageRequest.of(0, 1)).isEmpty()) {
            return;
        }
        List<MyVehicle> vehicles = myVehicleRepository.findByMemberId(member.getId());
        if (vehicles.isEmpty()) {
            return;
        }
        MyVehicle vehicle = vehicles.get(0);
        Long modelYearId = vehicle.getModelYear().getId();

        int count = 0;
        for (Part part : candidateParts) {
            if (count >= 3) break;
            Optional<Compatibility> compatibility =
                    compatibilityRepository.findByPartIdAndModelYearId(part.getId(), modelYearId);
            String status = compatibility.map(Compatibility::getStatus).orElse("정보없음");
            recentPartCheckRepository.save(RecentPartCheck.builder()
                    .member(member).part(part).myVehicle(vehicle).status(status)
                    .checkedAt(LocalDateTime.now().minusHours(count))
                    .build());
            count++;
        }
    }
}
