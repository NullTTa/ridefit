package com.ridefit.ridefit;

import com.ridefit.ridefit.service.AiResultImageCropper;
import com.ridefit.ridefit.service.AiResultImageCropper.Cropped;
import com.ridefit.ridefit.service.VehicleImageFramer;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// AI 결과 여백 자르기: "차량이 결과 가로의 80% 이상(목표 85~90%) / 바퀴·핸들·차체 잘림 없음"을 픽셀로 측정한다.
class AiResultImageCropperTest {

    private static final Path SUPER_CUB = Path.of("frontend/public/assets/vehicles/super-cub-110.png");
    // 실제 Magic Hour 결과(2026-10-01, 비율 auto -> 640x320, 검은 배경 + 검은 차량 = 가장 구분하기 어려운 경우)
    private static final Path REAL_RESULT = Path.of("src/test/resources/ai-fit/real-result-windscreen-640x320.png");

    @Test
    void 실제_AI_결과_좌우_여백을_잘라_차량이_가로_80퍼센트_이상이고_잘리지_않는다() throws Exception {
        BufferedImage src = ImageIO.read(REAL_RESULT.toFile());
        // 예전: 차량 폭 65.6% (좌 15.8% + 우 18.6% 여백)
        assertThat(vehicleWidthRatio(src)).isLessThan(0.70);

        Cropped c = AiResultImageCropper.crop(Files.readAllBytes(REAL_RESULT)).orElseThrow();
        BufferedImage out = ImageIO.read(new ByteArrayInputStream(c.png()));

        assertThat(c.vehicleWidthRatio()).isBetween(0.85, 0.90);
        assertThat(vehicleWidthRatio(out)).isBetween(0.85, 0.90);
        // 좌+우 여백 20% 이하
        assertThat(1 - vehicleWidthRatio(out)).isLessThanOrEqualTo(0.20);
        // 잘림 없음: 차량 픽셀 수가 그대로(차량 안쪽을 한 픽셀도 자르지 않음). 원래 위/아래 테두리에 닿아 있던 결과라 T/B만 표시.
        assertThat(vehiclePixels(out)).isEqualTo(vehiclePixels(src));
        assertThat(c.touchedEdges()).doesNotContain("L").doesNotContain("R");
    }

    @Test
    void 정사각형_framing_결과의_위아래_여백도_잘라_차량이_가로세로_85에서_90퍼센트를_차지한다() throws Exception {
        // framing한 1:1 입력을 AI가 같은 구도로 검은 배경 640x640에 그린 경우를 재현
        VehicleImageFramer.Framed f = VehicleImageFramer.frame(Files.readAllBytes(SUPER_CUB), List.of("1:1", "16:9", "9:16")).orElseThrow();
        BufferedImage framed = ImageIO.read(new ByteArrayInputStream(f.png()));
        BufferedImage result = new BufferedImage(640, 640, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = result.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(framed, 0, 0, 640, 640, null);
        g.dispose();
        // 입력 단계: 가로 89%이지만 세로는 약 64% - 위아래 빈 배경
        assertThat(vehicleWidthRatio(result)).isBetween(0.85, 0.90);
        assertThat(vehicleHeightRatio(result)).isLessThan(0.70);

        Cropped c = AiResultImageCropper.crop(png(result)).orElseThrow();
        BufferedImage out = ImageIO.read(new ByteArrayInputStream(c.png()));
        assertThat(vehicleWidthRatio(out)).isBetween(0.85, 0.90);
        assertThat(vehicleHeightRatio(out)).isBetween(0.85, 0.90);
        assertThat(c.touchedEdges()).isEmpty();
        assertThat(vehiclePixels(out)).isEqualTo(vehiclePixels(result));
    }

    @Test
    void 단색_배경이_아니면_자르지_않는다() throws Exception {
        BufferedImage scene = new BufferedImage(200, 100, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = scene.createGraphics();
        g.setPaint(new GradientPaint(0, 0, Color.DARK_GRAY, 200, 100, Color.LIGHT_GRAY));
        g.fillRect(0, 0, 200, 100);
        g.dispose();
        assertThat(AiResultImageCropper.crop(png(scene))).isEmpty();
    }

    // 측정 기준(커터와 독립): 배경색(검정. 실제 결과 배경은 0~2 잡음)과 채널 차이 > 16 인 픽셀이 2개 이상 있는 열/행의 범위.
    // 자르기 전/후 같은 배경색으로 세야 차량 픽셀 수를 비교할 수 있다.
    private static final int BG = 0x000000;

    private static boolean isVehicle(BufferedImage img, int x, int y) {
        int bg = BG, p = img.getRGB(x, y);
        int d = 0;
        for (int s = 0; s <= 16; s += 8) d = Math.max(d, Math.abs(((p >> s) & 0xFF) - ((bg >> s) & 0xFF)));
        return d > 16;
    }

    private static double vehicleWidthRatio(BufferedImage img) {
        int first = -1, last = -1;
        for (int x = 0; x < img.getWidth(); x++) {
            int n = 0;
            for (int y = 0; y < img.getHeight(); y++) if (isVehicle(img, x, y)) n++;
            if (n >= 2) {
                if (first < 0) first = x;
                last = x;
            }
        }
        return (last - first + 1) / (double) img.getWidth();
    }

    private static double vehicleHeightRatio(BufferedImage img) {
        int first = -1, last = -1;
        for (int y = 0; y < img.getHeight(); y++) {
            int n = 0;
            for (int x = 0; x < img.getWidth(); x++) if (isVehicle(img, x, y)) n++;
            if (n >= 2) {
                if (first < 0) first = y;
                last = y;
            }
        }
        return (last - first + 1) / (double) img.getHeight();
    }

    private static long vehiclePixels(BufferedImage img) {
        long n = 0;
        for (int y = 0; y < img.getHeight(); y++)
            for (int x = 0; x < img.getWidth(); x++)
                if (isVehicle(img, x, y)) n++;
        return n;
    }

    private static byte[] png(BufferedImage img) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }
}
