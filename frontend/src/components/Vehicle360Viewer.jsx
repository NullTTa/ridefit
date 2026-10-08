import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Maximize2, MoveHorizontal, Pause, Play, X } from 'lucide-react'
import { cssMaskStyle } from '../constants/vehicleFitPositions'
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
// transform-origin을 px로 계산하므로 같은 프레임이라도 무대(작은 화면/큰 화면) 크기마다 따로 계산한다.
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

// 차량 프레임 + 부품 레이어를 그리는 무대 하나(작은 뷰어/큰 화면이 같은 상태로 각자 하나씩 그린다).
// 프레임과 레이어는 각도별 이미지를 모두 겹쳐 두고 현재 각도만 보이게 한다 - src나 마스크 URL을 바꾸면 처음 한 바퀴 동안
// 새 이미지를 받는 사이 잠깐 비거나(부품 사라짐) 마스크가 늦게 걸려 순정 휠이 비칠 수 있어서다(각 프레임의 마스크는 고정).
function ViewerStage({ frames, currentIndex, alt, layers, bounds, normalizeTo, natural, onNatural, onFrameError, fillScale, testid }) {
  const sizerRef = useRef(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  // 크기 보정 계산에 필요한 무대 박스 크기 - 화면 크기가 바뀌면 다시 잰다.
  useLayoutEffect(() => {
    const el = sizerRef.current
    if (!normalizeTo || !el || typeof ResizeObserver === 'undefined') return
    const update = () => setBox({ w: el.offsetWidth, h: el.offsetHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [normalizeTo])

  const styleOf = (i) => (normalizeTo ? normalizeTransform(bounds[frames[i]], bounds[normalizeTo], box, natural) : null)
  const layerImgs = (list) =>
    list.map((layer) =>
      layer.frames.map((src, i) =>
        src ? (
          <img
            key={`${layer.key}-${i}`}
            src={src}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
            style={{ ...(styleOf(i) ?? {}), visibility: i === currentIndex ? 'visible' : 'hidden' }}
            data-testid={i === currentIndex ? `vehicle-360-layer-${layer.key}` : undefined}
            data-frame-index={i}
          />
        ) : null,
      ),
    )

  return (
    <div
      className="relative h-full w-full"
      style={fillScale < 1 ? { transform: `scale(${fillScale})` } : undefined}
      data-testid={testid}
    >
      {/* 크기 기준(보이지 않음): 부모에 높이가 없을 때도 예전처럼 사진 비율로 높이가 잡히게 한다. */}
      <img ref={sizerRef} src={frames[0]} alt="" aria-hidden="true" draggable={false} className="invisible h-full w-full object-contain" />
      {/* 아래 깔리는 부품(휠): 차량 프레임보다 먼저 그린다. 차량 프레임에는 같은 각도의 마스크가 걸려 순정 휠 자리만 비어 있다. */}
      {layerImgs(layers.filter((l) => l.under))}
      {frames.map((src, i) => {
        const masks = layers.map((l) => l.masks?.[i]).filter(Boolean)
        const current = i === currentIndex
        return (
          <img
            key={src}
            src={src}
            alt={current ? alt : ''}
            aria-hidden={current ? undefined : 'true'}
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-contain"
            style={{ ...(styleOf(i) ?? {}), ...(cssMaskStyle(masks) ?? {}), visibility: current ? 'visible' : 'hidden' }}
            data-frame-index={i}
            data-current={current ? 'true' : undefined}
            data-masked={masks.length > 0 ? 'true' : undefined}
            onLoad={(e) => onNatural(e.currentTarget)}
            onError={() => onFrameError(i)}
          />
        )
      })}
      {/* 부품 레이어(앞바구니 등): 차량 프레임 위. 차량 프레임과 같은 각도/보정 style을 쓴다. */}
      {layerImgs(layers.filter((l) => !l.under))}
    </div>
  )
}

// frames: 프레임 이미지 경로 배열(0도부터 순서대로). 최소 1장.
// startIndex: 처음 보여줄 프레임. 차종 대표 사진과 같은 각도의 프레임을 주면, "위치 미리보기"에서 360으로
//   넘어올 때 차량이 갑자기 정면(폭이 좁은 각도)으로 바뀌어 작아 보이지 않는다.
// normalizeTo: 기준 이미지 경로(위치 미리보기 사진). 주면 프레임마다 차량 높이/바닥선을 그 사진에 맞춘다 -
//   원본 프레임 세트마다 촬영 배율이 조금씩 달라 돌릴 때 커졌다 작아졌다 하는 것을 막는다. 이미지 파일은 그대로다.
// pxPerFrame: 프레임 하나 넘어가는 데 필요한 드래그 픽셀 거리(작을수록 민감). 큰 화면에서는 무대 폭에 맞춰 늘린다.
// showControls: 재생/멈춤 버튼과 드래그 안내 문구 표시 여부 - 차고 카드처럼 작은 썸네일에서는
//   버튼이 화면을 가리므로 false로 끄고, 자동 회전 자체는 그대로 동작한다.
// layers: 장착한 부품 레이어 [{ key, frames, masks?, under? }] - frames[i]는 i번째 차량 프레임과 같은 캔버스 크기의 투명 PNG
//   (null = 그 각도에선 안 보임). 차량 프레임과 같은 index, 같은 보정(transform), 같은 object-contain 박스로 겹쳐서 각도가 절대
//   어긋나지 않는다. under = 차량 프레임 아래에 깐다(휠), masks[i] = i번째 차량 프레임에 거는 알파 마스크(순정 휠 자리를 비움).
// fillScale: 차량+부품 레이어를 박스 가운데 기준으로 줄이는 비율(0~1, 기본 1). 대표 사진이 차량에 딱 맞게 잘린 차종은
//   차량이 박스를 꽉 채워 확대돼 보이므로 위치 미리보기(VehicleFitStage)와 같은 getStageScale 값을 넘긴다. 버튼/안내 문구는 줄이지 않는다.
// expandable: "크게 보기" 버튼 - 같은 각도/재생 상태를 이어받는 전체 화면 보기(원본 프레임 그대로, 원본보다 크게 늘리지 않는 폭까지).
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
  expandable = false,
}) {
  const [index, setIndex] = useState(() => (Number.isInteger(startIndex) && startIndex >= 0 ? startIndex : 0))
  // 프레임(및 기준 이미지)별 차량 영역. normalizeTo가 있을 때만 잰다.
  const [bounds, setBounds] = useState({})
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [hasInteracted, setHasInteracted] = useState(false)
  const [failedFrames, setFailedFrames] = useState(() => new Set())
  // autoRotate: 재생/멈춤 버튼으로 사용자가 직접 켜고 끄는 상태(기본 재생).
  // suspended: 드래그 중이거나 드래그 직후 유예 시간 동안 자동 회전을 잠깐 멈추는 내부 상태 -
  //   버튼 상태(autoRotate)와는 별개라, 드래그가 끝나면 버튼을 다시 누르지 않아도 회전이 이어진다.
  const [autoRotate, setAutoRotate] = useState(true)
  const [suspended, setSuspended] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const dragState = useRef(null) // { pointerId, lastX, step }
  const resumeTimerRef = useRef(null)
  const bigRef = useRef(null)

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

  // 프레임/기준 이미지를 미리 받아 크기 보정용 차량 영역을 잰다. 실패한 프레임은 failedFrames에 기록해 폴백 처리한다.
  // 레이어/마스크는 무대에 모든 각도가 이미 올라가 있어(보이지 않을 뿐) 따로 받을 필요가 없다.
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
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validFrames.join('|'), normalizeTo])

  const step = (delta) => {
    if (!interactive) return
    setIndex((prev) => (((prev + delta) % frameCount) + frameCount) % frameCount)
    setHasInteracted(true)
    // 버튼/키로 한 칸씩 돌릴 때도 드래그처럼 잠깐 자동 회전을 멈췄다가 이어간다.
    clearTimeout(resumeTimerRef.current)
    setSuspended(true)
    resumeTimerRef.current = setTimeout(() => setSuspended(false), RESUME_DELAY_MS * 2)
  }

  // 큰 화면: Esc 닫기, ←/→ 회전, 스페이스 재생/멈춤. 열려 있는 동안 페이지 스크롤을 막는다.
  useEffect(() => {
    if (!expanded) return
    const onKey = (e) => {
      if (e.key === 'Escape') setExpanded(false)
      else if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === ' ') {
        e.preventDefault()
        setAutoRotate((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    bigRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded])

  if (frameCount === 0) return null

  // 특정 각도 이미지가 로드 실패하면 가장 가까운 성공한 프레임으로 대신한다(전부 실패하면 원래 인덱스 유지).
  const resolveIndex = (i) => {
    if (!failedFrames.has(i)) return i
    for (let s = 1; s < frameCount; s++) {
      const forward = (i + s) % frameCount
      if (!failedFrames.has(forward)) return forward
      const backward = (i - s + frameCount) % frameCount
      if (!failedFrames.has(backward)) return backward
    }
    return i
  }
  const currentIndex = resolveIndex(index)

  const onNatural = (img) => {
    const { naturalWidth: w, naturalHeight: h } = img
    setNatural((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
  }
  const onFrameError = (i) => setFailedFrames((prev) => (prev.has(i) ? prev : new Set(prev).add(i)))

  const endDrag = (e) => {
    if (dragState.current?.pointerId === e.pointerId) dragState.current = null
    clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => setSuspended(false), RESUME_DELAY_MS)
  }

  // 드래그: 같은 핸들러를 작은 뷰어/큰 화면이 같이 쓴다. pxPerFrame은 그 무대의 감도.
  const pointerHandlers = (perFrame) => ({
    onPointerDown: (e) => {
      if (!interactive) return
      // 버튼 위에서는 드래그를 시작하지 않는다 - 여기서 포인터를 캡처하면 click이 버튼 대신 이 div로 가서 버튼이 안 눌린다.
      if (e.target.closest('button')) return
      e.currentTarget.setPointerCapture(e.pointerId)
      dragState.current = { pointerId: e.pointerId, lastX: e.clientX, perFrame }
      clearTimeout(resumeTimerRef.current)
      setSuspended(true)
    },
    onPointerMove: (e) => {
      const drag = dragState.current
      if (!drag || drag.pointerId !== e.pointerId) return
      const deltaFromLast = e.clientX - drag.lastX
      if (Math.abs(deltaFromLast) < drag.perFrame) return
      const framesToAdvance = Math.trunc(deltaFromLast / drag.perFrame)
      // 오른쪽으로 드래그 -> 프레임 순서 진행(01->02->...), 왼쪽으로 드래그 -> 역순.
      // 아무리 빠르게 드래그해도 인덱스는 항상 0~frameCount-1 사이로 순환한다 - 깨지지 않는다.
      setIndex((prev) => (((prev + framesToAdvance) % frameCount) + frameCount) % frameCount)
      drag.lastX += framesToAdvance * drag.perFrame
      if (!hasInteracted) setHasInteracted(true)
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onPointerLeave: endDrag,
  })
  const stageProps = {
    frames: validFrames,
    currentIndex,
    alt,
    layers,
    bounds,
    normalizeTo,
    natural,
    onNatural,
    onFrameError,
    fillScale,
  }

  const toggleButton = (extra = '') => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setAutoRotate((prev) => !prev)
      }}
      aria-label={autoRotate ? '자동 회전 멈추기' : '자동 회전 재생하기'}
      aria-pressed={autoRotate}
      data-testid="vehicle-360-toggle"
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur transition ${extra} ${
        autoRotate
          ? 'border-ridefit-primary bg-ridefit-primary text-white hover:brightness-110'
          : 'border-ridefit-border bg-ridefit-bg/85 text-ridefit-text-secondary hover:border-ridefit-primary hover:text-ridefit-primary'
      }`}
    >
      {autoRotate ? <Pause aria-hidden="true" className="h-3.5 w-3.5" /> : <Play aria-hidden="true" className="h-3.5 w-3.5" />}
      {autoRotate ? '자동 회전' : '멈춤'}
    </button>
  )

  // 큰 화면 무대 폭: 화면 안(세로 여유 포함)에서 비율을 지키며 가장 크게, 단 프레임 원본 폭 / fillScale 을 넘지 않게
  // (그보다 크면 원본 픽셀을 늘려 흐려진다). 비율은 작은 뷰어와 같은 style.aspectRatio, 없으면 프레임 원본 비율.
  const aspect = Number(style?.aspectRatio) || (natural.w && natural.h ? natural.w / natural.h : 2)
  const bigMaxWidth = natural.w ? Math.round(natural.w / (fillScale || 1)) : 1600

  return (
    <>
      <div
        // 실제 촬영 사진은 전부 흰 배경(투명 아님) - 부품 카드 썸네일과 같은 방식으로 흰 바탕 타일 위에
        // 얹어서 다크 테마 카드 안에서도 자연스럽게 보이게 한다(레터박스 여백도 이 흰 배경과 자연히 섞인다).
        className={`relative touch-pan-y select-none overflow-hidden rounded-lg bg-white ${
          interactive ? 'cursor-grab active:cursor-grabbing' : ''
        } ${className}`}
        style={style}
        {...pointerHandlers(pxPerFrame)}
        data-testid="vehicle-360-viewer"
        data-frame-count={frameCount}
        data-current-index={currentIndex}
      >
        <ViewerStage {...stageProps} testid="vehicle-360-stage" />
        {interactive && showControls && !hasInteracted && (
          <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-ridefit-border bg-ridefit-bg/85 px-3 py-1 text-xs text-ridefit-text-secondary backdrop-blur">
            <Ico as={MoveHorizontal} className="mr-1" />드래그해서 차량을 돌려보세요
          </span>
        )}
        {interactive && showControls && toggleButton('absolute bottom-2 right-2')}
        {expandable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(true)
            }}
            aria-label="360° 크게 보기"
            title="크게 보기"
            data-testid="vehicle-360-expand"
            className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-ridefit-border bg-ridefit-bg/85 px-2.5 py-1.5 text-xs font-medium text-ridefit-text shadow-lg backdrop-blur transition hover:border-ridefit-primary hover:text-ridefit-primary"
          >
            <Maximize2 aria-hidden="true" className="h-3.5 w-3.5" />크게 보기
          </button>
        )}
      </div>

      {expanded &&
        createPortal(
          <div
            ref={bigRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="360° 크게 보기"
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-black/90 p-2 outline-none sm:p-6"
            onClick={() => setExpanded(false)}
            data-testid="vehicle-360-lightbox"
          >
            <div
              className={`relative touch-pan-y select-none overflow-hidden rounded-lg bg-white ${interactive ? 'cursor-grab active:cursor-grabbing' : ''}`}
              style={{ aspectRatio: aspect, width: `min(100%, calc((100vh - 8.5rem) * ${aspect}), ${bigMaxWidth}px)` }}
              onClick={(e) => e.stopPropagation()}
              {...pointerHandlers(Math.max(pxPerFrame, 24))}
              data-testid="vehicle-360-viewer-large"
              data-current-index={currentIndex}
            >
              <ViewerStage {...stageProps} testid="vehicle-360-stage-large" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
              {interactive && (
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="왼쪽으로 돌리기"
                  data-testid="vehicle-360-prev"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                >
                  <ChevronLeft aria-hidden="true" className="h-5 w-5" />
                </button>
              )}
              {interactive && toggleButton()}
              {interactive && (
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="오른쪽으로 돌리기"
                  data-testid="vehicle-360-next"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                >
                  <ChevronRight aria-hidden="true" className="h-5 w-5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="flex items-center gap-1 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-white/25"
                data-testid="vehicle-360-close"
              >
                <X aria-hidden="true" className="h-4 w-4" />닫기
              </button>
            </div>
            <p className="text-center text-[11px] text-white/60" onClick={(e) => e.stopPropagation()}>
              {interactive ? '드래그 또는 ←/→ 키로 돌려보세요 · 스페이스 재생/멈춤 · Esc 닫기' : 'Esc 닫기'}
              {natural.w ? ` · 원본 프레임 ${natural.w}×${natural.h}` : ''}
            </p>
          </div>,
          document.body,
        )}
    </>
  )
}

export default Vehicle360Viewer
