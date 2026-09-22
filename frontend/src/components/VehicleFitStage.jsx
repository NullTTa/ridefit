import { VEHICLE_PLACEHOLDER_IMAGE } from '../constants/images'
import { CATEGORY_POSITION, DEFAULT_POSITION, getFitLayout, getPartOverlays } from '../constants/vehicleFitPositions'

const pct = (value, total) => `${(value / total) * 100}%`

// 배지를 부착 지점에서 얼마나/어느 방향으로 띄울지 기본값(방향 지정이 없는 카테고리용) - 짧게 위로.
const DEFAULT_LABEL_OFFSET = { dx: 0, dy: -34 }

// 차량 사진 + "장착된 부품" 표시. FitRoom과 PartsSearch가 같이 쓴다.
//  - 차량 전용 레이아웃이 있으면(예: Super Cub 110 대표 사진): 사진과 같은 종횡비의 무대 위에
//    부품의 투명 배경 이미지를 실제 위치에 얹는다. 오버레이 이미지가 없는 부품은
//    "부착 지점(점) + 짧은 연결선 + 작은 라벨" 로 대신한다 - 차량 본체를 덜 가리도록 여백 방향으로 살짝 띄운다.
//  - 없으면(임시 아이콘/사용자 사진): 예전처럼 4:3 박스에 같은 방식(점+짧은 선+라벨)으로 표시한다.
// parts: 지금 장착 중인 부품 배열, conflictPartIds: 충돌 중인 partId Set(빨간 윤곽/배지).
function VehicleFitStage({ vehicle, parts, conflictPartIds }) {
  const layout = getFitLayout(vehicle)
  const imageSrc = vehicle?.photoUrl || vehicle?.modelImageUrl || VEHICLE_PLACEHOLDER_IMAGE
  const alt = vehicle?.modelYearLabel ?? '차량'
  const isConflict = (part) => conflictPartIds?.has(part.partId) ?? false

  // totalW/totalH: layout이 있으면 그 사진의 픽셀 크기, 없으면 CATEGORY_POSITION이 이미 0~100 % 값이라 100.
  const totalW = layout?.width ?? 100
  const totalH = layout?.height ?? 100

  const resolveAnchor = (part) => {
    if (layout) {
      // 이 차종 레이아웃에 아직 좌표가 없는 카테고리는 무대 중앙에 배지만 표시한다(차량은 가리지만,
      // 새 카테고리를 추가할 때 좌표를 깜빡해도 화면에서 완전히 사라지지는 않는다).
      return layout.anchors?.[part.category] ?? { x: totalW / 2, y: totalH / 2 }
    }
    return CATEGORY_POSITION[part.category] ?? DEFAULT_POSITION
  }

  // 라벨(연결선 끝 + 작은 텍스트 pill). 부착 지점(anchor.x,y)에서 dx,dy만큼 떨어진 곳에 그린다.
  const label = (part, anchor) => {
    const { dx = DEFAULT_LABEL_OFFSET.dx, dy = DEFAULT_LABEL_OFFSET.dy } = anchor
    const labelX = anchor.x + dx
    const labelY = anchor.y + dy
    const conflict = isConflict(part)
    return (
      <div
        key={`badge-${part.partId}`}
        className="absolute z-40 -translate-x-1/2 -translate-y-1/2 animate-fadeIn"
        style={{ left: pct(labelX, totalW), top: pct(labelY, totalH) }}
        title={part.name}
        data-testid={`fit-badge-${part.partId}`}
      >
        <span
          className={`block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow-lg backdrop-blur ${
            conflict
              ? 'border-ridefit-danger-border bg-ridefit-danger-bg text-ridefit-danger'
              : 'border-ridefit-primary bg-ridefit-bg/90 text-ridefit-primary'
          }`}
        >
          {part.category}
          {conflict ? ' · 충돌' : ''}
        </span>
      </div>
    )
  }

  // 부착 지점 -> 라벨을 잇는 짧은 연결선 + 부착 지점의 작은 점. 라벨 pill과 분리해 SVG 한 장으로 전부 그린다
  // (부품마다 div 회전 계산을 하지 않아도 되고, 화면 크기가 바뀌어도 선 두께가 일정하게 유지된다).
  // SVG viewBox가 이미 그 레이아웃의 실제 좌표계(픽셀, 또는 fallback의 0~100)라서 원시 숫자를 그대로 쓴다
  // (label()/pct()는 CSS 위치 지정용 "%" 문자열이 필요한 라벨 div 쪽에서만 쓴다).
  const connector = (part, anchor) => {
    const { dx = DEFAULT_LABEL_OFFSET.dx, dy = DEFAULT_LABEL_OFFSET.dy } = anchor
    const conflict = isConflict(part)
    const stroke = conflict ? '#F87171' : '#3B82F6'
    return (
      <g key={`connector-${part.partId}`}>
        <line
          x1={anchor.x}
          y1={anchor.y}
          x2={anchor.x + dx}
          y2={anchor.y + dy}
          stroke={stroke}
          strokeWidth="1.5"
          strokeOpacity="0.8"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={anchor.x} cy={anchor.y} r={layout ? 10 : 1.2} fill={stroke} />
      </g>
    )
  }

  const badgeParts = layout
    ? parts.filter((part) => getPartOverlays(part, layout).length === 0)
    : parts

  if (!layout) {
    return (
      <div className="relative mx-auto aspect-[4/3] w-full max-w-lg">
        <img src={imageSrc} alt={alt} className="h-full w-full object-contain" />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {badgeParts.map((part) => connector(part, resolveAnchor(part)))}
        </svg>
        {badgeParts.map((part) => label(part, resolveAnchor(part)))}
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
        if (overlays.length > 0) {
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
        }
        return null
      })}

      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="none">
        {badgeParts.map((part) => connector(part, resolveAnchor(part)))}
      </svg>
      {badgeParts.map((part) => label(part, resolveAnchor(part)))}
    </div>
  )
}

export default VehicleFitStage
