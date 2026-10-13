import { useLayoutEffect, useRef, useState } from 'react'
import { VEHICLE_PLACEHOLDER_IMAGE } from '../constants/images'
import {
  CATEGORY_POSITION,
  DEFAULT_POSITION,
  cssMaskStyle,
  getFitLayout,
  getPartOverlays,
  getStageScale,
} from '../constants/vehicleFitPositions'
import { groupStageLabels } from '../lib/fitBadges'

const pct = (value, total) => `${(value / total) * 100}%`

// 배지를 부착 지점에서 얼마나/어느 방향으로 띄울지 기본값(방향 지정이 없는 카테고리용) - 짧게 위로.
const DEFAULT_LABEL_OFFSET = { dx: 0, dy: -34 }

// 차량 사진 + "장착된 부품" 표시. FitRoom과 PartsSearch가 같이 쓴다.
//  - 차량 전용 레이아웃이 있으면(예: Super Cub 110 대표 사진): 사진과 같은 종횡비의 무대 위에
//    부품의 투명 배경 이미지를 실제 위치에 얹는다. 오버레이 이미지가 없는 부품은 상품 사진을 억지로 얹지 않고
//    "부착 지점(점) + 짧은 연결선 + '장착 이미지 준비 중' 라벨" 로 대신한다 - 차량 본체를 덜 가리도록 여백 방향으로 살짝 띄운다.
//  - 없으면(임시 아이콘/사용자 사진): 예전처럼 4:3 박스에 같은 방식(점+짧은 선+라벨)으로 표시한다.
// parts: 지금 장착 중인 부품 배열, conflictPartIds: 충돌 중인 partId Set(빨간 윤곽/배지).
// large: 크게 보기 화면용 - 기본 max-w-2xl 대신 화면 폭까지 넓히되, 차량 사진이 원본 해상도보다 크게 늘어나지 않는 폭까지만.
function VehicleFitStage({ vehicle, parts, conflictPartIds, large = false }) {
  // 불러오지 못한 이미지 경로. 부품 레이어가 실패하면 깨진 아이콘 대신 배지로 돌리고, 차량 사진이 실패하면 안내 문구를 띄운다.
  const [failedSrcs, setFailedSrcs] = useState(() => new Set())
  const markFailed = (src) => setFailedSrcs((prev) => (prev.has(src) ? prev : new Set(prev).add(src)))
  const layout = getFitLayout(vehicle)
  const overlaysFor = (part) => getPartOverlays(part, layout).filter((o) => !failedSrcs.has(o.src))
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

  const badgeParts = layout
    ? parts.filter((part) => overlaysFor(part).length === 0)
    : parts

  // 차량이 무대를 꽉 채우지 않도록 360°와 같은 비율로 가운데 기준 축소(inset이 위아래/좌우 같은 %라 사진 비율과 좌표는 그대로).
  // f = 바깥 무대 대비 안쪽(사진) 여백 비율. 레이아웃이 없으면(4:3 박스) 여백 없음.
  const stageScale = layout ? getStageScale(vehicle) : 1
  const f = (1 - stageScale) / 2
  // 사진 좌표(0~totalW) <-> 바깥 무대 비율(0~1). 라벨은 바깥 무대 기준으로 놓아 무대 가장자리까지 쓸 수 있게 한다.
  const toOuter = (ix, iy) => ({ fx: f + (ix / totalW) * (1 - 2 * f), fy: f + (iy / totalH) * (1 - 2 * f) })
  const toInner = (fx, fy) => ({ x: ((fx - f) / (1 - 2 * f)) * totalW, y: ((fy - f) / (1 - 2 * f)) * totalH })

  // 라벨 겹침 계산용 실측값: 무대 크기(box)와 라벨 pill 크기(probe - 화면에 안 보이는 같은 모양의 pill). 글꼴이 늦게 로드돼도 다시 잰다.
  const outerRef = useRef(null)
  const probeRef = useRef(null)
  const [measure, setMeasure] = useState(null)
  const hasLayout = !!layout
  useLayoutEffect(() => {
    const el = outerRef.current
    const probe = probeRef.current
    if (!el || !probe || typeof ResizeObserver === 'undefined') return undefined
    const read = () => {
      const r = el.getBoundingClientRect()
      const next = { w: r.width, h: r.height, pill: {} }
      probe.querySelectorAll('[data-probe]').forEach((s) => {
        const q = s.getBoundingClientRect()
        next.pill[s.dataset.probe] = { w: q.width, h: q.height }
      })
      setMeasure((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    }
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    ro.observe(probe)
    return () => ro.disconnect()
  }, [hasLayout])

  // 부품마다 원래 라벨 위치(부착 지점 + dx,dy)를 구하고, 화면에서 서로 겹치는 라벨은 하나로 묶는다(lib/fitBadges).
  // 왼쪽 위 연식 배지와 오른쪽 위 [크게 보기] 버튼 자리(무대 위에 겹쳐 놓이는 FitRoom/PartsSearch 요소)는 피한다. 크게 보기 화면에는 둘 다 없다.
  const items = badgeParts.map((part) => {
    const anchor = resolveAnchor(part)
    const { dx = DEFAULT_LABEL_OFFSET.dx, dy = DEFAULT_LABEL_OFFSET.dy } = anchor
    return { part, anchor, conflict: isConflict(part), ...toOuter(anchor.x + dx, anchor.y + dy) }
  })
  const partById = new Map(items.map((it) => [it.part.partId, it]))
  const sizeOf = (count, conflict) => measure.pill[`${count > 1 ? 'n' : '1'}${conflict ? 'c' : ''}`]
  const canGroup = measure && measure.w > 0 && ['1', 'n', '1c', 'nc'].every((k) => measure.pill[k]?.w > 0)
  const labelGroups = canGroup
    ? groupStageLabels(
        items.map((it) => ({ id: it.part.partId, x: it.fx * measure.w, y: it.fy * measure.h, conflict: it.conflict })),
        {
          box: measure,
          sizeOf,
          reserved: large ? [] : [
            { x0: 0, y0: 0, x1: 130, y1: 34 },
            { x0: measure.w - 115, y0: 0, x1: measure.w, y1: 34 },
          ],
        },
      ).map((g) => ({ ...g, fx: g.x / measure.w, fy: g.y / measure.h }))
    : items.map((it) => ({ ids: [it.part.partId], fx: it.fx, fy: it.fy, count: 1, conflict: it.conflict }))
  const groupOf = new Map(labelGroups.flatMap((g) => g.ids.map((id) => [id, g])))

  const pillClass = (conflict) =>
    `block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow-lg backdrop-blur ${
      conflict
        ? 'border-ridefit-danger-border bg-ridefit-danger-bg text-ridefit-danger'
        : 'border-ridefit-primary bg-ridefit-bg/90 text-ridefit-primary'
    }`
  const pillText = (count, conflict) => `장착 이미지 준비 중${count > 1 ? ` · ${count}개` : ''}${conflict ? ' · 충돌' : ''}`

  // 라벨(작은 텍스트 pill). 묶인 라벨은 "장착 이미지 준비 중 · n개"로 보이고, 툴팁/스크린리더에는 부품 이름을 전부 알려준다.
  // 부품별 data-testid(fit-badge-{id})는 묶여도 남겨 둔다(숨은 표시).
  const label = (g) => {
    const members = g.ids.map((id) => partById.get(id).part)
    return (
      <div
        key={`badge-${g.ids.join('-')}`}
        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 animate-fadeIn"
        style={{ left: `${g.fx * 100}%`, top: `${g.fy * 100}%` }}
        title={`${members.map((p) => p.name).join(', ')} - 장착 이미지 준비 중`}
        aria-label={`${members.map((p) => `${p.category} ${p.name}`).join(', ')}: 장착 이미지 준비 중`}
        data-testid={g.count > 1 ? 'fit-badge-group' : `fit-badge-${g.ids[0]}`}
        data-pending="true"
        data-count={g.count}
      >
        <span className={pillClass(g.conflict)}>{pillText(g.count, g.conflict)}</span>
        {g.count > 1 && g.ids.map((id) => <span key={id} hidden data-testid={`fit-badge-${id}`} data-pending="true" />)}
      </div>
    )
  }
  // 겹침 계산용 pill 견본(화면에 안 보임). 개수는 두 자리까지 넉넉하게 잰다.
  const probes = (
    <div ref={probeRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 flex flex-col items-start">
      {[['1', 1, false], ['n', 99, false], ['1c', 1, true], ['nc', 99, true]].map(([key, count, conflict]) => (
        <span key={key} data-probe={key} className={pillClass(conflict)}>{pillText(count, conflict)}</span>
      ))}
    </div>
  )
  const labelLayer = (
    <div className="pointer-events-none absolute inset-0 z-40" data-testid="fit-badge-layer">
      {labelGroups.map(label)}
    </div>
  )

  // 부착 지점 -> 라벨을 잇는 짧은 연결선 + 부착 지점의 작은 점. 라벨 pill과 분리해 SVG 한 장으로 전부 그린다
  // (부품마다 div 회전 계산을 하지 않아도 되고, 화면 크기가 바뀌어도 선 두께가 일정하게 유지된다).
  // SVG viewBox가 이미 그 레이아웃의 실제 좌표계(픽셀, 또는 fallback의 0~100)라서 원시 숫자를 그대로 쓴다.
  // 선 끝은 그 부품의 라벨(묶였으면 묶인 라벨) 중심 - 묶여도 부품마다 부착 지점이 보인다.
  const connector = (part, anchor) => {
    const conflict = isConflict(part)
    const stroke = conflict ? '#F87171' : '#3B82F6'
    const g = groupOf.get(part.partId)
    const end = toInner(g.fx, g.fy)
    return (
      <g key={`connector-${part.partId}`}>
        <line
          x1={anchor.x}
          y1={anchor.y}
          x2={end.x}
          y2={end.y}
          stroke={stroke}
          strokeWidth="1.5"
          strokeOpacity="0.8"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={anchor.x} cy={anchor.y} r={layout ? 10 : 1.2} fill={stroke} />
      </g>
    )
  }

  if (!layout) {
    return (
      <div ref={outerRef} className="relative mx-auto aspect-[4/3] w-full max-w-lg">
        <img src={imageSrc} alt={alt} className="h-full w-full object-contain" />
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          {badgeParts.map((part) => connector(part, resolveAnchor(part)))}
        </svg>
        {labelLayer}
        {probes}
      </div>
    )
  }

  const inset = `${f * 100}%`
  // 휠 교체처럼 순정 부품을 지워야 하는 부품: 차량 사진에 마스크를 걸고(지운 자리), 새 부품 레이어는 차량 "아래"(under)에 깐다.
  // 레이어를 못 불러온 부품은 마스크도 걸지 않는다(순정 부품만 지워지고 새 부품이 없는 빈자리가 생기지 않게).
  const vehicleMask = cssMaskStyle(parts.flatMap((part) => overlaysFor(part).map((o) => o.mask).filter(Boolean)))

  const overlayImg = (part, o, i) => (
    <img
      key={`${part.partId}-${i}`}
      src={o.src}
      alt={part.name}
      title={part.name}
      draggable={false}
      data-testid={`fit-overlay-${part.partId}`}
      onError={() => markFailed(o.src)}
      className="pointer-events-none absolute animate-fadeIn select-none"
      style={{
        left: pct(o.x, layout.width),
        top: pct(o.y, layout.height),
        width: pct(o.width, layout.width),
        height: 'auto',
        // under 레이어는 z-index 없이 차량 사진보다 먼저 그려 그 아래에 깔린다.
        zIndex: o.under ? undefined : (o.z ?? 10),
        transform: `translate(-50%, -50%) rotate(${o.rotate ?? 0}deg) scaleX(${o.flipX ? -1 : 1})`,
        filter: isConflict(part)
          ? 'drop-shadow(0 0 5px rgba(248,113,113,0.95))'
          : o.shadow === false ? undefined : 'drop-shadow(0 2px 3px rgba(0,0,0,0.55))',
      }}
    />
  )
  const overlaysOf = (under) =>
    parts.flatMap((part) =>
      overlaysFor(part)
        .map((o, i) => [o, i])
        .filter(([o]) => !!o.under === under)
        .map(([o, i]) => overlayImg(part, o, i)),
    )

  return (
    <div
      ref={outerRef}
      className={`relative mx-auto w-full ${large ? '' : 'max-w-2xl'}`}
      // 크게 보기: 차량 사진이 원본 픽셀보다 크게 늘어나지 않는 폭(사진 폭 / 무대 축소 비율)까지만 넓힌다.
      style={{ aspectRatio: `${layout.width} / ${layout.height}`, ...(large ? { maxWidth: `${Math.round(layout.width / stageScale)}px` } : {}) }}
      data-testid={large ? 'fit-stage-large' : 'fit-stage'}
    >
      <div className="absolute" style={{ inset }} data-testid="fit-stage-inner">
      {overlaysOf(true)}
      <img
        src={imageSrc}
        alt={alt}
        className="absolute inset-0 h-full w-full select-none"
        style={vehicleMask ?? undefined}
        draggable={false}
        data-testid="fit-stage-vehicle"
        data-masked={vehicleMask ? 'true' : undefined}
        onError={() => markFailed(imageSrc)}
      />
      {failedSrcs.has(imageSrc) && (
        <p className="absolute inset-0 flex items-center justify-center text-xs text-ridefit-text-secondary" data-testid="fit-stage-vehicle-error">
          차량 사진을 불러오지 못했어요. 새로고침해 주세요.
        </p>
      )}

      {overlaysOf(false)}

      {/* overflow-visible: 라벨이 사진 바깥 여백(무대 가장자리)에 놓여도 연결선이 사진 경계에서 잘리지 않게 */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="none">
        {badgeParts.map((part) => connector(part, resolveAnchor(part)))}
      </svg>
      </div>
      {labelLayer}
      {probes}
    </div>
  )
}

export default VehicleFitStage
