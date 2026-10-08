import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// 전체 화면 보기 틀: 어두운 배경 + 닫기 버튼. 배경 클릭/Esc/닫기 버튼으로 닫고, 열려 있는 동안 페이지 스크롤을 막는다.
export function Lightbox({ label, onClose, children, footer, testid }) {
  const ref = useRef(null)
  // onClose가 렌더마다 새 함수여도 키 리스너/포커스/스크롤 잠금은 열 때 한 번만 건다.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current()
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [])

  return createPortal(
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-black/90 p-2 outline-none sm:p-6"
      onClick={onClose}
      data-testid={testid}
    >
      {children}
      <div className="flex max-w-3xl flex-wrap items-center justify-center gap-2 text-center" onClick={(e) => e.stopPropagation()}>
        {footer}
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-white/25"
          data-testid="lightbox-close"
        >
          <X aria-hidden="true" className="h-4 w-4" />닫기
        </button>
      </div>
    </div>,
    document.body,
  )
}

// 이미지 크게 보기 - 썸네일이 아니라 저장된 원본 결과 이미지(src)를 그대로 쓴다(재압축/리사이즈 없음).
//  - 화면 맞춤(기본): 화면 안에서 비율을 지키며 표시하되 원본 픽셀보다 크게 늘리지 않는다(늘리면 흐려진다).
//  - 원본 크기: 원본이 화면보다 크면 1:1 픽셀로 보고 스크롤로 이동한다.
//  - 화면 가득: 원본이 화면보다 작을 때만 - 늘려서 보되 원본 해상도 한계로 흐려질 수 있다고 알린다.
export function ImageLightbox({ src, alt, title, onClose, testid = 'image-lightbox' }) {
  const [mode, setMode] = useState('fit')
  const [natural, setNatural] = useState(null)
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // 화면 맞춤 영역(여백/아래 버튼 줄 제외) 안에 원본이 다 들어가는지
  const areaW = view.w - (view.w >= 640 ? 48 : 16)
  const areaH = view.h - 144
  const fitsOnScreen = natural ? natural.w <= areaW && natural.h <= areaH : true
  const styleByMode = {
    fit: { maxWidth: natural ? `min(100%, ${natural.w}px)` : '100%', maxHeight: `${areaH}px`, width: 'auto', height: 'auto' },
    fill: { width: '100%', height: `${areaH}px`, objectFit: 'contain' },
    actual: natural ? { width: `${natural.w}px`, height: `${natural.h}px`, maxWidth: 'none' } : {},
  }

  const modeButton = (value, text) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        mode === value ? 'bg-white text-black' : 'bg-white/15 text-white hover:bg-white/25'
      }`}
      data-testid={`lightbox-mode-${value}`}
    >
      {text}
    </button>
  )

  return (
    <Lightbox
      label={`${title ?? alt} 크게 보기`}
      onClose={onClose}
      testid={testid}
      footer={
        <>
          {title && <p className="w-full text-xs text-white/80">{title}</p>}
          {natural && (
            <p className="w-full text-[11px] text-white/60" data-testid="lightbox-resolution">
              원본 {natural.w}×{natural.h}
              {fitsOnScreen && mode !== 'fill' ? ' · 원본 크기 그대로 표시 중' : ''}
              {mode === 'fill' ? ' · 원본보다 크게 늘려 보는 중이라 흐려질 수 있어요' : ''}
            </p>
          )}
          {modeButton('fit', '화면 맞춤')}
          {natural && !fitsOnScreen && modeButton('actual', '원본 크기(1:1)')}
          {natural && fitsOnScreen && modeButton('fill', '화면 가득')}
        </>
      }
    >
      <div
        className={`max-w-full ${mode === 'actual' ? 'overflow-auto' : 'flex items-center justify-center'}`}
        style={mode === 'actual' ? { maxHeight: `${areaH}px`, width: '100%' } : { width: mode === 'fill' ? '100%' : undefined }}
        onClick={(e) => e.stopPropagation()}
        data-testid="lightbox-scroll"
      >
        <img
          src={src}
          alt={alt}
          // 투명 배경 결과(직접 합성)도 뒤 페이지가 비치지 않게 위치 미리보기 무대와 같은 단색 바탕을 깐다.
          className="block rounded-lg bg-ridefit-card"
          style={styleByMode[mode]}
          onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          data-testid="lightbox-image"
        />
      </div>
    </Lightbox>
  )
}
