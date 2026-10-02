package com.ridefit.ridefit;

import com.ridefit.ridefit.domain.AiFitResult;
import com.ridefit.ridefit.domain.Compatibility;
import com.ridefit.ridefit.domain.Member;
import com.ridefit.ridefit.domain.ModelYear;
import com.ridefit.ridefit.domain.MyVehicle;
import com.ridefit.ridefit.domain.Part;
import com.ridefit.ridefit.domain.Role;
import com.ridefit.ridefit.dto.AiFitDtos.AiFitCheckResponse;
import com.ridefit.ridefit.dto.AiFitDtos.AiFitResponse;
import com.ridefit.ridefit.dto.AiFitDtos.AiFitResultItem;
import com.ridefit.ridefit.repository.AiFitResultRepository;
import com.ridefit.ridefit.repository.CompatibilityRepository;
import com.ridefit.ridefit.repository.MemberRepository;
import com.ridefit.ridefit.repository.MyVehicleRepository;
import com.ridefit.ridefit.repository.PartRepository;
import com.ridefit.ridefit.service.AiFitService;
import com.ridefit.ridefit.service.AiFitService.PartInput;
import com.ridefit.ridefit.service.AiImageProvider;
import com.ridefit.ridefit.service.CompatibilityCheckService;
import com.ridefit.ridefit.service.OpenAiImageClient;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// AI 장착 결과가 "만들 때마다 새 파일 + 새 DB 행"으로 쌓이고(덮어쓰기/삭제 없음), 차량별 목록 API로 전부 다시 불러와지는지.
// 실제 이미지 API(유료)는 부르지 않는다 - 제공자만 테스트용 대역으로 바꾸고, 저장/DB/조회는 실제 코드 그대로 돈다.
// 업로드 폴더는 임시 폴더를 쓴다(실제 uploads/ai-fit 은 건드리지 않음).
@SpringBootTest
class AiFitStorageTest {

    @TempDir
    static Path uploads;

    @DynamicPropertySource
    static void uploadDir(DynamicPropertyRegistry registry) {
        registry.add("app.upload-dir", () -> uploads.toString());
    }

    @MockitoBean
    AiImageProvider aiImageProvider;

    @Autowired AiFitService aiFitService;
    @Autowired AiFitResultRepository aiFitResultRepository;
    @Autowired PartRepository partRepository;
    @Autowired CompatibilityRepository compatibilityRepository;
    @Autowired MemberRepository memberRepository;
    @Autowired MyVehicleRepository myVehicleRepository;

    private final AtomicInteger calls = new AtomicInteger();

    // 호출마다 색이 다른 진짜 PNG(서버의 확장자 판별을 그대로 통과).
    private byte[] png(int n) throws Exception {
        BufferedImage img = new BufferedImage(4, 4, BufferedImage.TYPE_INT_RGB);
        img.setRGB(0, 0, 0x101010 * (n + 1));
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    @Test
    void 합성할_때마다_새_파일과_DB_행이_쌓이고_차량별로_전부_조회된다() throws Exception {
        when(aiImageProvider.isConfigured()).thenReturn(true);
        when(aiImageProvider.model()).thenReturn("test-stub");
        when(aiImageProvider.quality()).thenReturn("test");
        when(aiImageProvider.supportedAspectRatios()).thenReturn(List.of("1:1", "16:9", "9:16"));
        when(aiImageProvider.edit(any(), anyString(), any())).thenAnswer(inv -> png(calls.getAndIncrement()));

        Part muffler = partRepository.findByName("순정 스타일 스테인리스 머플러 (Cub 110)").orElseThrow();
        muffler.setAiReferenceImageUrl("/assets/parts/overlay/cub110-stainless-exhaust.png");
        partRepository.save(muffler);
        Part screen = partRepository.findByName("H2C 슈퍼커브 110 순정 윈드스크린 (18년~) [APK76LJ-88210TA]").orElseThrow();
        Part kitaco = partRepository.findByName("KITACO 캐리어").orElseThrow();   // 참조 이미지 없음 -> 합성 제외 대상

        // 머플러와 스크린이 둘 다 장착 가능(호환가능/브라켓필요)한 연식
        Set<Long> screenYears = compatibilityRepository.findByPartIdInWithModel(List.of(screen.getId())).stream()
                .filter(c -> CompatibilityCheckService.isProceedStatus(c.getStatus()))
                .map(c -> c.getModelYear().getId()).collect(Collectors.toSet());
        ModelYear year = compatibilityRepository.findByPartIdInWithModel(List.of(muffler.getId())).stream()
                .filter(c -> CompatibilityCheckService.isProceedStatus(c.getStatus()))
                .map(Compatibility::getModelYear).filter(y -> screenYears.contains(y.getId()))
                .findFirst().orElseThrow();
        Member member = memberRepository.save(Member.builder().email("aifit-storage@test.dev").password("x").name("t").role(Role.USER).build());
        MyVehicle vehicle = myVehicleRepository.save(MyVehicle.builder().member(member).modelYear(year).build());

        // 1) 머플러 1개
        AiFitResponse r1 = aiFitService.generate(List.of(new PartInput(muffler, null, null)), vehicle, member.getId(), false);
        assertThat(r1.cached()).isFalse();
        // 2) 같은 조합을 그냥 다시 누르면 저장된 결과를 그대로 보여준다(API 재호출 없음, 새 파일 없음)
        AiFitResponse again = aiFitService.generate(List.of(new PartInput(muffler, null, null)), vehicle, member.getId(), false);
        assertThat(again.cached()).isTrue();
        assertThat(again.id()).isEqualTo(r1.id());
        // 3) "새로 다시 만들기" -> 같은 조합이어도 새 결과(새 파일), 예전 결과는 그대로
        AiFitResponse r2 = aiFitService.generate(List.of(new PartInput(muffler, null, null)), vehicle, member.getId(), true);
        assertThat(r2.cached()).isFalse();
        assertThat(r2.imageUrl()).isNotEqualTo(r1.imageUrl());
        // 4) 다른 부품을 더한 조합(머플러 + 스크린)을 한 장으로
        AiFitResponse r3 = aiFitService.generate(List.of(new PartInput(muffler, 20.0, 75.0), new PartInput(screen, 60.0, 10.0)),
                vehicle, member.getId(), false);
        assertThat(r3.partIds()).containsExactly(muffler.getId(), screen.getId());
        // 이미지 API는 3번만 불렸고, 매번 AI 전용으로 다시 구도를 잡은 차량 이미지 + 그 비율("16:9")을 받았다
        // (v5: 위쪽 빈 공간을 만들지 않도록 좌우로만 패딩하는 비율을 고른다 - VehicleImageFramer)
        ArgumentCaptor<List<OpenAiImageClient.InputImage>> imagesCaptor = ArgumentCaptor.captor();
        ArgumentCaptor<String> ratioCaptor = ArgumentCaptor.forClass(String.class);
        verify(aiImageProvider, times(3)).edit(imagesCaptor.capture(), anyString(), ratioCaptor.capture());
        assertThat(ratioCaptor.getAllValues()).containsOnly("16:9");
        BufferedImage sentVehicle = ImageIO.read(new java.io.ByteArrayInputStream(imagesCaptor.getValue().get(0).bytes()));
        assertThat((double) sentVehicle.getWidth() / sentVehicle.getHeight()).isCloseTo(16.0 / 9, org.assertj.core.data.Offset.offset(0.01));

        // 파일: 3개가 모두 서로 다른 이름으로 남아 있고, DB 경로(/uploads/ai-fit/...)와 실제 파일이 1:1로 맞는다
        List<String> files;
        try (Stream<Path> s = Files.list(uploads.resolve("ai-fit"))) {
            files = s.map(p -> p.getFileName().toString()).sorted().toList();
        }
        assertThat(files).hasSize(3);
        for (AiFitResponse r : List.of(r1, r2, r3)) {
            assertThat(r.imageUrl()).startsWith("/uploads/ai-fit/").endsWith(".png");
            assertThat(files).contains(r.imageUrl().substring("/uploads/ai-fit/".length()));
        }

        // 차량별 목록: 3개 전부, 최신순, 부품 이름까지
        Map<Long, String> names = partRepository.findAll().stream().collect(Collectors.toMap(Part::getId, Part::getName));
        List<AiFitResultItem> list = aiFitService.results(vehicle, member.getId(), names);
        assertThat(list).extracting(AiFitResultItem::id).containsExactly(r3.id(), r2.id(), r1.id());
        assertThat(list.get(0).partNames()).containsExactly(muffler.getName(), screen.getName());
        AiFitResult saved = aiFitResultRepository.findById(r3.id()).orElseThrow();
        assertThat(saved.getMyVehicleId()).isEqualTo(vehicle.getId());
        assertThat(saved.getPartIds()).isEqualTo(muffler.getId() + "," + screen.getId());

        // 준비 상태: 참조 이미지가 없는 부품은 빼고, 나머지 조합으로 버튼을 쓸 수 있다
        AiFitCheckResponse check = aiFitService.check(List.of(new PartInput(kitaco, null, null),
                new PartInput(muffler, 20.0, 75.0), new PartInput(screen, 60.0, 10.0)), vehicle);
        assertThat(check.canGenerate()).isTrue();
        assertThat(check.code()).isEqualTo("CACHED");          // 머플러+스크린 조합은 4)에서 이미 만들었다
        assertThat(check.cachedImageUrl()).isEqualTo(r3.imageUrl());
        assertThat(check.parts()).extracting(p -> p.included()).containsExactly(false, true, true);
        assertThat(check.parts().get(0).code()).isEqualTo("REFERENCE_MISSING");
    }
}
