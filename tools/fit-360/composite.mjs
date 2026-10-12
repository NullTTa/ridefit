// 360 뷰어와 같은 순서로 합성: under 레이어 -> (마스크 교집합을 건) 차량 프레임 -> over 레이어.
// usage: node composite.mjs <frame> <out.png> under=a.png,b.png mask=m1.png,m2.png over=c.png,d.png
import { load, blank, save, frameP, overPx } from './lib.mjs'
const [n, outPath, ...rest] = process.argv.slice(2)
const arg = (k) => (rest.find((r) => r.startsWith(k + '='))?.slice(k.length + 1) || '').split(',').filter(Boolean)
const frame = load(frameP(+n))
const out = blank(frame.w, frame.h)
const put = (img, mul) => {
  for (let i = 0; i < img.d.length; i += 4) {
    const a = (img.d[i + 3] / 255) * (mul ? mul[i / 4] : 1)
    if (a > 0) overPx(out, (i / 4) % img.w, Math.floor(i / 4 / img.w), [img.d[i], img.d[i + 1], img.d[i + 2]], a)
  }
}
for (const p of arg('under')) put(load(p))
const masks = arg('mask').map(load)
const mul = new Float32Array(frame.w * frame.h).fill(1)
for (const m of masks) for (let i = 0; i < mul.length; i++) mul[i] *= m.d[i * 4 + 3] / 255
put(frame, mul)
for (const p of arg('over')) put(load(p))
save(out, outPath)
console.log('ok', outPath)
