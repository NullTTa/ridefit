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
    // 실제 Magic Hour 결과(2026-10-02 resultId=4, v5 프롬프트, 16:9 요청 -> 640x384 수신 -> 여백 자르기 후 저장본 468x379)
    private static final Path REAL_V5 = Path.of("src/test/resources/ai-fit/real-result-v5-windscreen-468x379.png");

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
        // 1:1만 허용되는 경우: framing한 1:1 입력을 AI가 같은 구도로 검은 배경 640x640에 그린 경우를 재현
        VehicleImageFramer.Framed f = VehicleImageFramer.frame(Files.readAllBytes(SUPER_CUB), List.of("1:1")).orElseThrow();
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
    void 기본_16대9_framing_결과의_좌우_패딩을_잘라_차량이_가로_85에서_90퍼센트를_차지한다() throws Exception {
        // 지금 설정(1:1,16:9,9:16)에서 framer가 고르는 16:9 입력을 AI가 같은 구도로 검은 배경 640x360에 그린 경우를 재현
        VehicleImageFramer.Framed f = VehicleImageFramer.frame(Files.readAllBytes(SUPER_CUB), List.of("1:1", "16:9", "9:16")).orElseThrow();
        assertThat(f.aspectRatio()).isEqualTo("16:9");
        BufferedImage framed = ImageIO.read(new ByteArrayInputStream(f.png()));
        BufferedImage result = new BufferedImage(640, 360, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = result.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(framed, 0, 0, 640, 360, null);
        g.dispose();
        // 입력 단계: 가로는 패딩 때문에 약 65%(기준 미달) - 결과에서 잘라야 한다
        assertThat(vehicleWidthRatio(result)).isLessThan(0.70);

        Cropped c = AiResultImageCropper.crop(png(result)).orElseThrow();
        BufferedImage out = ImageIO.read(new ByteArrayInputStream(c.png()));
        assertThat(vehicleWidthRatio(out)).isBetween(0.85, 0.90);
        assertThat(1 - vehicleWidthRatio(out)).isLessThanOrEqualTo(0.20);
        assertThat(c.touchedEdges()).isEmpty();
        assertThat(vehiclePixels(out)).isEqualTo(vehiclePixels(result));
    }

    @Test
    void 요청_비율과_다르게_온_실제_결과는_비율을_되돌리면_차량_비율이_원본과_같아진다() throws Exception {
        // 실제 Magic Hour 결과(2026-10-02 resultId=4): 16:9 를 요청했는데 640x384 로 와서 차량이 세로로 늘어나 있었다.
        // 저장본(자른 뒤 468x379)을 같은 크기의 640x384 검은 캔버스에 되돌려 놓으면 "받은 원본"과 같은 세로 배율이 된다.
        BufferedImage cropped = ImageIO.read(REAL_V5.toFile());
        BufferedImage raw = new BufferedImage(640, 384, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = raw.createGraphics();
        g.drawImage(cropped, 86, 2, null);
        g.dispose();

        // 원본 사진의 차량(미러 끝~바퀴 바닥) 가로/세로 = 1198/857. 받은 그대로는 세로로 약 6.7% 늘어나 있다.
        double sourceRatio = 1198.0 / 857;
        assertThat(vehicleAspect(raw) / sourceRatio).isLessThan(0.95);

        BufferedImage fixed = ImageIO.read(new ByteArrayInputStream(AiResultImageCropper.restoreAspect(png(raw), "16:9").orElseThrow()));
        assertThat(fixed.getWidth()).isEqualTo(640);
        assertThat(fixed.getHeight()).isEqualTo(360);
        assertThat(vehicleAspect(fixed) / sourceRatio).isCloseTo(1.0, org.assertj.core.data.Offset.offset(0.02));

        // 비율이 이미 맞으면 손대지 않는다
        assertThat(AiResultImageCropper.restoreAspect(png(fixed), "16:9")).isEmpty();
        assertThat(AiResultImageCropper.restoreAspect(png(fixed), null)).isEmpty();
    }

    // 차량 가로/세로. 윈드스크린(차체 위로 솟은 부품)을 빼려고 세로 위쪽 끝은 "먼 쪽 미러 머리" 열 범위의 최상단으로 잡는다
    // (원본 사진에서도 차량 최상단 = 그 미러 머리). 그 열 범위는 가로 bbox 기준 비율(원본 x 815~875 / 차량 x 290~1487)로 환산.
    private static double vehicleAspect(BufferedImage img) {
        int x0 = -1, x1 = -1, y1 = -1;
        for (int x = 0; x < img.getWidth(); x++) {
            int n = 0;
            for (int y = 0; y < img.getHeight(); y++) if (isVehicle(img, x, y)) n++;
            if (n >= 2) { if (x0 < 0) x0 = x; x1 = x; }
        }
        for (int y = 0; y < img.getHeight(); y++) {
            int n = 0;
            for (int x = 0; x < img.getWidth(); x++) if (isVehicle(img, x, y)) n++;
            if (n >= 2) y1 = y;
        }
        double k = (x1 - x0 + 1) / 1198.0;
        int mx0 = (int) (x0 + (815 - 290) * k), mx1 = (int) (x0 + (875 - 290) * k);
        int top = -1;
        for (int y = 0; y < img.getHeight() && top < 0; y++) {
            int n = 0;
            for (int x = mx0; x < mx1; x++) if (isVehicle(img, x, y)) n++;
            if (n >= 2) top = y;
        }
        return (x1 - x0 + 1) / (double) (y1 - top + 1);
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
