package com.ridefit.ridefit.service;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Optional;

// AI 장착 합성에 보낼 "차량 이미지"만 다시 구도를 잡는다(원본 파일은 그대로 - 360 Viewer/FitRoom은 원본을 계속 쓴다).
//
// 왜 필요한가: 차종 대표 사진(예: super-cub-110.png, 1829x860)은 투명 배경에 좌우 여백이 커서 차량이 가로의 65%만 차지한다.
// 이미지 편집 AI는 입력 구도를 그대로 유지하므로 결과에서도 차량이 작게 보인다. 그래서
//  1) 투명하지 않은 픽셀(실제 차량)의 bounding box를 찾고
//  2) 사방에 차량 크기의 MARGIN 만큼 여백을 두고(차량이 약 89% 차지, 바퀴/핸들/미러가 잘리지 않음)
//  3) 이미지 API가 허용하는 비율 중 "결과 해상도(긴 변 고정)에서 차량이 가장 크게 나오는" 비율로 "늘리기만" 해서
//     (투명 여백 추가, 절대 자르지 않음) 맞춘다. 예: 640px(긴 변)에서 차량 박스 1.4:1 -> 1:1이면 차량 폭 570px, 16:9면 448px.
// 결과 비율 문자열(예: "1:1")을 요청의 aspect_ratio로 함께 보내므로, 입력/출력 비율이 같아 차량이 눌리거나 늘어나지 않는다.
//
// 투명 배경이 아닌 사진(사용자가 올린 JPG 등)은 배경과 차량을 구분할 수 없으므로 손대지 않는다(empty 반환 -> 예전과 동일).
// 특정 차종 좌표를 하드코딩하지 않으므로 투명 배경의 다른 차종 사진에도 그대로 적용된다.
public final class VehicleImageFramer {

    // 차량 크기 대비 사방 여백 비율. 0.06 -> 차량이 프레임의 약 1/1.12 = 89%.
    static final double MARGIN = 0.06;
    // 이 값보다 불투명한 픽셀을 차량으로 본다(가장자리 반투명 그림자/안티앨리어싱 잡음 제외).
    static final int ALPHA_THRESHOLD = 16;

    private VehicleImageFramer() {
    }

    // 원본 대비 잘라낸 위치(offsetX/Y: 새 이미지에서 원본 (0,0)이 놓인 위치, 음수 아님 = 여백)와 크기.
    public record Framed(byte[] png, String aspectRatio, int sourceWidth, int sourceHeight,
                         int width, int height, int offsetX, int offsetY, double vehicleWidthRatio, double vehicleHeightRatio) {

        // 원본 사진 기준 0~100% 좌표를 새 이미지 기준 0~100% 로 바꾼다(장착 위치 힌트용).
        public Double mapX(Double percent) {
            return percent == null ? null : (percent / 100.0 * sourceWidth + offsetX) / width * 100.0;
        }

        public Double mapY(Double percent) {
            return percent == null ? null : (percent / 100.0 * sourceHeight + offsetY) / height * 100.0;
        }
    }

    // allowedRatios: 결과 비율로 보낼 수 있는 값들(예: "1:1", "16:9"). 이 중에서만 고른다.
    public static Optional<Framed> frame(byte[] imageBytes, List<String> allowedRatios) throws IOException {
        if (allowedRatios == null || allowedRatios.isEmpty()) return Optional.empty();
        BufferedImage src = ImageIO.read(new ByteArrayInputStream(imageBytes));
        if (src == null || !src.getColorModel().hasAlpha()) return Optional.empty();
        int w = src.getWidth(), h = src.getHeight();

        int minX = w, minY = h, maxX = -1, maxY = -1;
        boolean anyTransparent = false;
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int a = (src.getRGB(x, y) >>> 24) & 0xFF;
                if (a > ALPHA_THRESHOLD) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                } else {
                    anyTransparent = true;
                }
            }
        }
        // 전부 투명(빈 이미지)이거나 투명 배경이 없는 이미지는 구도를 바꾸지 않는다.
        if (maxX < 0 || !anyTransparent) return Optional.empty();

        int bw = maxX - minX + 1, bh = maxY - minY + 1;
        int mx = (int) Math.round(bw * MARGIN), my = (int) Math.round(bh * MARGIN);
        double boxW = bw + 2.0 * mx, boxH = bh + 2.0 * my;

        // 허용 비율 중 차량이 가장 크게 나오는 비율로, 모자란 쪽만 늘린다.
        String ratio = bestRatio(boxW / boxH, allowedRatios);
        double target = ratioValue(ratio);
        double outW = boxW, outH = boxH;
        if (boxW / boxH < target) outW = boxH * target;
        else outH = boxW / target;
        int ow = (int) Math.round(outW), oh = (int) Math.round(outH);

        // 차량 박스를 새 캔버스 가운데에 둔다. 원본 (0,0)이 놓일 위치.
        // (2026-10-02 실제 호출로 확인: 남는 세로 공간을 전부 위쪽에 두고 "그 공간을 쓰라"고 하자 윈드스크린이 실제보다
        //  훨씬 크게 그려졌다. 가운데 배치(위/아래 약 18%)로도 윈드스크린이 들어갈 공간은 충분하므로 가운데로 둔다.)
        int offX = (int) Math.round((ow - bw) / 2.0) - minX;
        int offY = (int) Math.round((oh - bh) / 2.0) - minY;

        BufferedImage out = new BufferedImage(ow, oh, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = out.createGraphics();
        try {
            g.drawImage(src, offX, offY, null);
        } finally {
            g.dispose();
        }
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ImageIO.write(out, "png", bytes);
        return Optional.of(new Framed(bytes.toByteArray(), ratio, w, h, ow, oh, offX, offY,
                (double) bw / ow, (double) bh / oh));
    }

    // 결과 이미지의 긴 변이 고정(예: 640px)일 때 차량이 가장 크게 그려지는 비율 = 늘린 뒤 캔버스의 긴 변이 가장 짧은 비율.
    // (박스 높이를 1로 두면: 비율 r >= 박스비율 b 면 캔버스 r x 1, 아니면 b x b/r.) 같으면 박스 비율에 더 가까운 쪽.
    static String bestRatio(double b, List<String> allowed) {
        String best = null;
        double bestLong = Double.MAX_VALUE, bestDist = Double.MAX_VALUE;
        for (String s : allowed) {
            double r = ratioValue(s);
            double longSide = r >= b ? Math.max(r, 1.0) : Math.max(b, b / r);
            double dist = Math.abs(Math.log(b / r));
            if (longSide < bestLong - 1e-9 || (Math.abs(longSide - bestLong) <= 1e-9 && dist < bestDist)) {
                best = s;
                bestLong = longSide;
                bestDist = dist;
            }
        }
        return best;
    }

    static double ratioValue(String ratio) {
        String[] p = ratio.split(":");
        return Double.parseDouble(p[0]) / Double.parseDouble(p[1]);
    }
}
