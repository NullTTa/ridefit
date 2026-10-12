// 뒷바퀴 각도별 밝기 프로파일 -> 자기상관으로 스포크 주기(도) 추정. usage: node spokes.mjs frame cx cy rx ry r1 r2 a0 a1
import { load, frameP, sample } from './lib.mjs'
const [n, cx, cy, rx, ry, r1, r2, a0, a1] = process.argv.slice(2).map(Number)
const f = load(frameP(n))
const prof = []
for (let a = a0; a < a1; a += 0.5) {
  let s = 0, c = 0
  for (let t = r1; t <= r2; t += 0.02) {
    const x = cx + Math.cos((a * Math.PI) / 180) * rx * t, y = cy + Math.sin((a * Math.PI) / 180) * ry * t
    const p = sample(f, x, y); s += (p[0] + p[1] + p[2]) / 3; c++
  }
  prof.push(s / c)
}
const m = prof.reduce((a, b) => a + b) / prof.length
const z = prof.map((v) => v - m)
const res = []
for (let lag = 40; lag <= 240; lag++) { // 20..120도
  let s = 0
  for (let i = 0; i + lag < z.length; i++) s += z[i] * z[i + lag]
  res.push([lag / 2, s / (z.length - lag)])
}
res.sort((a, b) => b[1] - a[1])
console.log('best periods(deg):', res.slice(0, 8).map((r) => `${r[0]}:${r[1].toFixed(0)}`).join(' '))
console.log('profile', prof.filter((_, i) => i % 6 === 0).map((v) => Math.round(v)).join(','))
