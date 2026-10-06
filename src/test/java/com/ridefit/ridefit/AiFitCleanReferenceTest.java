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

// AI reference가 배경 정리본(/assets/parts/clean/...)이면, 단일 부품 합성 때 대표 사진(체커 무늬가 박힌 원본)을
// "같은 제품의 다른 사진"으로 함께 보내지 않는다. 실제 이미지 API는 부르지 않는다(대역), 업로드는 임시 폴더.
@SpringBootTest
class AiFitCleanReferenceTest {

    @TempDir
    static Path uploads;

    @DynamicPropertySource
    static void uploadDir(DynamicPropertyRegistry registry) {
        registry.add("app.upload-dir", () -> uploads.toString());
    }

    @MockitoBean
    AiImageProvider aiImageProvider;

    @Autowired AiFitService aiFitService;
    @Autowired PartRepository partRepository;
    @Autowired CompatibilityRepository compatibilityRepository;
    @Autowired MemberRepository memberRepository;
    @Autowired MyVehicleRepository myVehicleRepository;

    private final AtomicInteger calls = new AtomicInteger();

    private byte[] png(int n) throws Exception {
        BufferedImage img = new BufferedImage(4, 4, BufferedImage.TYPE_INT_RGB);
        img.setRGB(0, 0, 0x101010 * (n + 1));
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    @Test
    void 참조_이미지가_배경_정리본이면_체커_무늬_원본_상품사진은_함께_보내지_않는다() throws Exception {
        when(aiImageProvider.isConfigured()).thenReturn(true);
        when(aiImageProvider.model()).thenReturn("test-stub");
        when(aiImageProvider.quality()).thenReturn("test");
        when(aiImageProvider.supportedAspectRatios()).thenReturn(List.of("1:1", "16:9", "9:16"));
        when(aiImageProvider.edit(any(), anyString(), any())).thenAnswer(inv -> png(calls.getAndIncrement()));

        // H2C 앞바구니: 대표 사진(원본)은 흰/회색 체커가 박힌 RGB, AI reference는 정리본(/clean/)
        Part basket = partRepository.findByName("H2C 슈퍼커브 110 순정 프론트 바스켓 (21년~) [APK1MAL61000TA]").orElseThrow();
        basket.setImageUrl("/assets/parts/h2c-cub110-front-basket.png");
        basket.setAiReferenceImageUrl("/assets/parts/clean/h2c-cub110-front-basket-ref.png");
        partRepository.save(basket);
        ModelYear year = compatibilityRepository.findByPartIdInWithModel(List.of(basket.getId())).stream()
                .filter(c -> CompatibilityCheckService.isProceedStatus(c.getStatus()))
                .map(Compatibility::getModelYear).findFirst().orElseThrow();
        Member member = memberRepository.save(Member.builder().email("aifit-clean-ref@test.dev").password("x").name("t").role(Role.USER).build());
        MyVehicle vehicle = myVehicleRepository.save(MyVehicle.builder().member(member).modelYear(year).build());

        aiFitService.generate(List.of(new PartInput(basket, null, null)), vehicle, member.getId(), false);
        ArgumentCaptor<List<OpenAiImageClient.InputImage>> images = ArgumentCaptor.captor();
        verify(aiImageProvider).edit(images.capture(), anyString(), any());
        // 차량 + 정리본 reference 2장만(체커 원본 "product" 사진 없음)
        assertThat(images.getValue()).extracting(OpenAiImageClient.InputImage::filename)
                .containsExactly("vehicle.png", "part1.png");
    }
}
