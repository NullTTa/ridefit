package com.ridefit.ridefit;

import com.ridefit.ridefit.service.VehicleImageFramer;
import com.ridefit.ridefit.service.VehicleImageFramer.Framed;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

// AI 전용 차량 framing: 실제 Super Cub 대표 사진으로 "차량이 85~90% 차지 / 잘림 없음 / 지원 비율 / 원본 파일 불변"을 확인한다.
class VehicleImageFramerTest {

    private static final Path SUPER_CUB = Path.of("frontend/public/assets/vehicles/super-cub-110.png");
    // 지금 설정(flux-2-klein 640px)에서 Magic Hour가 실제로 허용한 비율(application.properties 기본값과 같음)
    private static final List<String> ALLOWED = List.of("1:1", "16:9", "9:16");

    @Test
    void 슈퍼커브_사진은_차량이_프레임_폭의_85에서_90퍼센트를_차지하고_잘리지_않는다() throws Exception {
        byte[] original = Files.readAllBytes(SUPER_CUB);
        String before = sha(original);

        Framed f = VehicleImageFramer.frame(original, ALLOWED).orElseThrow();

        // 허용 비율 중 640px(긴 변)에서 차량이 가장 크게 나오는 1:1, 실제 이미지 비율도 그 값(입력/출력 비율 일치 -> 차량 눌림 없음)
        assertThat(f.aspectRatio()).isEqualTo("1:1");
        String[] r = f.aspectRatio().split(":");
        assertThat((double) f.width() / f.height()).isCloseTo(Double.parseDouble(r[0]) / Double.parseDouble(r[1]), within(0.01));

        // 차량이 프레임 폭의 85~90%(예전: 65%). 같은 640px(긴 변) 결과에서 차량 폭: 예전 640x0.65=419px -> 지금 640x0.89=570px
        assertThat(f.vehicleWidthRatio()).isBetween(0.85, 0.90);
        assertThat(640 * f.vehicleWidthRatio() / (640 * 1196.0 / 1829)).isGreaterThan(1.3);

        // 잘림 없음: 차량으로 보는 픽셀(알파 > 16, framer와 같은 기준) 수가 원본과 같고, 새 이미지 테두리 1px은 전부 투명.
        // (알파 1~16의 거의 보이지 않는 잡음 픽셀은 차량으로 보지 않으므로 여백 밖이면 빠질 수 있다)
        BufferedImage src = ImageIO.read(new ByteArrayInputStream(original));
        BufferedImage out = ImageIO.read(new ByteArrayInputStream(f.png()));
        assertThat(out.getWidth()).isEqualTo(f.width());
        assertThat(opaqueCount(out)).isEqualTo(opaqueCount(src));
        for (int x = 0; x < out.getWidth(); x++) {
            assertThat(alpha(out, x, 0)).isZero();
            assertThat(alpha(out, x, out.getHeight() - 1)).isZero();
        }
        for (int y = 0; y < out.getHeight(); y++) {
            assertThat(alpha(out, 0, y)).isZero();
            assertThat(alpha(out, out.getWidth() - 1, y)).isZero();
        }

        // 세로로 늘린 공간은 위/아래에 똑같이(가운데 배치). 위쪽에만 몰면 AI가 그 공간을 채우려고 윈드스크린을 과대하게 그렸다.
        int top = -1, bottom = -1;
        for (int y = 0; y < out.getHeight() && top < 0; y++)
            for (int x = 0; x < out.getWidth(); x++) if (alpha(out, x, y) > 16) { top = y; break; }
        for (int y = out.getHeight() - 1; y >= 0 && bottom < 0; y--)
            for (int x = 0; x < out.getWidth(); x++) if (alpha(out, x, y) > 16) { bottom = y; break; }
        int vehicleH = bottom - top + 1;
        assertThat((double) top / vehicleH).isCloseTo((out.getHeight() - 1 - bottom) / (double) vehicleH, within(0.01));
        assertThat((double) top / out.getHeight()).isGreaterThan(0.15);

        // 장착 위치 힌트 좌표 변환: 원본에서의 한 점이 새 이미지에서 같은 픽셀을 가리킨다
        double px = 500, py = 640;   // 원본 픽셀(뒷바퀴 근처)
        double nx = f.mapX(px / src.getWidth() * 100) / 100 * f.width();
        double ny = f.mapY(py / src.getHeight() * 100) / 100 * f.height();
        assertThat(out.getRGB((int) Math.round(nx), (int) Math.round(ny))).isEqualTo(src.getRGB((int) px, (int) py));

        // 원본 파일은 바뀌지 않는다(메모리에서만 처리)
        assertThat(sha(Files.readAllBytes(SUPER_CUB))).isEqualTo(before);
    }

    @Test
    void 허용_비율_목록_안에서만_고르고_목록이_없으면_구도를_바꾸지_않는다() throws Exception {
        byte[] original = Files.readAllBytes(SUPER_CUB);
        // 공식 문서 전체 목록이면 4:3(긴 변 기준 1:1과 같고 차량 비율에 더 가까움)
        assertThat(VehicleImageFramer.frame(original, List.of("16:9", "9:16", "4:3", "3:2", "1:1", "4:5", "2:3")).orElseThrow().aspectRatio())
                .isEqualTo("4:3");
        assertThat(VehicleImageFramer.frame(original, List.of("16:9")).orElseThrow().aspectRatio()).isEqualTo("16:9");
        assertThat(VehicleImageFramer.frame(original, List.of())).isEmpty();
    }

    @Test
    void 투명_배경이_아닌_사진은_구도를_바꾸지_않는다() throws Exception {
        BufferedImage photo = new BufferedImage(40, 30, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(photo, "jpg", out);
        Optional<Framed> f = VehicleImageFramer.frame(out.toByteArray(), ALLOWED);
        assertThat(f).isEmpty();
    }

    private static int alpha(BufferedImage img, int x, int y) {
        return (img.getRGB(x, y) >>> 24) & 0xFF;
    }

    private static long opaqueCount(BufferedImage img) {
        long n = 0;
        for (int y = 0; y < img.getHeight(); y++)
            for (int x = 0; x < img.getWidth(); x++)
                if (alpha(img, x, y) > 16) n++;
        return n;
    }

    private static String sha(byte[] b) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(b));
    }
}
