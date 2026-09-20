package com.ridefit.ridefit.config;

import com.ridefit.ridefit.domain.Comment;
import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.Favorite;
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
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final ManufacturerRepository manufacturerRepository;
    private final VehicleModelRepository vehicleModelRepository;
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

        ModelYear cub21 = modelYear(superCub, 2021, "JA44");
        ModelYear cub23 = modelYear(superCub, 2023, "JA44");
        ModelYear pcx21 = modelYear(pcx, 2021, "KF30");
        ModelYear pcx23 = modelYear(pcx, 2023, "KF30");
        ModelYear tricity21 = modelYear(tricity, 2021, null);
        ModelYear tricity23 = modelYear(tricity, 2023, null);
        ModelYear vino21 = modelYear(vino, 2021, null);
        ModelYear vino23 = modelYear(vino, 2023, null);
        ModelYear address21 = modelYear(address, 2021, null);
        ModelYear address23 = modelYear(address, 2023, null);
        ModelYear burgman21 = modelYear(burgmanStreet, 2021, null);
        ModelYear burgman23 = modelYear(burgmanStreet, 2023, null);
        ModelYear ninja21 = modelYear(ninja125, 2021, null);
        ModelYear ninja23 = modelYear(ninja125, 2023, null);
        ModelYear z12521 = modelYear(z125, 2021, null);
        ModelYear z12523 = modelYear(z125, 2023, null);

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

        compat(cub21, cubMuffler, "호환가능", "정품 브라켓 포함");
        compat(cub23, cubMuffler, "호환가능", "정품 브라켓 포함");
        compat(cub21, cubCarrier, "브라켓필요", "별도 서브 브라켓 구매 필요");
        compat(cub23, cubCarrier, "호환가능", null);
        compat(cub21, cubMirror, "호환가능", null);
        compat(cub23, cubMirror, "호환가능", null);
        compat(cub23, cubSeat, "호환가능", null);
        compat(pcx21, pcxScreen, "호환가능", null);
        compat(pcx23, pcxScreen, "호환가능", null);
        compat(pcx21, pcxCarrier, "호환가능", "탑케이스 별매");
        compat(pcx23, pcxCarrier, "호환가능", "탑케이스 별매");
        compat(pcx21, pcxLever, "호환가능", null);
        compat(pcx23, pcxLever, "호환가능", null);
        compat(pcx21, pcxLamp, "호환가능", null);
        compat(pcx23, pcxLamp, "호환가능", null);
        compat(pcx21, pcxOldMuffler, "호환불가", "구형 배기 매니폴드 규격이 달라 장착 불가");
        compat(pcx23, pcxOldMuffler, "호환불가", "구형 배기 매니폴드 규격이 달라 장착 불가");

        // ---- Yamaha 부품 (Tricity 125 / Vino 125) ----
        Part yamahaGrip = part("야마하 범용 핸들바 그립 세트", "핸들바", 18000);
        Part yamahaMirror = part("야마하 범용 사이드미러 세트", "미러", 29000);
        Part tricityCarrier = part("트리시티 프론트 유틸리티 캐리어", "캐리어", 89000);
        Part tricityScreen = part("트리시티 스포츠 윈드스크린", "스크린", 95000);
        Part vinoSeat = part("비노 레트로 시트 커버", "시트", 42000);
        Part vinoMuffler = part("비노 크롬 슬립온 머플러", "머플러", 175000);
        Part yamahaWheel = part("야마하 범용 알로이 휠 커버 세트", "휠", 36000);

        for (ModelYear y : List.of(tricity21, tricity23, vino21, vino23)) {
            compat(y, yamahaGrip, "호환가능", null);
            compat(y, yamahaMirror, "호환가능", null);
            compat(y, yamahaWheel, "호환가능", null);
        }
        compat(tricity21, tricityCarrier, "호환가능", null);
        compat(tricity23, tricityCarrier, "호환가능", null);
        compat(tricity21, tricityScreen, "브라켓필요", "별도 스크린 마운트 브라켓 필요");
        compat(tricity23, tricityScreen, "브라켓필요", "별도 스크린 마운트 브라켓 필요");
        compat(vino21, vinoSeat, "호환가능", null);
        compat(vino23, vinoSeat, "호환가능", null);
        compat(vino21, vinoMuffler, "호환가능", "정품 개스킷 포함");
        compat(vino23, vinoMuffler, "호환불가", "2023년식부터 배기 인증 규격이 변경되어 장착 불가");

        // ---- Suzuki 부품 (Address 125 / Burgman Street 125) ----
        Part suzukiLamp = part("스즈키 범용 LED 방향지시등 세트", "램프", 33000);
        Part addressCarrier = part("어드레스 언더시트 수납 캐리어", "캐리어", 58000);
        Part addressWheel = part("어드레스 경량 알로이 휠", "휠", 210000);
        Part burgmanSeat = part("버그만 스트리트 통풍 시트", "시트", 68000);
        Part burgmanMirror = part("버그만 스트리트 크롬 사이드미러", "미러", 47000);
        Part suzukiMuffler = part("스즈키 범용 스포츠 머플러", "머플러", 198000);
        Part addressVisor = part("어드레스 스크린 바이저", "스크린", 39000);

        for (ModelYear y : List.of(address21, address23, burgman21, burgman23)) {
            compat(y, suzukiLamp, "호환가능", null);
            compat(y, suzukiMuffler, "브라켓필요", "전용 마운트 브라켓 별매");
        }
        compat(address21, addressCarrier, "호환가능", null);
        compat(address23, addressCarrier, "호환가능", null);
        compat(address23, addressWheel, "브라켓필요", "타이어 사이즈 변경 필요");
        compat(burgman21, burgmanSeat, "호환가능", null);
        compat(burgman23, burgmanSeat, "호환가능", null);
        compat(burgman21, burgmanMirror, "호환가능", null);
        compat(burgman23, burgmanMirror, "호환가능", null);
        compat(address21, addressVisor, "호환가능", null);
        compat(address23, addressVisor, "호환불가", "풀체인지로 전면부 형상이 바뀌어 장착 불가");

        // ---- Kawasaki 부품 (Ninja 125 / Z125) ----
        Part kawasakiMuffler = part("가와사키 범용 레이싱 머플러", "머플러", 245000);
        Part ninjaScreen = part("닌자125 스포츠 윈드스크린", "스크린", 87000);
        Part ninjaClipOn = part("닌자125 레이싱 클립온 핸들바", "핸들바", 132000);
        Part z125Mirror = part("Z125 스트리트 사이드미러 세트", "미러", 41000);
        Part z125Lever = part("Z125 브레이크 레버 세트", "레버", 56000);
        Part kawasakiWheel = part("가와사키 범용 휠 스프로킷 세트", "휠", 119000);
        Part ninjaSeatCowl = part("닌자125 레이스 시트카울", "시트", 145000);

        for (ModelYear y : List.of(ninja21, ninja23, z12521, z12523)) {
            compat(y, kawasakiMuffler, "브라켓필요", "레이스용 서브 브라켓 필요");
            compat(y, kawasakiWheel, "호환가능", null);
        }
        compat(ninja21, ninjaScreen, "호환가능", null);
        compat(ninja23, ninjaScreen, "호환가능", null);
        compat(ninja23, ninjaClipOn, "호환가능", "순정 핸들바 제거 필요");
        compat(z12521, z125Mirror, "호환가능", null);
        compat(z12523, z125Mirror, "호환가능", null);
        compat(z12521, z125Lever, "호환가능", null);
        compat(z12523, z125Lever, "호환가능", null);
        compat(ninja21, ninjaSeatCowl, "호환가능", null);
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

        // ---- 회원 ----
        Member testUser = member("user@ridefit.dev", "user1234!", "테스트유저", Role.USER);
        member("admin@ridefit.dev", "admin1234!", "관리자", Role.ADMIN);
        Member riderMin = member("rider_min@ridefit.dev", "rider1234!", "라이더민수", Role.USER);
        Member scooterFan = member("scooter_fan@ridefit.dev", "rider1234!", "스쿠터매니아", Role.USER);
        Member commuterKim = member("commuter_kim@ridefit.dev", "rider1234!", "출퇴근김씨", Role.USER);
        Member newbiePark = member("newbie_park@ridefit.dev", "rider1234!", "바이크초보", Role.USER);

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

            post(newbiePark, "닌자125 레이싱 클립온 핸들바 2021년식에도 될까요?",
                    "중고로 2021년식 닌자125 구했는데 클립온 핸들바 장착 정보 보니까 2023년식만 나와있어서요. "
                            + "혹시 아시는 분?",
                    ninjaClipOn, null, null);

            Post post6 = post(scooterFan, "비노125 2023년식엔 크롬 머플러 장착 안 됩니다 (주의)",
                    "2021년식엔 문제없이 달았는데 친구 2023년식엔 배기 인증 규격이 바뀌어서 장착이 안 된다고 하네요. "
                            + "구매 전에 꼭 연식 확인하세요.",
                    vinoMuffler, "NOT_MATCHED", null);
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
        }

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
        return vehicleModelRepository.findByManufacturerIdAndName(manufacturer.getId(), name)
                .orElseGet(() -> vehicleModelRepository.save(
                        VehicleModel.builder().manufacturer(manufacturer).name(name).type(type).build()));
    }

    private ModelYear modelYear(VehicleModel vehicleModel, int year, String chassisCode) {
        return modelYearRepository.findByVehicleModelIdAndYear(vehicleModel.getId(), year)
                .orElseGet(() -> modelYearRepository.save(
                        ModelYear.builder().vehicleModel(vehicleModel).year(year).chassisCode(chassisCode).build()));
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
