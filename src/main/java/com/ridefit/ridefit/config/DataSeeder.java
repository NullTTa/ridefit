package com.ridefit.ridefit.config;

import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.Manufacturer;
import com.ridefit.ridefit.domain.Member;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.PartConflict;
import com.ridefit.ridefit.domain.Role;
import com.ridefit.ridefit.domain.VehicleModel;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.ManufacturerRepository;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.ModelYearRepository;
import com.ridefit.ridefit.repository.PartConflictRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.repository.VehicleModelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

// 개발/데모용 최소 시드 데이터. Honda Super Cub 110 / PCX 기준 샘플 부품 + 호환성 + 충돌 데이터,
// 그리고 테스트용 USER/ADMIN 계정을 넣어둔다. 이미 데이터가 있으면(재시작 등) 아무 것도 하지 않는다.
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
    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        if (manufacturerRepository.count() > 0) {
            log.info("시드 데이터가 이미 존재해서 건너뜁니다.");
            return;
        }

        Manufacturer honda = manufacturerRepository.save(Manufacturer.builder().name("Honda").build());

        VehicleModel superCub = vehicleModelRepository.save(
                VehicleModel.builder().manufacturer(honda).name("Super Cub 110").type("커브").build());
        VehicleModel pcx = vehicleModelRepository.save(
                VehicleModel.builder().manufacturer(honda).name("PCX").type("맥시스쿠터").build());

        Map<Integer, ModelYear> cubYears = Map.of(
                2021, modelYearRepository.save(ModelYear.builder().vehicleModel(superCub).year(2021).chassisCode("JA44").build()),
                2023, modelYearRepository.save(ModelYear.builder().vehicleModel(superCub).year(2023).chassisCode("JA44").build()));
        Map<Integer, ModelYear> pcxYears = Map.of(
                2021, modelYearRepository.save(ModelYear.builder().vehicleModel(pcx).year(2021).chassisCode("KF30").build()),
                2023, modelYearRepository.save(ModelYear.builder().vehicleModel(pcx).year(2023).chassisCode("KF30").build()));

        Part cubMuffler = partRepository.save(part("순정 스타일 스테인리스 머플러 (Cub 110)", "머플러", 189000));
        Part cubCarrier = partRepository.save(part("리어 확장 캐리어 (Cub 110)", "캐리어", 65000));
        Part cubMirror = partRepository.save(part("범용 백미러 세트 (Cub 110)", "미러", 32000));
        Part cubSeat = partRepository.save(part("펀칭 가죽 시트 커버 (Cub 110)", "시트", 48000));

        Part pcxScreen = partRepository.save(part("스포츠 윈드스크린 (PCX)", "스크린", 79000));
        Part pcxCarrier = partRepository.save(part("탑박스 캐리어 (PCX)", "캐리어", 95000));
        Part pcxLever = partRepository.save(part("알루미늄 브레이크 레버 세트 (PCX)", "레버", 54000));
        Part pcxLamp = partRepository.save(part("LED 방향지시등 세트 (PCX)", "램프", 38000));
        Part pcxOldMuffler = partRepository.save(part("구형 머플러 (2018 PCX 호환, 신형 불가)", "머플러", 210000));

        compat(cubYears.get(2021), cubMuffler, "호환가능", "정품 브라켓 포함");
        compat(cubYears.get(2023), cubMuffler, "호환가능", "정품 브라켓 포함");
        compat(cubYears.get(2021), cubCarrier, "브라켓필요", "별도 서브 브라켓 구매 필요");
        compat(cubYears.get(2023), cubCarrier, "호환가능", null);
        compat(cubYears.get(2021), cubMirror, "호환가능", null);
        compat(cubYears.get(2023), cubMirror, "호환가능", null);
        compat(cubYears.get(2023), cubSeat, "호환가능", null);

        compat(pcxYears.get(2021), pcxScreen, "호환가능", null);
        compat(pcxYears.get(2023), pcxScreen, "호환가능", null);
        compat(pcxYears.get(2021), pcxCarrier, "호환가능", "탑케이스 별매");
        compat(pcxYears.get(2023), pcxCarrier, "호환가능", "탑케이스 별매");
        compat(pcxYears.get(2021), pcxLever, "호환가능", null);
        compat(pcxYears.get(2023), pcxLever, "호환가능", null);
        compat(pcxYears.get(2021), pcxLamp, "호환가능", null);
        compat(pcxYears.get(2023), pcxLamp, "호환가능", null);
        compat(pcxYears.get(2021), pcxOldMuffler, "호환불가", "구형 배기 매니폴드 규격이 달라 장착 불가");
        compat(pcxYears.get(2023), pcxOldMuffler, "호환불가", "구형 배기 매니폴드 규격이 달라 장착 불가");

        partConflictRepository.save(PartConflict.builder()
                .partA(pcxCarrier).partB(pcxScreen)
                .reason("탑박스 캐리어 장착 시 스크린 브라켓과 볼트 위치가 겹쳐 동시 장착이 어렵습니다.")
                .build());
        partConflictRepository.save(PartConflict.builder()
                .partA(cubCarrier).partB(cubSeat)
                .reason("확장 캐리어의 후방 스테이가 시트 커버 고정 클립과 간섭합니다.")
                .build());

        memberRepository.save(Member.builder()
                .email("user@ridefit.dev")
                .password(passwordEncoder.encode("user1234!"))
                .name("테스트유저")
                .role(Role.USER)
                .build());
        memberRepository.save(Member.builder()
                .email("admin@ridefit.dev")
                .password(passwordEncoder.encode("admin1234!"))
                .name("관리자")
                .role(Role.ADMIN)
                .build());

        log.info("시드 데이터 생성 완료: 제조사 1, 모델 2, 부품 {}, 회원 2 (user@ridefit.dev / admin@ridefit.dev)",
                partRepository.count());
    }

    private Part part(String name, String category, int price) {
        return Part.builder().name(name).category(category).price(price).build();
    }

    private void compat(ModelYear modelYear, Part part, String status, String note) {
        compatibilityRepository.save(Compatibility.builder()
                .modelYear(modelYear).part(part).status(status).note(note).build());
    }
}
