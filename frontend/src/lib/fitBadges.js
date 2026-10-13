// 차량 무대(VehicleFitStage) 위 "장착 이미지 준비 중" 라벨 배치.
// 라벨 위치(anchors의 dx,dy)는 차량 사진 픽셀 기준이라 무대가 작아질수록 라벨끼리 가까워지는데, 라벨(pill) 크기는 글자 크기 그대로라
// 작은 무대(예: 1280x600 데스크톱의 고정 미리보기)에서는 핸들 주변 부품(레버/램프/미러/거치대 ...) 라벨이 한곳에 겹쳐 쌓였다.
// 여기서는 실제 화면 크기(px)로 라벨 사각형을 계산해 겹치는 라벨을 하나의 라벨("장착 이미지 준비 중 · n개")로 묶는다 -
// 묶인 라벨에서 각 부품의 부착 지점까지 연결선은 그대로 그리므로 어디에 붙는 부품인지는 계속 보인다.
// 무대가 커서 겹치지 않으면(크게 보기 등) 지금처럼 부품마다 라벨 하나다.

// 사각형 두 개가 gap 이상 떨어져 있지 않으면 겹친 것으로 본다.
const overlaps = (a, b, gap) =>
  a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap

const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length

// 라벨 중심을 무대 안으로 넣고, 다른 요소(연식 배지/크게 보기 버튼 등)가 있는 자리(reserved)에 걸리면 그 아래로 내린다.
function place(x, y, w, h, box, reserved, gap) {
  const clamp = (v, half, max) => (max <= half * 2 ? max / 2 : Math.min(Math.max(v, half), max - half))
  let cx = clamp(x, w / 2, box.w)
  let cy = clamp(y, h / 2, box.h)
  for (const r of reserved) {
    const rect = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 }
    if (overlaps(rect, r, gap)) cy = Math.min(r.y1 + gap + h / 2, Math.max(box.h - h / 2, h / 2))
  }
  return { x: cx, y: cy, x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 }
}

// items: [{ id, x, y, conflict }] - 라벨이 원래 놓일 중심(무대 바깥 상자 기준 px).
// box: { w, h } 무대 크기(px). sizeOf(count, conflict) -> { w, h } 그 라벨의 실제 크기(px, 화면에서 측정).
// 반환: [{ ids, x, y, count, conflict }] - x,y는 묶인 라벨의 중심(px). 묶인 라벨은 원래 위치들의 평균에 둔다.
export function groupStageLabels(items, { box, sizeOf, reserved = [], gap = 4 }) {
  const build = (members) => {
    const conflict = members.some((m) => m.conflict)
    const { w, h } = sizeOf(members.length, conflict)
    const at = place(mean(members.map((m) => m.x)), mean(members.map((m) => m.y)), w, h, box, reserved, gap)
    return { members, conflict, rect: at }
  }
  let groups = items.map((item) => build([item]))
  // 겹치는 두 묶음이 없을 때까지 합친다(합친 라벨이 다시 다른 라벨과 겹칠 수 있어 반복). 부품 수가 적어(수십 개 이하) 단순 반복으로 충분하다.
  for (let merged = true; merged; ) {
    merged = false
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        if (overlaps(groups[i].rect, groups[j].rect, gap)) {
          const next = build([...groups[i].members, ...groups[j].members])
          groups = [...groups.slice(0, i), next, ...groups.slice(i + 1, j), ...groups.slice(j + 1)]
          merged = true
          break outer
        }
      }
    }
  }
  return groups.map((g) => ({ ids: g.members.map((m) => m.id), x: g.rect.x, y: g.rect.y, count: g.members.length, conflict: g.conflict }))
}
