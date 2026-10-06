import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MoveHorizontal, Pause, Play } from 'lucide-react'
import { Ico } from './Icon'

// 이미지 시퀀스 기반 360도 차량 뷰어. 실제 3D 모델/Three.js가 아니라 "각도별 사진을 순서대로
// 갈아끼우는" 방식이다. 프레임이 1장뿐이면(아직 여러 각도 사진이 없는 차종) 정지 이미지처럼
// 동작하고 드래그 안내도 보여주지 않는다 - 돌릴 수 없는데 "드래그해서 돌려보세요"라고 하지 않는다.
//
// 확장 경로(코드/구조만 열어둠, 이번 작업 범위 아님):
//   이미지 시퀀스 360도(지금) -> AI 실제 장착 모습 합성 -> 실제 3D 차량 모델 -> 3D FitRoom
// frames 배열의 장수만 늘리면(8 -> 12 -> 16 -> 24 -> 36) 이 컴포넌트는 그대로 동작한다.
//
// 자동 회전 한 프레임 전환에 걸리는 시간(ms). 8장 기준 한 바퀴에 약 7.2초 - 빠르게 휙휙 넘어가는
// 슬라이드쇼가 아니라 "천천히 돌려보는" 느낌을 목표로 한다.
const AUTO_ROTATE_INTERVAL_MS = 900
// 사용자가 드래그를 끝낸 뒤 자동 회전이 다시 시작되기까지의 유예 시간(ms).
const RESUME_DELAY_MS = 1200

// 투명 배경 PNG에서 차량이 차지하는 영역(0~1 비율). 불투명 이미지면 null(크기 보정을 하지 않는다).
// 같은 출처(/assets) 이미지만 쓰므로 canvas로 읽어도 tainted가 되지 않는다. 작은 크기로 줄여서 잰다.
function measureBounds(img) {
  const W = 240
  const H = Math.max(1, Math.round((W * img.naturalHeight) / img.naturalWidth))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, W, H)
  const data = ctx.getImageData(0, 0, W, H).data
  let x0 = W, y0 = H, x1 = -1, y1 = -1, transparent = false
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = data[(y * W + x) * 4 + 3]
      if (a < 250) transparent = true
      if (a > 24) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (!transparent || x1 < 0) return null
  return { x0: x0 / W, y0: y0 / H, x1: (x1 + 1) / W, y1: (y1 + 1) / H }
}

// 현재 프레임의 차량 높이/바닥선을 기준 이미지(위치 미리보기 사진)에 맞추는 transform.
// - 높이를 기준과 같게 맞추고(scale), 바닥(바퀴가 닿는 선)을 기준 바닥선에 맞춘다(translateY).
// - 좌우 중심은 프레임 그대로 둔다(정면/측면 프레임은 원래 폭이 달라야 자연스럽다).
// - 확대해도 이미지 밖으로 잘리지 않도록 배율 상한을 둔다. 결과적으로 위/아래는 기준 사진 범위를 넘지 않는다.
function normalizeTransform(cur, ref, box, natural) {
  if (!cur || !ref || !box.w || !box.h || !natural.w) return null
  // object-contain으로 실제 그려진 영역(레터박스 제외)
  const scale = Math.min(box.w / natural.w, box.h / natural.h)
  const dw = natural.w * scale
  const dh = natural.h * scale
  const offX = (box.w - dw) / 2
  const offY = (box.h - dh) / 2
  const curH = cur.y1 - cur.y0
  const refH = ref.y1 - ref.y0
  if (curH <= 0 || refH <= 0) return null
  const cx = (cur.x0 + cur.x1) / 2
  let s = refH / curH
  s = Math.min(s, 1.3, ref.y1 / curH, cx / Math.max(cx - cur.x0, 1e-6), (1 - cx) / Math.max(cur.x1 - cx, 1e-6))
  s = Math.max(s, 0.7)
  const originX = offX + cx * dw
  const originY = offY + cur.y1 * dh
  const ty = (ref.y1 - cur.y1) * dh
  if (Math.abs(s - 1) < 0.005 && Math.abs(ty) < 0.5) return null
  return {
    transformOrigin: `${originX}px ${originY}px`,
    transform: `translateY(${ty}px) scale(${s})`,
  }
}

// frames: 프레임 이미지 경로 배열(0도부터 순서대로). 최소 1장.
// startIndex: 처음 보여줄 프레임. 차종 대표 사진과 같은 각도의 프레임을 주면, "위치 미리보기"에서 360으로
//   넘어올 때 차량이 갑자기 정면(폭이 좁은 각도)으로 바뀌어 작아 보이지 않는다.
// normalizeTo: 기준 이미지 경로(위치 미리보기 사진). 주면 프레임마다 차량 높이/바닥선을 그 사진에 맞춘다 -
//   원본 프레임 세트마다 촬영 배율이 조금씩 달라 돌릴 때 커졌다 작아졌다 하는 것을 막는다. 이미지 파일은 그대로다.
// pxPerFrame: 프레임 하나 넘어가는 데 필요한 드래그 픽셀 거리(작을수록 민감).
// showControls: 재생/멈춤 버튼과 드래그 안내 문구 표시 여부 - 차고 카드처럼 작은 썸네일에서는
//   버튼이 화면을 가리므로 false로 끄고, 자동 회전 자체는 그대로 동작한다.
// layers: 장착한 부품 레이어 [{ key, frames }] - frames[i]는 i번째 차량 프레임과 같은 캔버스 크기의 투명 PNG(null = 그 각도에선
//   안 보임). 차량 프레임과 같은 index, 같은 보정(transform), 같은 object-contain 박스로 겹쳐서 각도가 절대 어긋나지 않는다.
// fillScale: 차량+부품 레이어를 박스 가운데 기준으로 줄이는 비율(0~1, 기본 1). 대표 사진이 차량에 딱 맞게 잘린 차종은
//   차량이 박스를 꽉 채워 확대돼 보이므로 위치 미리보기(VehicleFitStage)와 같은 getStageScale 값을 넘긴다. 버튼/안내 문구는 줄이지 않는다.
function Vehicle360Viewer({
  frames,
  alt = '차량',
  className = '',
  style,
  pxPerFrame = 12,
  showControls = true,
  startIndex = 0,
  normalizeTo,
  layers = [],
  fillScale = 1,
}) {
  const [index, setIndex] = useState(() => (Number.isInteger(startIndex) && startIndex >= 0 ? startIndex : 0))
  // 프레임(및 기준 이미지)별 차량 영역. normalizeTo가 있을 때만 잰다.
  const [bounds, setBounds] = useState({})
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const imgRef = useRef(null)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [failedFrames, setFailedFrames] = useState(() => new Set())
  // autoRotate: 재생/멈춤 버튼으로 사용자가 직접 켜고 끄는 상태(기본 재생).
  // suspended: 드래그 중이거나 드래그 직후 유예 시간 동안 자동 회전을 잠깐 멈추는 내부 상태 -
  //   버튼 상태(autoRotate)와는 별개라, 드래그가 끝나면 버튼을 다시 누르지 않아도 회전이 이어진다.
  const [autoRotate, setAutoRotate] = useState(true)
  const [suspended, setSuspended] = useState(false)
  const dragState = useRef(null) // { pointerId, startX, lastX, moved }
  const resumeTimerRef = useRef(null)

  const validFrames = Array.isArray(frames) ? frames.filter(Boolean) : []
  const frameCount = validFrames.length
  const interactive = frameCount > 1

  // 자동 회전 타이머 - 재생 중이고, 드래그 유예 상태가 아닐 때만 돈다.
  useEffect(() => {
    if (!interactive || !autoRotate || suspended) return
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % frameCount)
    }, AUTO_ROTATE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [interactive, autoRotate, suspended, frameCount])

  useEffect(() => () => clearTimeout(resumeTimerRef.current), [])

  // 프레임을 미리 브라우저 캐시에 올려둔다 - 드래그 중 매 프레임마다 새로 네트워크 요청이 나가서
  // 끊겨 보이는 것을 막는다. 실패한 프레임은 failedFrames에 기록해 폴백 처리한다.
  useEffect(() => {
    if (!interactive) return
    let cancelled = false
    const measure = (src, img) => {
      if (!normalizeTo || cancelled) return
      let b = null
      try {
        b = measureBounds(img)
      } catch {
        b = null
      }
      setBounds((prev) => ({ ...prev, [src]: b }))
    }
    validFrames.forEach((src, i) => {
      const img = new Image()
      img.onload = () => measure(src, img)
      img.onerror = () => {
        if (!cancelled) setFailedFrames((prev) => new Set(prev).add(i))
      }
      img.src = src
    })
    if (normalizeTo) {
      const ref = new Image()
      ref.onload = () => measure(normalizeTo, ref)
      ref.src = normalizeTo
    }
    // 부품 레이어도 미리 받아둔다 - 회전 중 매 프레임마다 내려받느라 깜빡이지 않게.
    layers.forEach((layer) => layer.frames.forEach((src) => {
      if (src) new Image().src = src
    }))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validFrames.join('|'), normalizeTo, layers.map((l) => l.frames.join(',')).join('|')])

  // 크기 보정 계산에 필요한 <img> 박스 크기 - 화면 크기가 바뀌면 다시 잰다.
  useLayoutEffect(() => {
    const el = imgRef.current
    if (!normalizeTo || !el || typeof ResizeObserver === 'undefined') return
    const update = () => setBox({ w: el.offsetWidth, h: el.offsetHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [normalizeTo, frameCount])

  if (frameCount === 0) return null

  // 특정 각도 이미지가 로드 실패하면 가장 가까운 성공한 프레임으로 대신한다(전부 실패하면 원래 인덱스 유지 - <img>의
  // 자체 onError가 최종 폴백을 처리).
  const resolveIndex = (i) => {
    if (!failedFrames.has(i)) return i
    for (let step = 1; step < frameCount; step++) {
      const forward = (i + step) % frameCount
      if (!failedFrames.has(forward)) return forward
      const backward = (i - step + frameCount) % frameCount
      if (!failedFrames.has(backward)) return backward
    }
    return i
  }

  const currentIndex = resolveIndex(index)
  const currentSrc = validFrames[currentIndex]
  const normalizeStyle = normalizeTo ? normalizeTransform(bounds[currentSrc], bounds[normalizeTo], box, natural) : null

  const handlePointerDown = (e) => {
    if (!interactive) return
    // 재생/멈춤 버튼 위에서는 드래그를 시작하지 않는다 - 여기서 포인터를 캡처하면 click이 버튼 대신 이 div로 가서 버튼이 안 눌린다.
    if (e.target.closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = { pointerId: e.pointerId, startX: e.clientX, lastX: e.clientX, moved: false }
    clearTimeout(resumeTimerRef.current)
    setSuspended(true)
  }

  const handlePointerMove = (e) => {
    const drag = dragState.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const deltaFromLast = e.clientX - drag.lastX
    if (Math.abs(deltaFromLast) < pxPerFrame) return

    const framesToAdvance = Math.trunc(deltaFromLast / pxPerFrame)
    // 오른쪽으로 드래그 -> 프레임 순서 진행(01->02->...), 왼쪽으로 드래그 -> 역순.
    // 아무리 빠르게 드래그해도 인덱스는 항상 0~frameCount-1 사이로 순환한다 - 깨지지 않는다.
    setIndex((prev) => ((prev + framesToAdvance) % frameCount + frameCount) % frameCount)
    drag.lastX += framesToAdvance * pxPerFrame
    drag.moved = true
    if (!hasInteracted) setHasInteracted(true)
  }

  const endDrag = (e) => {
    if (dragState.current?.pointerId === e.pointerId) dragState.current = null
    clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => setSuspended(false), RESUME_DELAY_MS)
  }

  return (
    <div
      // 실제 촬영 사진은 전부 흰 배경(투명 아님) - 부품 카드 썸네일과 같은 방식으로 흰 바탕 타일 위에
      // 얹어서 다크 테마 카드 안에서도 자연스럽게 보이게 한다(레터박스 여백도 이 흰 배경과 자연히 섞인다).
      className={`relative touch-pan-y select-none overflow-hidden rounded-lg bg-white ${
        interactive ? 'cursor-grab active:cursor-grabbing' : ''
      } ${className}`}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
      data-testid="vehicle-360-viewer"
      data-frame-count={frameCount}
    >
      <div
        className="relative h-full w-full"
        style={fillScale < 1 ? { transform: `scale(${fillScale})` } : undefined}
        data-testid="vehicle-360-stage"
      >
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        draggable={false}
        className="h-full w-full select-none object-contain"
        style={normalizeStyle ?? undefined}
        data-frame-index={currentIndex}
        onLoad={(e) => {
          const { naturalWidth: w, naturalHeight: h } = e.currentTarget
          if (w !== natural.w || h !== natural.h) setNatural({ w, h })
        }}
        onError={() => setFailedFrames((prev) => new Set(prev).add(currentIndex))}
      />
      {/* 부품 레이어: 각도별 8장을 모두 올려두고 현재 각도만 보이게 한다(src를 바꾸면 회전 첫 바퀴에 새 이미지를
          받는 동안 부품이 잠깐 사라지므로). 차량 프레임과 같은 currentIndex/보정 style을 쓴다. */}
      {layers.map((layer) =>
        layer.frames.map((src, i) =>
          src ? (
            <img
              key={`${layer.key}-${i}`}
              src={src}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
              style={{ ...(normalizeStyle ?? {}), visibility: i === currentIndex ? 'visible' : 'hidden' }}
              data-testid={i === currentIndex ? `vehicle-360-layer-${layer.key}` : undefined}
              data-frame-index={i}
            />
          ) : null,
        ),
      )}
      </div>
      {interactive && showControls && !hasInteracted && (
        <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-ridefit-border bg-ridefit-bg/85 px-3 py-1 text-xs text-ridefit-text-secondary backdrop-blur">
          <Ico as={MoveHorizontal} className="mr-1" />드래그해서 차량을 돌려보세요
        </span>
      )}
      {interactive && showControls && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setAutoRotate((prev) => !prev)
          }}
          aria-label={autoRotate ? '자동 회전 멈추기' : '자동 회전 재생하기'}
          aria-pressed={autoRotate}
          data-testid="vehicle-360-toggle"
          className={`absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur transition ${
            autoRotate
              ? 'border-ridefit-primary bg-ridefit-primary text-white hover:brightness-110'
              : 'border-ridefit-border bg-ridefit-bg/85 text-ridefit-text-secondary hover:border-ridefit-primary hover:text-ridefit-primary'
          }`}
        >
          {autoRotate ? <Pause aria-hidden="true" className="h-3.5 w-3.5" /> : <Play aria-hidden="true" className="h-3.5 w-3.5" />}
          {autoRotate ? '자동 회전' : '멈춤'}
        </button>
      )}
    </div>
  )
}

export default Vehicle360Viewer
