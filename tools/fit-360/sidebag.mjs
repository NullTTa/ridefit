// 사이드백(한 쌍) 360 레이어: 가방 상자(차량 좌표, mm)를 프레임마다 정사영(방위각/고도/배율/뒤축 위치)으로 투영하고,
// 실제 상품 사진의 바깥 면/끝 면을 그 면 사각형에 원근 변환해 붙인다(AI 없음, 같은 입력이면 같은 결과).
// usage: node sidebag.mjs <view> <outLayer.png> <outPreview.png> [--wire]
import fs from 'node:fs'
import { load, blank, save, frameP, overPx, warpOnto, PUB, HERE } from './lib.mjs'

const V = JSON.parse(fs.readFileSync(`${HERE}/views-sidebag.json`, 'utf8'))
const [view, outPath, prevPath, flag] = process.argv.slice(2)
const g = V.global
const cfg = { ...g.defaults, ...V[view] }
const frame = load(cfg.vehicle ? `${PUB}${cfg.vehicle}` : frameP(+view))
// texSource: 면 텍스처를 뜰 이미지(없으면 상품 사진). tex 좌표는 이 이미지 기준.
const prod = load(`${PUB}${g.texSource ?? '/assets/parts/saddlebag-pair-lace.png'}`)
// endTex(선택): 앞/뒤 끝 면만 다른 이미지에서 뜬다 { source, quad } - texSource에 끝 면이 거의 안 보일 때(측면 사진) 쓴다.
const endImg = g.endTex ? load(`${PUB}${g.endTex.source}`) : prod
const out = blank(frame.w, frame.h)

const deg = Math.PI / 180
const b = cfg.beta * deg, f = cfg.phi * deg, s = cfg.s
let [Cx, Cy] = cfg.C ?? [0, 0]
// 화면 좌표 = C + aX*X + aY*Y + aZ*Z (X 앞, Y 위, Z 오른쪽 / 뒤축 중심 = 원점)
let aX = [s * Math.sin(b), s * Math.cos(b) * Math.sin(f)]
let aY = [0, -s * Math.cos(f)]
let aZ = [-s * Math.cos(b), s * Math.sin(b) * Math.sin(f)]
const proj = ([X, Y, Z]) => [Cx + aX[0] * X + aY[0] * Y + aZ[0] * Z, Cy + aX[1] * X + aY[1] * Y + aZ[1] * Z]
let cam = [Math.cos(b) * Math.cos(f), Math.sin(f), Math.sin(b) * Math.cos(f)] // 카메라 쪽 방향
// 대표 사진(2D)처럼 렌즈/각도가 360 프레임과 다른 사진: 3D 위치를 아는 기준점(뒤축/짐받이 앞뒤 끝/미등/머플러 끝)과
// 그 사진 속 위치로 정사영(affine)을 최소제곱으로 맞춘다. landmarks: [[X,Y,Z],[x,y]] 목록.
if (cfg.landmarks) {
  const L = cfg.landmarks
  const solve = (k) => { // [C, aX, aY, aZ] for 좌표 k
    const A = L.map(([[X, Y, Z]]) => [1, X, Y, Z]), B = L.map(([, p]) => p[k])
    const AtA = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => A.reduce((t, r) => t + r[i] * r[j], 0)))
    const AtB = [0, 1, 2, 3].map((i) => A.reduce((t, r, n) => t + r[i] * B[n], 0))
    for (let c = 0; c < 4; c++) { let p = c; for (let r = c + 1; r < 4; r++) if (Math.abs(AtA[r][c]) > Math.abs(AtA[p][c])) p = r; [AtA[c], AtA[p]] = [AtA[p], AtA[c]]; [AtB[c], AtB[p]] = [AtB[p], AtB[c]]; for (let r = 0; r < 4; r++) { if (r === c) continue; const q = AtA[r][c] / AtA[c][c]; for (let j = c; j < 4; j++) AtA[r][j] -= q * AtA[c][j]; AtB[r] -= q * AtB[c] } }
    return AtB.map((v, i) => v / AtA[i][i])
  }
  const sx = solve(0), sy = solve(1)
  ;[Cx, Cy] = [sx[0], sy[0]]
  aX = [sx[1], sy[1]]; aY = [sx[2], sy[2]]; aZ = [sx[3], sy[3]]
  const r1 = [aX[0], aY[0], aZ[0]], r2 = [aX[1], aY[1], aZ[1]]
  let c = [r1[1] * r2[2] - r1[2] * r2[1], r1[2] * r2[0] - r1[0] * r2[2], r1[0] * r2[1] - r1[1] * r2[0]]
  const n = Math.hypot(...c); c = c.map((v) => v / n)
  if (Math.sign(c[2]) !== (cfg.camZSign ?? 1)) c = c.map((v) => -v)
  cam = c
  const res = L.map(([[X, Y, Z], [x, y]]) => Math.hypot(sx[0] + sx[1] * X + sx[2] * Y + sx[3] * Z - x, sy[0] + sy[1] * X + sy[2] * Y + sy[3] * Z - y).toFixed(1))
  console.log('affine fit residual px', res.join(' '), 'aX', aX.map((v) => v.toFixed(3)), 'aY', aY.map((v) => v.toFixed(3)), 'aZ', aZ.map((v) => v.toFixed(3)), 'cam', cam.map((v) => v.toFixed(2)))
}
const depth = ([X, Y, Z]) => X * cam[0] + Y * cam[1] + Z * cam[2]

const { x0, x1, y0, y1, zin, zout } = g.box
// 상품 사진의 면(가까운 가방): outer = 바깥 면(TL=뒤-위, TR=앞-위, BR=앞-아래, BL=뒤-아래),
// end = 끝 면(TL=안쪽-위, TR=바깥-위, BR=바깥-아래, BL=안쪽-아래)
const TEX = g.tex
const faces = []
for (const side of [1, -1]) { // 1 = 오른쪽 가방, -1 = 왼쪽 가방(같은 상품의 반대쪽 짝 - 면 대응으로 자동 좌우 반전)
  const zo = side * zout, zi = side * zin
  faces.push({ side, name: 'outer', n: [0, 0, side], tex: TEX.outer, pts: [[x0, y1, zo], [x1, y1, zo], [x1, y0, zo], [x0, y0, zo]] })
  faces.push({ side, name: 'rear', n: [-1, 0, 0], tex: g.endTex?.quad ?? TEX.end, img: endImg, pts: [[x0, y1, zi], [x0, y1, zo], [x0, y0, zo], [x0, y0, zi]] })
  // 윗면(뚜껑): 카메라 고도(약 6도) 때문에 얇은 띠로 보인다. TL=뒤-안쪽, TR=앞-안쪽, BR=앞-바깥, BL=뒤-바깥
  faces.push({ side, name: 'top', n: [0, 1, 0], tex: TEX.top, pts: [[x0, y1, zi], [x1, y1, zi], [x1, y1, zo], [x0, y1, zo]] })
  faces.push({ side, name: 'front', n: [1, 0, 0], tex: g.endTex?.quad ?? TEX.end, img: endImg, pts: [[x1, y1, zi], [x1, y1, zo], [x1, y0, zo], [x1, y0, zi]] })
}
const visible = faces
  // 차체 뒤쪽 가방의 윗면은 짐받이 틈으로 검은 띠처럼만 보여(실제로는 연결 끈 덮개가 덮는 자리) 그리지 않는다 - 뒤에서 본 05만 예외.
  // hideSides: 이 사진에서 그리지 않을 가방(대표 사진처럼 거의 측면이라 반대쪽 가방이 차체에 완전히 가려지는 경우)
  .filter((fc) => !(cfg.hideSides ?? []).includes(fc.side))
  .filter((fc) => !(fc.name === 'top' && (cfg.behind ?? []).includes(fc.side) && !cfg.keepBehindTop))
  .filter((fc) => fc.n[0] * cam[0] + fc.n[1] * cam[1] + fc.n[2] * cam[2] > 0.02)
  .map((fc) => ({ ...fc, d: fc.pts.reduce((a, p) => a + depth(p), 0) / 4, q: fc.pts.map(proj) }))
  .sort((a, b2) => a.d - b2.d)

// 뒤에 있는(차체에 가려지는) 가방: 프레임이 불투명한 곳에는 그리지 않는다. behind = 이 각도에서 차체 뒤로 가는 쪽 가방(side 값 목록)
const behind = new Set(cfg.behind ?? [])
const frameAlpha = (x, y) => frame.d[(y * frame.w + x) * 4 + 3] / 255
for (const fc of visible) {
  const shade = fc.name === 'outer' ? 1 : fc.name === 'top' ? (cfg.topShade ?? 1) : (cfg.endShade ?? 0.85)
  warpOnto(out, fc.img ?? prod, fc.q, {
    srcQuad: fc.tex,
    brightness: shade,
    alphaMul: behind.has(fc.side) ? (x, y) => 1 - frameAlpha(x, y) : undefined,
  })
}
save(out, outPath)
const prev = { w: frame.w, h: frame.h, d: Buffer.from(frame.d) }
for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
  const i = (y * out.w + x) * 4
  if (out.d[i + 3]) overPx(prev, x, y, [out.d[i], out.d[i + 1], out.d[i + 2]], out.d[i + 3] / 255)
}
if (flag === '--wire') { // 상자 모서리(뒤축 원점, 바퀴 중심 확인용)
  const line = (p, q, col) => { const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1])); for (let i = 0; i <= n; i++) { const x = Math.round(p[0] + ((q[0] - p[0]) * i) / n), y = Math.round(p[1] + ((q[1] - p[1]) * i) / n); if (x >= 0 && y >= 0 && x < prev.w && y < prev.h) overPx(prev, x, y, col, 1) } }
  for (const side of [1, -1]) {
    const zs = [side * zin, side * zout]
    const c = side > 0 ? [0, 255, 0] : [255, 0, 255]
    for (const z of zs) { const r = [[x0, y1, z], [x1, y1, z], [x1, y0, z], [x0, y0, z]].map(proj); for (let i = 0; i < 4; i++) line(r[i], r[(i + 1) % 4], c) }
    for (const [X, Y] of [[x0, y1], [x1, y1], [x1, y0], [x0, y0]]) line(proj([X, Y, zs[0]]), proj([X, Y, zs[1]]), c)
  }
  line(proj([0, 0, 0]), proj([1230, 0, 0]), [255, 255, 0])
  line(proj([0, 0, -150]), proj([0, 0, 150]), [0, 255, 255])
}
save(prev, prevPath)
console.log(view, 'faces', visible.map((v) => `${v.side > 0 ? 'R' : 'L'}-${v.name}`).join(' '))
