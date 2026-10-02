package com.ridefit.ridefit.service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Optional;

// AI 장착 결과 이미지를 "차량 bounding box + 사방 MARGIN"으로 잘라 빈 배경을 없앤다(저장 전 1회).
//
// 왜 필요한가: VehicleImageFramer가 입력을 1:1로 맞추면 가로는 차량이 약 89%를 차지하지만, 차량(약 1.4:1)보다 세로가 길어
// 위/아래에 빈 배경이 약 35% 남는다. 결과를 이 상태로 보여주면 화면에서 차량이 작아 보이므로, 결과에서 차량 영역만 남긴다.
//
// 안전장치(하나라도 걸리면 원본 그대로 반환 = 예전과 같음):
//  - 네 모서리 색이 서로 다르면(배경이 단색이 아닌 장면 사진) 차량과 배경을 구분할 수 없으므로 자르지 않는다.
//  - 차량으로 잡힌 영역이 너무 작으면(전체의 15% 미만) 검출 실패로 보고 자르지 않는다.
//  - 차량 픽셀이 이미지 테두리에 닿은 쪽은 여백을 만들 수 없으므로 그쪽은 테두리 그대로 둔다(절대 차량 안쪽을 자르지 않음).
// 확대/축소는 하지 않는다(픽셀 해상도 그대로, 잘라내기만).
public final class AiResultImageCropper {

    // 차량 크기 대비 사방 여백. 0.06 -> 차량이 결과 가로/세로의 약 89% (VehicleImageFramer와 같은 값).
    static final double MARGIN = 0.06;
    // 배경색과 채널 차이가 이 값보다 크면 차량 픽셀. 검은 배경 위 검은 타이어(밝기 30~40)도 잡히도록 낮게 둔다.
    static final int COLOR_THRESHOLD = 16;
    // 네 모서리 색이 서로 이 값 이상 다르면 단색 배경이 아니다.
    static final int CORNER_TOLERANCE = 12;
    // 행/열에 차량 픽셀이 이 개수 이상 있어야 차량으로 본다(배경의 점 잡음 제외).
    static final int MIN_PIXELS = 2;
    static final double MIN_AREA_RATIO = 0.15;

    private AiResultImageCropper() {
    }

    public record Cropped(byte[] png, int sourceWidth, int sourceHeight, int width, int height,
                          double vehicleWidthRatio, double vehicleHeightRatio, String touchedEdges) {
    }

    // 요청한 비율(예: "16:9")과 받은 이미지 비율이 1% 넘게 다르면, 높이를 요청 비율에 맞게 다시 맞춘다(가로 픽셀은 그대로).
    // 왜: Magic Hour flux-2-klein 640px 에 16:9 를 요청하면 640x384(5:3)가 온다. 실제 결과(2026-10-02 resultId=4)에서
    // 차량이 원본 대비 세로로 1.067배(= 384/360) 늘어나 있었다 - 입력(16:9)을 결과 크기에 맞춰 늘려 그린 것.
    // 되돌리면 차량/부품 비율이 원본과 같아진다. 비율이 같거나 ratio가 없으면 empty(그대로 사용).
    public static Optional<byte[]> restoreAspect(byte[] imageBytes, String ratio) throws IOException {
        if (ratio == null || !ratio.matches("\\d+:\\d+")) return Optional.empty();
        BufferedImage src = ImageIO.read(new ByteArrayInputStream(imageBytes));
        if (src == null) return Optional.empty();
        String[] p = ratio.split(":");
        double target = Double.parseDouble(p[0]) / Double.parseDouble(p[1]);
        double actual = (double) src.getWidth() / src.getHeight();
        if (Math.abs(actual / target - 1) <= 0.01) return Optional.empty();
        int w = src.getWidth(), h = (int) Math.round(w / target);
        BufferedImage out = new BufferedImage(w, h, src.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        java.awt.Graphics2D g = out.createGraphics();
        try {
            g.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION, java.awt.RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.drawImage(src, 0, 0, w, h, null);
        } finally {
            g.dispose();
        }
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ImageIO.write(out, "png", bytes);
        return Optional.of(bytes.toByteArray());
    }

    public static Optional<Cropped> crop(byte[] imageBytes) throws IOException {
        BufferedImage src = ImageIO.read(new ByteArrayInputStream(imageBytes));
        if (src == null) return Optional.empty();
        int w = src.getWidth(), h = src.getHeight();
        int patch = Math.max(1, Math.min(10, Math.min(w, h) / 20));

        int[][] corners = {
                avg(src, 0, 0, patch), avg(src, w - patch, 0, patch),
                avg(src, 0, h - patch, patch), avg(src, w - patch, h - patch, patch)};
        int[] bg = new int[4];
        for (int c = 0; c < 4; c++) {
            int min = 255, max = 0;
            for (int[] k : corners) {
                min = Math.min(min, k[c]);
                max = Math.max(max, k[c]);
                bg[c] += k[c];
            }
            if (max - min > CORNER_TOLERANCE) return Optional.empty();
            bg[c] /= 4;
        }
        boolean alphaBackground = bg[3] < 128;

        int[] colCount = new int[w], rowCount = new int[h];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int p = src.getRGB(x, y);
                int a = (p >>> 24) & 0xFF;
                boolean vehicle;
                if (alphaBackground) {
                    vehicle = a > COLOR_THRESHOLD;
                } else {
                    int r = (p >> 16) & 0xFF, g = (p >> 8) & 0xFF, b = p & 0xFF;
                    vehicle = Math.max(Math.abs(r - bg[0]), Math.max(Math.abs(g - bg[1]), Math.abs(b - bg[2]))) > COLOR_THRESHOLD;
                }
                if (vehicle) {
                    colCount[x]++;
                    rowCount[y]++;
                }
            }
        }
        int x0 = first(colCount), x1 = last(colCount), y0 = first(rowCount), y1 = last(rowCount);
        if (x0 < 0 || y0 < 0) return Optional.empty();
        int bw = x1 - x0 + 1, bh = y1 - y0 + 1;
        if ((double) bw * bh < MIN_AREA_RATIO * w * h) return Optional.empty();

        int mx = (int) Math.round(bw * MARGIN), my = (int) Math.round(bh * MARGIN);
        int cx0 = Math.max(0, x0 - mx), cy0 = Math.max(0, y0 - my);
        int cx1 = Math.min(w - 1, x1 + mx), cy1 = Math.min(h - 1, y1 + my);
        int cw = cx1 - cx0 + 1, ch = cy1 - cy0 + 1;
        if (cw == w && ch == h) return Optional.empty();

        StringBuilder touched = new StringBuilder();
        if (x0 == 0) touched.append('L');
        if (x1 == w - 1) touched.append('R');
        if (y0 == 0) touched.append('T');
        if (y1 == h - 1) touched.append('B');

        BufferedImage out = new BufferedImage(cw, ch, alphaBackground ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        out.getGraphics().drawImage(src.getSubimage(cx0, cy0, cw, ch), 0, 0, null);
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ImageIO.write(out, "png", bytes);
        return Optional.of(new Cropped(bytes.toByteArray(), w, h, cw, ch,
                (double) bw / cw, (double) bh / ch, touched.toString()));
    }

    private static int[] avg(BufferedImage img, int x0, int y0, int size) {
        long[] sum = new long[4];
        for (int y = y0; y < y0 + size; y++) {
            for (int x = x0; x < x0 + size; x++) {
                int p = img.getRGB(x, y);
                sum[0] += (p >> 16) & 0xFF;
                sum[1] += (p >> 8) & 0xFF;
                sum[2] += p & 0xFF;
                sum[3] += (p >>> 24) & 0xFF;
            }
        }
        int n = size * size;
        return new int[]{(int) (sum[0] / n), (int) (sum[1] / n), (int) (sum[2] / n), (int) (sum[3] / n)};
    }

    private static int first(int[] counts) {
        for (int i = 0; i < counts.length; i++) if (counts[i] >= MIN_PIXELS) return i;
        return -1;
    }

    private static int last(int[] counts) {
        for (int i = counts.length - 1; i >= 0; i--) if (counts[i] >= MIN_PIXELS) return i;
        return -1;
    }
}
