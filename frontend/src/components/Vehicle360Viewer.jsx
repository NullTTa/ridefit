import { useEffect, useRef, useState } from 'react'

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

// frames: 프레임 이미지 경로 배열(0도부터 순서대로). 최소 1장.
// pxPerFrame: 프레임 하나 넘어가는 데 필요한 드래그 픽셀 거리(작을수록 민감).
// showControls: 재생/멈춤 버튼과 드래그 안내 문구 표시 여부 - 차고 카드처럼 작은 썸네일에서는
//   버튼이 화면을 가리므로 false로 끄고, 자동 회전 자체는 그대로 동작한다.
function Vehicle360Viewer({ frames, alt = '차량', className = '', style, pxPerFrame = 12, showControls = true }) {
  const [index, setIndex] = useState(0)
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
    validFrames.forEach((src, i) => {
      const img = new Image()
      img.onerror = () => {
        if (!cancelled) setFailedFrames((prev) => new Set(prev).add(i))
      }
      img.src = src
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validFrames.join('|')])

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

  const handlePointerDown = (e) => {
    if (!interactive) return
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
      <img
        src={currentSrc}
        alt={alt}
        draggable={false}
        className="h-full w-full select-none object-contain"
        onError={() => setFailedFrames((prev) => new Set(prev).add(currentIndex))}
      />
      {interactive && showControls && !hasInteracted && (
        <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-ridefit-border bg-ridefit-bg/85 px-3 py-1 text-xs text-ridefit-text-secondary backdrop-blur">
          ↔ 드래그해서 차량을 돌려보세요
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
          <span aria-hidden="true">{autoRotate ? '❚❚' : '▶'}</span>
          {autoRotate ? '자동 회전' : '멈춤'}
        </button>
      )}
    </div>
  )
}

export default Vehicle360Viewer
