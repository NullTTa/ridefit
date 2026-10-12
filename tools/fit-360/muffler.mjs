// 머플러 360 레이어: 순정 머플러 자리(다각형)를 바퀴 회전 대칭으로 메우고, 상품 컷을 머플러 축에 원근 변환해 올린다.
// usage: node muffler.mjs <view> <outLayer.png> <outPreview.png>  (COMBO=1 = 마차 휠 동시 장착 변형, README.md 참고)
import fs from 'node:fs'
import { load, blank, save, frameP, sample, overPx, warpOnto, PUB, HERE } from './lib.mjs'

const V = JSON.parse(fs.readFileSync(`${HERE}/views-muffler.json`, 'utf8'))
const view = process.argv[2]
const cfg = V[view]
const frame = load(frameP(+view))
const prod = load(`${PUB}/assets/parts/overlay/cub110-stainless-exhaust.png`)
const out = blank(frame.w, frame.h)

const inPoly = (poly, x, y) => {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
const stock = cfg.stock ?? []
const occl = cfg.occluders ?? [] // 회전 원본으로 쓰면 안 되는 영역(쇼크 등)
// 1) 순정 머플러 자리 메우기: 뒷바퀴 타원 좌표계에서 72도 배수 회전한 위치의 픽셀 중앙값.
const [ecx, ecy, ew, eh, eang] = cfg.wheel ?? [0, 0, 1, 1, 0]
const t = (eang * Math.PI) / 180
const toWheel = (x, y) => { // 이미지 -> 단위원 좌표(타원 정규화)
  const dx = x - ecx, dy = y - ecy
  const u = dx * Math.cos(t) + dy * Math.sin(t), v = -dx * Math.sin(t) + dy * Math.cos(t)
  return [u / (ew / 2), v / (eh / 2)]
}
const fromWheel = (u, v) => {
  const a = u * (ew / 2), b = v * (eh / 2)
  return [ecx + a * Math.cos(t) - b * Math.sin(t), ecy + a * Math.sin(t) + b * Math.cos(t)]
}
const period = cfg.period ?? 72
const rmax = cfg.rmax ?? 1.32 // 타이어 바깥(림 안쪽 반지름 기준 배수)
let filled = 0, unfilled = 0
const unfilledPts = []
const SS = 3
const COMBO = process.env.COMBO === "1"
for (let y = 0; y < frame.h; y++) for (let x = 0; x < frame.w; x++) {
  if (!cfg.wheel) break
  // 다각형 커버리지(슈퍼샘플)
  let cov = 0
  for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) if (inPoly(stock, x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)) cov++
  if (!cov) continue
  cov /= SS * SS
  const [u, v] = toWheel(x + 0.5, y + 0.5)
  const r = Math.hypot(u, v)
  // 휠 교체(수제 마차 휠)와 함께 장착할 때: 림 안쪽은 메우지 않는다 - 그 자리는 차량 프레임 마스크로 지워 아래에 깔린 새 휠이 보이게 한다.
  if (COMBO && r < 1) continue
  const cands = []
  if (r <= rmax) {
    // 허브(중심부)는 거의 원형 대칭이라 아무 각도나 쓸 수 있다 - 72도 배수만 쓰면 띠 안으로 다시 떨어져 비는 곳이 생긴다.
    const angles = r < (cfg.hubR ?? 0.3)
      ? Array.from({ length: 17 }, (_, i) => (i + 1) * 20)
      : Array.from({ length: Math.round(360 / period) - 1 }, (_, i) => (i + 1) * period)
    for (const deg of angles) {
      {
        const a = (deg * Math.PI) / 180
        const uu = u * Math.cos(a) - v * Math.sin(a), vv = u * Math.sin(a) + v * Math.cos(a)
        const [sx, sy] = fromWheel(uu, vv)
        if (inPoly(stock, sx, sy) || occl.some((p) => inPoly(p, sx, sy))) continue
        const p = sample(frame, sx - 0.5, sy - 0.5)
        if (p[3] < 250) continue
        cands.push(p)
      }
    }
  }
  if (cands.length === 0) { unfilled++; unfilledPts.push([x, y, cov]); continue }
  filled++
  const med = [0, 1, 2].map((c) => { const s = cands.map((p) => p[c]).sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 })
  overPx(out, x, y, med, cov)
}
if (cfg.wheel) // 1-2) 바퀴 밖(엔진 아래 등)이라 회전으로 못 메운 곳: 주변 픽셀 평균으로 안쪽까지 번지게 메운다(확산 인페인팅).
//      주변이 거의 검정/어두운 금속이라 매끈한 어두운 면이 된다. 투명 배경과 맞닿은 곳은 투명으로 번진다.
{
  const W = frame.w
  const known = new Map() // idx -> [r,g,b,a]
  const todo = new Set(unfilledPts.map(([x, y]) => y * W + x))
  const val = (x, y) => {
    const i = y * W + x
    if (todo.has(i)) return known.get(i) ?? null
    const o = out.d[i * 4 + 3]
    if (o >= 250) return [out.d[i * 4], out.d[i * 4 + 1], out.d[i * 4 + 2], 255]
    if (inPoly(stock, x + 0.5, y + 0.5)) return null
    const fi = i * 4
    return [frame.d[fi], frame.d[fi + 1], frame.d[fi + 2], frame.d[fi + 3]]
  }
  for (let iter = 0; iter < 200 && known.size < todo.size; iter++) {
    const add = []
    for (const i of todo) {
      if (known.has(i)) continue
      const x = i % W, y = (i / W) | 0
      let r = 0, g = 0, b = 0, a = 0, n = 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const p = val(x + dx, y + dy)
        if (!p) continue
        r += p[0]; g += p[1]; b += p[2]; a += p[3]; n++
      }
      if (n >= 2) add.push([i, [r / n, g / n, b / n, a / n]])
    }
    for (const [i, p] of add) known.set(i, p)
    if (!add.length) break
  }
  for (const [x, y, cov] of unfilledPts) {
    const p = known.get(y * W + x)
    if (p && p[3] > 0) overPx(out, x, y, p, cov * (p[3] / 255))
  }
  console.log('inpainted', known.size, 'of', todo.size)
}
let front = []
// 2) 상품 컷을 머플러 축에 맞춰 올린다(축 시작점 = 상품 꼬리 끝, 끝점 = 상품 입구 끝).
if (cfg.axis) {
const [[ax, ay], [bx, by]] = cfg.axis
const L = Math.hypot(bx - ax, by - ay)
const dir = [(bx - ax) / L, (by - ay) / L]
const nrm = [-dir[1], dir[0]]
const s = L / prod.w
const sy = s * (cfg.thick ?? 1)
const cy0 = cfg.prodCenterY ?? 48
const P = (u, v) => [ax + u * s * dir[0] + (v - cy0) * sy * nrm[0], ay + u * s * dir[1] + (v - cy0) * sy * nrm[1]]
let quad = [P(0, 0), P(prod.w, 0), P(prod.w, prod.h), P(0, prod.h)]
if (cfg.persp) { // 3/4 각도: 먼 쪽 끝을 줄인다(원근). persp = 끝점 쪽 높이 배율
  const k = cfg.persp
  const mid = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
  const c2 = mid(P(prod.w, cy0), P(prod.w, 0), k), c3 = mid(P(prod.w, cy0), P(prod.w, prod.h), k)
  quad = [quad[0], c2, c3, quad[3]]
}
front = cfg.front ?? [] // 머플러 앞에 있는 부품(발판 브래킷 등) - 그 자리는 상품을 그리지 않는다
warpOnto(out, prod, quad, { alphaMul: (x, y) => (front.some((p) => inPoly(p, x + 0.5, y + 0.5)) ? 0 : 1), brightness: cfg.brightness ?? 1 })
}
// 2-2) 끝단(뒤에서 보이는 단면): 상품 컷의 실제 세로 색 분포(꼬리관 열 / 몸통 열)를 원판에 옮겨 그린다.
//      kind 'body' = 몸통 뒷면(테이퍼) 원판, 'tail' = 꼬리관 링 + 안쪽 구멍. sx = 가로 압축(45도면 약 0.5, 정면 1).
const profile = (col) => {
  const ys = []
  for (let y = 0; y < prod.h; y++) { const i = (y * prod.w + col) * 4; if (prod.d[i + 3] > 200) ys.push([prod.d[i], prod.d[i + 1], prod.d[i + 2]]) }
  return ys
}
const PROF = { tail: profile(cfg.tailCol ?? 40), body: profile(cfg.bodyCol ?? 120) }
const avg = (pr) => { const m = pr.slice(Math.floor(pr.length * 0.2), Math.ceil(pr.length * 0.8)); return [0, 1, 2].map((c) => m.reduce((a, p) => a + p[c], 0) / m.length) }
const MEAN = { tail: avg(PROF.tail), body: avg(PROF.body) }
console.log('mean', JSON.stringify(MEAN))
for (const cap of cfg.caps ?? []) {
  const pr = PROF[cap.kind]
  const rx = cap.ry * (cap.sx ?? 1), ry = cap.ry
  for (let y = Math.floor(cap.cy - ry - 1); y <= Math.ceil(cap.cy + ry + 1); y++) for (let x = Math.floor(cap.cx - rx - 1); x <= Math.ceil(cap.cx + rx + 1); x++) {
    let cov = 0, r = 0, g = 0, b = 0
    for (let sy = 0; sy < 4; sy++) for (let sx2 = 0; sx2 < 4; sx2++) {
      const px2 = x + (sx2 + 0.5) / 4, py2 = y + (sy + 0.5) / 4
      const ex = (px2 - cap.cx) / rx, ey = (py2 - cap.cy) / ry
      const d = Math.hypot(ex, ey)
      if (d > 1) continue
      // 상품 열의 평균 금속 색(브러시 결 줄무늬는 단면에 없으므로 평균만 쓴다) + 위에서 오는 조명 음영
      const c = MEAN[cap.kind]
      let k = cap.kind === 'body' ? 0.78 + 0.3 * -ey - 0.14 * d * d + 0.3 * Math.exp(-((ey + 0.55) ** 2) / 0.03) : 0.72 + 0.3 * -ey + 0.25 * Math.exp(-((ey + 0.6) ** 2) / 0.02)
      if (d > 0.92) k *= 0.72 // 가장자리 윤곽
      if (cap.kind === 'tail' && d < (cap.hole ?? 0.72)) k = 0.1 + 0.18 * (d / (cap.hole ?? 0.72)) ** 3 + 0.06 * -ey // 배기구 안쪽
      r += c[0] * k; g += c[1] * k; b += c[2] * k; cov++
    }
    if (cov) overPx(out, x, y, [r / cov, g / cov, b / cov], cov / 16)
  }
}
// 앞 가림 부품 픽셀은 차량 프레임 그대로(레이어 투명)라 원래 프레임이 보인다 - 단, 메운 픽셀이 그 위에 덮이면 안 되므로 지운다.
for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) if (front.some((p) => inPoly(p, x + 0.5, y + 0.5))) out.d[(y * out.w + x) * 4 + 3] = 0

// 3) (뒤에서 본 각도) 순정 머플러 중 새 끝단이 덮지 않는 곳은 차량 프레임에 마스크를 걸어 지운다(뒤가 배경이라 투명이 맞다).
if (COMBO) {
  // 림 안쪽의 순정 머플러 자리만 지우는 마스크(새 휠 마스크와 교집합으로 걸린다)
  const m = blank(frame.w, frame.h)
  m.d.fill(255)
  let n0 = 0
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    let c = 0
    for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) { const X = x + (sx + 0.5) / 3, Y = y + (sy + 0.5) / 3; const [u, v] = toWheel(X, Y); if (inPoly(stock, X, Y) && Math.hypot(u, v) < 1) c++ }
    if (c) { m.d[(y * m.w + x) * 4 + 3] = Math.round(255 * (1 - c / 9)); n0++ }
  }
  save(m, process.argv[3].replace(/.png$/, "-mask.png"))
  console.log("combo mask px", n0)
}
if (cfg.erase) {
  const m = blank(frame.w, frame.h)
  m.d.fill(255)
  let n0 = 0
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    let c = 0
    for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) { const X = x + (sx + 0.5) / 3, Y = y + (sy + 0.5) / 3; if (inPoly(cfg.erase, X, Y) && Math.hypot(X - cfg.keep[0], Y - cfg.keep[1]) > cfg.keep[2]) c++ }
    if (c) { m.d[(y * m.w + x) * 4 + 3] = Math.round(255 * (1 - c / 9)); n0++ }
  }
  save(m, process.argv[3].replace(/.png$/, "-mask.png"))
  for (let i = 3; i < frame.d.length; i += 4) frame.d[i] = Math.round(frame.d[i] * m.d[i] / 255)
  console.log("mask px", n0)
}
save(out, process.argv[3])
// 미리보기(프레임 + 레이어)
const prev = { w: frame.w, h: frame.h, d: Buffer.from(frame.d) }
for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
  const i = (y * out.w + x) * 4
  if (out.d[i + 3]) overPx(prev, x, y, [out.d[i], out.d[i + 1], out.d[i + 2]], out.d[i + 3] / 255)
}
save(prev, process.argv[4])
console.log(view, 'filled', filled, 'unfilled', unfilled, unfilledPts.length ? `e.g. ${unfilledPts.slice(0, 5).map((p) => p.join(',')).join(' ')}` : '')
