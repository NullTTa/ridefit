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

// AI 전용 차량 framing: 실제 Super Cub 대표 사진으로 "위쪽 빈 공간 제한 / 좌우로만 패딩 / 잘림 없음 / 지원 비율 / 원본 파일 불변"을 확인한다.
// (좌우 패딩은 결과에서 AiResultImageCropper가 잘라 차량이 결과 폭의 약 89%가 된다 - AiResultImageCropperTest)
class VehicleImageFramerTest {

    private static final Path SUPER_CUB = Path.of("frontend/public/assets/vehicles/super-cub-110.png");
    // 지금 설정(flux-2-klein 640px)에서 Magic Hour가 실제로 허용한 비율(application.properties 기본값과 같음)
    private static final List<String> ALLOWED = List.of("1:1", "16:9", "9:16");

    @Test
    void 슈퍼커브_사진은_위쪽_빈공간을_제한하고_좌우로만_패딩하며_잘리지_않는다() throws Exception {
        byte[] original = Files.readAllBytes(SUPER_CUB);
        String before = sha(original);

        Framed f = VehicleImageFramer.frame(original, ALLOWED).orElseThrow();

        // 차량 박스(약 1.29:1)보다 넓은 비율 중 가장 좁은 16:9 - 세로로 늘리지 않으므로 차량 위에 큰 빈 공간이 생기지 않는다.
        // 실제 이미지 비율도 그 값(입력/출력 비율 일치 -> 차량 눌림 없음)
        assertThat(f.aspectRatio()).isEqualTo("16:9");
        String[] r = f.aspectRatio().split(":");
        assertThat((double) f.width() / f.height()).isCloseTo(Double.parseDouble(r[0]) / Double.parseDouble(r[1]), within(0.01));

        // 세로: 차량이 높이의 약 1/(1+0.15+0.06) = 83%. 가로는 패딩 때문에 약 65%(결과에서 잘라냄).
        assertThat(f.vehicleHeightRatio()).isBetween(0.80, 0.86);
        assertThat(f.vehicleWidthRatio()).isBetween(0.60, 0.70);

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

        // 위 여백 = 차량 높이의 약 15%(부품이 차체 위로 솟을 여유), 아래 여백 = 약 6%. 예전 1:1은 위가 약 28%, v3는 약 50%였다.
        int top = -1, bottom = -1;
        for (int y = 0; y < out.getHeight() && top < 0; y++)
            for (int x = 0; x < out.getWidth(); x++) if (alpha(out, x, y) > 16) { top = y; break; }
        for (int y = out.getHeight() - 1; y >= 0 && bottom < 0; y--)
            for (int x = 0; x < out.getWidth(); x++) if (alpha(out, x, y) > 16) { bottom = y; break; }
        int vehicleH = bottom - top + 1;
        assertThat((double) top / vehicleH).isCloseTo(0.15, within(0.01));
        assertThat((out.getHeight() - 1 - bottom) / (double) vehicleH).isCloseTo(0.06, within(0.01));

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
        // 공식 문서 전체 목록이면 4:3(박스 비율 약 1.29 이상 중 가장 좁음 -> 좌우 패딩 최소)
        assertThat(VehicleImageFramer.frame(original, List.of("16:9", "9:16", "4:3", "3:2", "1:1", "4:5", "2:3")).orElseThrow().aspectRatio())
                .isEqualTo("4:3");
        assertThat(VehicleImageFramer.frame(original, List.of("16:9")).orElseThrow().aspectRatio()).isEqualTo("16:9");
        // 좌우로만 늘릴 수 있는 비율이 없으면 예전 기준(긴 변 고정 시 차량이 가장 크게 나오는 비율)
        assertThat(VehicleImageFramer.frame(original, List.of("1:1", "9:16")).orElseThrow().aspectRatio()).isEqualTo("1:1");
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
