import { VEHICLE_PLACEHOLDER_IMAGE } from '../constants/images'
import { CATEGORY_POSITION, DEFAULT_POSITION, getFitLayout, getPartOverlays } from '../constants/vehicleFitPositions'

const pct = (value, total) => `${(value / total) * 100}%`

// 차량 사진 + "장착된 부품" 표시. FitRoom과 PartsSearch가 같이 쓴다.
//  - 차량 전용 레이아웃이 있으면(예: Super Cub 110 대표 사진): 사진과 같은 종횡비의 무대 위에
//    부품의 투명 배경 이미지를 실제 위치에 얹는다. 오버레이 이미지가 없는 부품은 배지로 대신한다.
//  - 없으면(임시 아이콘/사용자 사진): 예전처럼 4:3 박스에 카테고리 배지만 표시한다.
// parts: 지금 장착 중인 부품 배열, conflictPartIds: 충돌 중인 partId Set(빨간 윤곽/배지).
function VehicleFitStage({ vehicle, parts, conflictPartIds }) {
  const layout = getFitLayout(vehicle)
  const imageSrc = vehicle?.photoUrl || vehicle?.modelImageUrl || VEHICLE_PLACEHOLDER_IMAGE
  const alt = vehicle?.modelYearLabel ?? '차량'
  const isConflict = (part) => conflictPartIds?.has(part.partId) ?? false

  const badge = (part, style) => (
    <div
      key={`badge-${part.partId}`}
      className="absolute z-40 -translate-x-1/2 -translate-y-1/2 animate-fadeIn"
      style={style}
      title={part.name}
      data-testid={`fit-badge-${part.partId}`}
    >
      <span
        className={`block whitespace-nowrap rounded-full border px-2 py-1 text-xs font-semibold shadow-lg backdrop-blur ${
          isConflict(part)
            ? 'border-ridefit-danger-border bg-ridefit-danger-bg text-ridefit-danger'
            : 'border-ridefit-primary bg-ridefit-bg/90 text-ridefit-primary'
        }`}
      >
        {part.category}
        {isConflict(part) ? ' · 충돌' : ''}
      </span>
    </div>
  )

  if (!layout) {
    return (
      <div className="relative mx-auto aspect-[4/3] w-full max-w-lg">
        <img src={imageSrc} alt={alt} className="h-full w-full object-contain" />
        {parts.map((part) => badge(part, CATEGORY_POSITION[part.category] ?? DEFAULT_POSITION))}
      </div>
    )
  }

  return (
    <div
      className="relative mx-auto w-full max-w-2xl"
      style={{ aspectRatio: `${layout.width} / ${layout.height}` }}
      data-testid="fit-stage"
    >
      <img src={imageSrc} alt={alt} className="absolute inset-0 h-full w-full select-none" draggable={false} />

      {parts.map((part) => {
        const overlays = getPartOverlays(part, layout)
        if (overlays.length === 0) {
          const anchor = layout.anchors?.[part.category]
          return badge(
            part,
            anchor
              ? { left: pct(anchor.x, layout.width), top: pct(anchor.y, layout.height) }
              : CATEGORY_POSITION[part.category] ?? DEFAULT_POSITION,
          )
        }
        return overlays.map((o, i) => (
          <img
            key={`${part.partId}-${i}`}
            src={o.src}
            alt={part.name}
            title={part.name}
            draggable={false}
            data-testid={`fit-overlay-${part.partId}`}
            className="pointer-events-none absolute animate-fadeIn select-none"
            style={{
              left: pct(o.x, layout.width),
              top: pct(o.y, layout.height),
              width: pct(o.width, layout.width),
              height: 'auto',
              zIndex: o.z ?? 10,
              transform: `translate(-50%, -50%) rotate(${o.rotate ?? 0}deg) scaleX(${o.flipX ? -1 : 1})`,
              filter: isConflict(part)
                ? 'drop-shadow(0 0 5px rgba(248,113,113,0.95))'
                : 'drop-shadow(0 2px 3px rgba(0,0,0,0.55))',
            }}
          />
        ))
      })}
    </div>
  )
}

export default VehicleFitStage
