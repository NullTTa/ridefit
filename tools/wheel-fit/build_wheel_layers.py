# Super Cub 110 휠 교체 미리보기용 레이어/마스크 생성기 (AI 사용 없음, 같은 입력이면 같은 결과)
#
# 입력
#   - 휠 상품 사진: frontend/public/assets/parts/supercub110-handmade-spoke-wheel.png (사용자 제공 원본을 무손실 복사, 투명 배경 1254x1254)
#   - 차량 사진: 대표 사진(vehicles/super-cub-110.png, 1829x860) + 360 프레임(vehicles/super-cub-110/360/NN.png, 1497x704)
#   - views.json: 뷰마다 앞/뒤 휠의 "림 외곽 타원"(= 타이어 안쪽 경계, 사진을 확대해 실측)과 휠 앞을 가리는 부품(포크/디스크/머플러 등) 다각형
# 출력(뷰와 같은 캔버스 크기 - 기존 360 부품 레이어와 같은 원칙이라 같은 위치/보정으로 겹치기만 하면 된다)
#   - layer: 새 휠을 그 뷰의 타원에 affine으로 맞춘 투명 PNG(차량 이미지 "아래"에 깐다)
#   - mask : 차량 이미지에 거는 알파 마스크(0 = 순정 휠 안쪽을 지움, 255 = 그대로). 가림 부품은 255라 새 휠 앞에 그대로 남는다.
#
# 사용: python tools/wheel-fit/build_wheel_layers.py [--preview DIR] [view ...]
import argparse
import json
import math
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ASSETS = os.path.join(ROOT, 'frontend', 'public', 'assets')
WHEEL = os.path.join(ASSETS, 'parts', 'supercub110-handmade-spoke-wheel.png')
OUT_REP = os.path.join(ASSETS, 'parts', 'overlay', 'super-cub-110-spoke-wheel')
OUT_360 = os.path.join(ASSETS, 'parts', '360', 'super-cub-110', 'spoke-wheel')

# 휠 PNG의 림 외곽(알파 윤곽 fitEllipse 실측: 중심 618.3,624.2 / 1217.6 x 1233.7 - 거의 정원)
C0 = (618.28, 624.18)
R0 = (1217.59 + 1233.75) / 4
# 새 림을 타이어 안쪽 타원보다 2% 크게: 가장자리가 타이어(차량 이미지) 밑으로 들어가 틈이 생기지 않는다.
OVER = 1.02
SS = 4  # 마스크 안티에일리어싱 배율


def vehicle_path(view):
    if view == 'rep':
        return os.path.join(ASSETS, 'vehicles', 'super-cub-110.png')
    return os.path.join(ASSETS, 'vehicles', 'super-cub-110', '360', f'{view}.png')


def ell_poly(e, n=360):
    cx, cy, w, h, ang = e
    t = math.radians(ang)
    pts = []
    for i in range(n):
        u = 2 * math.pi * i / n
        x, y = w / 2 * math.cos(u), h / 2 * math.sin(u)
        pts.append((cx + x * math.cos(t) - y * math.sin(t), cy + x * math.sin(t) + y * math.cos(t)))
    return pts


def warp_wheel(wheel, size, ell):
    """원 모양 휠을 타원(측면=거의 원, 3/4 각도=원근으로 눌린 타원)에 affine으로 맞춘다. 2배 해상도로 변환 후 LANCZOS로 줄여 얇은 스포크 계단 현상을 막는다."""
    W, H = size
    cx, cy, w, h, ang = ell
    a, b = w / 2 * OVER, h / 2 * OVER
    k = 2
    f = max(a, b) * k / R0
    pre = wheel.convert('RGBa').resize((round(wheel.width * f), round(wheel.height * f)), Image.LANCZOS)
    P = np.array(pre).astype(np.float32)
    c0 = (C0[0] * pre.width / wheel.width, C0[1] * pre.height / wheel.height)
    r0 = R0 * pre.width / wheel.width
    t = math.radians(ang)
    R = np.array([[math.cos(t), -math.sin(t)], [math.sin(t), math.cos(t)]])
    M = R @ np.diag([a * k / r0, b * k / r0])
    tv = np.array([cx * k, cy * k]) - M @ np.array(c0)
    out = cv2.warpAffine(P, np.hstack([M, tv[:, None]]), (W * k, H * k), flags=cv2.INTER_CUBIC,
                         borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBa').resize((W, H), Image.LANCZOS)
    return img.convert('RGBA')


def background_like(src):
    s = np.array(src).astype(np.int32)
    a, rgb = s[..., 3], s[..., :3]
    # 투명 배경 + 프레임에 구워진 흰 배경(02~04 프레임은 휠 안쪽이 흰색 불투명)
    return ((a < 40) | ((rgb.min(-1) > 228) & (rgb.max(-1) - rgb.min(-1) < 20))).astype(np.uint8)


def build_view(view, cfg, wheel):
    src = Image.open(vehicle_path(view)).convert('RGBA')
    W, H = src.size
    sc = lambda pts: [(x * SS, y * SS) for x, y in pts]
    m = Image.new('L', (W * SS, H * SS), 255)
    d = ImageDraw.Draw(m)
    wheels = cfg['wheels']
    for wh in wheels:
        d.polygon(sc(ell_poly(wh['ellipse'])), fill=0)
    for wh in wheels:
        for poly in wh.get('keep', []):
            d.polygon(sc(poly), fill=255)
        for e in wh.get('keepEll', []):
            d.polygon(sc(ell_poly(e)), fill=255)
    # 디스크 로터처럼 '링'만 휠 앞에 있는 부품: 링 안쪽(순정 스포크 뿌리)은 다시 지우고 축/포크 끝만 다시 남긴다.
    for wh in wheels:
        for e in wh.get('recutEll', []):
            d.polygon(sc(ell_poly(e)), fill=0)
    for wh in wheels:
        for poly in wh.get('rekeep', []):
            d.polygon(sc(poly), fill=255)
        for e in wh.get('rekeepEll', []):
            d.polygon(sc(ell_poly(e)), fill=255)
    mask = np.array(m.resize((W, H), Image.LANCZOS)).astype(np.int32)

    # 가림 다각형 안에 걸친 "휠 구멍" 배경(투명/흰색)도 지운다 - 남기면 새 스포크 위에 흰 조각이 생긴다.
    # 휠 구멍 = 사진 테두리와 이어지지 않은 배경 성분 중 일부가 지우는 영역(타원 안, 가림 밖)에 걸친 것.
    # 머플러 하이라이트처럼 가림 다각형 안에만 있는 밝은 성분은 건드리지 않는다.
    cut_in = np.zeros((H, W), bool)
    for wh in wheels:
        e = Image.new('L', (W, H), 0)
        ImageDraw.Draw(e).polygon(ell_poly(wh['ellipse']), fill=255)
        cut_in |= np.array(e) > 0
    bg = background_like(src)
    _, lab = cv2.connectedComponents(bg, connectivity=4)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    free = cut_in & (mask < 128) & (bg > 0)
    holes = np.isin(lab, np.setdiff1d(np.unique(lab[free]), border)) & cut_in
    holes = cv2.dilate(holes.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    mask[holes & cut_in] = 0
    mask = Image.fromarray(mask.astype(np.uint8), 'L')

    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    # 휠 "뒤"에 있는 원본 부품(반대쪽 포크 다리 등)은 휠 레이어 맨 아래에 깔아 새 스포크 사이로 보이게 한다.
    beh = Image.new('L', (W * SS, H * SS), 0)
    bd = ImageDraw.Draw(beh)
    has_behind = False
    for wh in wheels:
        for poly in wh.get('behind', []):
            bd.polygon(sc(poly), fill=255)
            has_behind = True
    if has_behind:
        bm = np.array(beh.resize((W, H), Image.LANCZOS)).astype(np.int32)
        bm[bg > 0] = 0
        bs = np.array(src).copy()
        bs[..., 3] = (bs[..., 3].astype(np.int32) * bm // 255).astype(np.uint8)
        layer.alpha_composite(Image.fromarray(bs, 'RGBA'))
    for wh in wheels:
        layer.alpha_composite(warp_wheel(wheel, (W, H), wh['ellipse']))
    return src, mask, layer


def composite(src, mask, layer, bg):
    base = Image.new('RGBA', src.size, bg)
    base.alpha_composite(layer)
    s = np.array(src).copy()
    s[..., 3] = (s[..., 3].astype(np.uint16) * np.array(mask) // 255).astype(np.uint8)
    base.alpha_composite(Image.fromarray(s, 'RGBA'))
    return base


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', help='미리보기 합성 이미지를 저장할 폴더(선택)')
    ap.add_argument('views', nargs='*')
    args = ap.parse_args()
    cfg = json.load(open(os.path.join(os.path.dirname(__file__), 'views.json'), encoding='utf8'))
    wheel = Image.open(WHEEL).convert('RGBA')
    os.makedirs(OUT_REP, exist_ok=True)
    os.makedirs(OUT_360, exist_ok=True)
    for view in args.views or list(cfg):
        src, mask, layer = build_view(view, cfg[view], wheel)
        if view == 'rep':
            layer_path, mask_path = os.path.join(OUT_REP, 'layer.png'), os.path.join(OUT_REP, 'mask.png')
        else:
            layer_path, mask_path = os.path.join(OUT_360, f'{view}.png'), os.path.join(OUT_360, f'mask-{view}.png')
        # 투명 픽셀의 RGB를 0으로 정리(무손실, 파일 크기만 줄어든다)
        arr = np.array(layer)
        arr[arr[..., 3] == 0, :3] = 0
        Image.fromarray(arr, 'RGBA').save(layer_path, optimize=True)
        Image.merge('LA', (Image.new('L', mask.size, 0), mask)).save(mask_path, optimize=True)
        if args.preview:
            os.makedirs(args.preview, exist_ok=True)
            for name, color in [('w', (255, 255, 255, 255)), ('k', (17, 19, 26, 255))]:
                composite(src, mask, layer, color).convert('RGB').save(os.path.join(args.preview, f'prev_{view}_{name}.png'))
        print(view, os.path.getsize(layer_path), os.path.getsize(mask_path))


if __name__ == '__main__':
    main()
