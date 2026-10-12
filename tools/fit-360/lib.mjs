import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

// 저장소 루트 기준 경로(어느 폴더에서 실행해도 같다). tools/fit-360 -> ../../frontend/public
export const HERE = path.dirname(fileURLToPath(import.meta.url))
const slash = (p) => p.split(path.sep).join('/')
export const PUB = slash(path.resolve(HERE, '..', '..', 'frontend', 'public'))
export const frameP = (n) => `${PUB}/assets/vehicles/super-cub-110/360/${String(n).padStart(2, '0')}.png`

export function load(file) {
  if (!fs.existsSync(file)) throw new Error(`입력 이미지가 없습니다: ${file}`)
  const p = PNG.sync.read(fs.readFileSync(file))
  return { w: p.width, h: p.height, d: p.data }
}
export function blank(w, h) {
  return { w, h, d: Buffer.alloc(w * h * 4) }
}
// frontend/public 아래의 기존 파일은 ALLOW_OVERWRITE=1 일 때만 덮어쓴다(실수로 서비스 중인 레이어를 바꾸지 않게).
// 기본 출력은 tools/fit-360/out/ 처럼 별도 폴더에 두고, 확인 후 직접 복사한다.
export function save(img, file) {
  const abs = slash(path.resolve(file))
  if (abs.startsWith(PUB) && fs.existsSync(abs) && process.env.ALLOW_OVERWRITE !== '1') {
    throw new Error(`기존 서비스 이미지를 덮어쓰려 합니다: ${abs} (의도한 경우 ALLOW_OVERWRITE=1)`)
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  const p = new PNG({ width: img.w, height: img.h })
  img.d.copy(p.data)
  // 완전 투명 픽셀은 RGB 0으로(기존 레이어와 같은 정리)
  for (let i = 0; i < p.data.length; i += 4) if (p.data[i + 3] === 0) p.data[i] = p.data[i + 1] = p.data[i + 2] = 0
  fs.writeFileSync(abs, PNG.sync.write(p, { colorType: 6 }))
}
export const px = (img, x, y) => {
  const i = (y * img.w + x) * 4
  return [img.d[i], img.d[i + 1], img.d[i + 2], img.d[i + 3]]
}

// 크롬(무채색, 밝음) 판정
export function isChrome([r, g, b, a], minL = 95) {
  if (a < 128) return false
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  const l = (r + g + b) / 3
  return l >= minL && l <= 238 && (mx - mn) <= 28
}

// 양선형 샘플(프리멀티플라이드로 섞어 가장자리 검은 테두리 방지). 범위 밖은 투명.
export function sample(img, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const fx = x - x0, fy = y - y0
  let r = 0, g = 0, b = 0, a = 0
  for (const [dx, dy, wt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
    const xx = x0 + dx, yy = y0 + dy
    if (xx < 0 || yy < 0 || xx >= img.w || yy >= img.h || wt === 0) continue
    const i = (yy * img.w + xx) * 4
    const al = img.d[i + 3] / 255
    r += img.d[i] * al * wt; g += img.d[i + 1] * al * wt; b += img.d[i + 2] * al * wt; a += al * wt
  }
  if (a <= 0) return [0, 0, 0, 0]
  return [r / a, g / a, b / a, a * 255]
}

// 3x3 호모그래피: src 사각형 4점 -> dst 4점
export function homography(src, dst) {
  const A = [], B = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v)
  }
  const n = 8
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    ;[A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = A[r][c] / A[c][c]
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]
      B[r] -= f * B[c]
    }
  }
  const h = B.map((b, i) => b / A[i][i])
  return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]]
}
export function invert3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g
  const det = a * A + b * B + c * C
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ]
}
export const apply = (m, x, y) => {
  const w = m[2][0] * x + m[2][1] * y + m[2][2]
  return [(m[0][0] * x + m[0][1] * y + m[0][2]) / w, (m[1][0] * x + m[1][1] * y + m[1][2]) / w]
}

// src 이미지를 dst 사각형(4점, src 이미지의 네 모서리 순서 TL,TR,BR,BL 또는 srcQuad 지정)에 원근 변환해 out 위에 over 합성.
// 슈퍼샘플(ss x ss)로 계단 현상을 줄인다. alphaMul(x,y)로 픽셀별 가림(차체 앞 부품 등) 적용 가능.
export function warpOnto(out, src, dstQuad, { srcQuad, ss = 3, alphaMul, brightness = 1 } = {}) {
  const sq = srcQuad ?? [[0, 0], [src.w, 0], [src.w, src.h], [0, src.h]]
  const inv = invert3(homography(sq, dstQuad))
  const xs = dstQuad.map((p) => p[0]), ys = dstQuad.map((p) => p[1])
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 1), x1 = Math.min(out.w - 1, Math.ceil(Math.max(...xs)) + 1)
  const y0 = Math.max(0, Math.floor(Math.min(...ys)) - 1), y1 = Math.min(out.h - 1, Math.ceil(Math.max(...ys)) + 1)
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let r = 0, g = 0, b = 0, a = 0
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const [u, v] = apply(inv, x + (sx + 0.5) / ss, y + (sy + 0.5) / ss)
      const s = sample(src, u - 0.5, v - 0.5)
      const al = s[3] / 255
      r += s[0] * al; g += s[1] * al; b += s[2] * al; a += al
    }
    if (a <= 0) continue
    r /= a; g /= a; b /= a; a /= ss * ss
    if (alphaMul) a *= alphaMul(x, y)
    if (a <= 0) continue
    overPx(out, x, y, [Math.min(255, r * brightness), Math.min(255, g * brightness), Math.min(255, b * brightness)], a)
  }
}
export function overPx(out, x, y, [r, g, b], a) {
  const i = (y * out.w + x) * 4
  const da = out.d[i + 3] / 255
  const oa = a + da * (1 - a)
  if (oa <= 0) return
  out.d[i] = Math.round((r * a + out.d[i] * da * (1 - a)) / oa)
  out.d[i + 1] = Math.round((g * a + out.d[i + 1] * da * (1 - a)) / oa)
  out.d[i + 2] = Math.round((b * a + out.d[i + 2] * da * (1 - a)) / oa)
  out.d[i + 3] = Math.round(oa * 255)
}
