import { getFitLayout, getPartOverlays, getStageScale } from '../constants/vehicleFitPositions'

// "직접 합성" 장착 모습(AI 없음): 위치 미리보기(VehicleFitStage)와 같은 배치를 브라우저 canvas에 차량 대표 사진의
// 원본 해상도 그대로 그려 PNG 한 장으로 만든다. 서버(POST /api/ai-fit/composite)는 비율/해상도를 확인하고 무손실로 저장한다.
//  - 차량 사진은 1:1(정수 위치)로 그려 다시 샘플링하지 않는다 - 원본 픽셀 그대로.
//  - 무대와 같은 여백(getStageScale)을 두어 결과 화면/위치 미리보기/360에서 차량 크기가 같게 보인다. 여백은 투명.
//  - 오버레이 배치/마스크/아래 깔기(under) 규칙은 VehicleFitStage와 같다.
// 레이어 이미지/배치를 바꾸면 버전을 올린다(같은 조합의 예전 저장 결과와 구분 - 서버 cacheKey에 들어간다).
export const COMPOSITE_VERSION = 'wheel-v1'

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('합성에 쓸 이미지를 불러오지 못했어요.'))
    img.src = src
  })

// 직접 합성에 들어가는 부품(위치 미리보기에서 이미지로 보이는 부품). 배지로만 표시되는 부품은 빠진다.
export function compositeIncludedParts(vehicle, parts) {
  const layout = getFitLayout(vehicle)
  return layout ? parts.filter((p) => getPartOverlays(p, layout).length > 0) : []
}

export async function renderFitComposite(vehicle, parts) {
  const layout = getFitLayout(vehicle)
  if (!layout) throw new Error('이 차량 사진은 직접 합성을 지원하지 않아요.')
  const vehicleImg = await loadImage(vehicle.modelImageUrl)
  const nw = vehicleImg.naturalWidth
  const nh = vehicleImg.naturalHeight
  // 레이아웃 좌표(사진 픽셀) -> 원본 픽셀 배율(대표 사진 그대로면 1)
  const k = nw / layout.width
  const scale = getStageScale(vehicle)
  const padX = Math.round((nw / scale - nw) / 2)
  const padY = Math.round((nh / scale - nh) / 2)
  const W = nw + padX * 2
  const H = nh + padY * 2

  const overlays = parts.flatMap((p) => getPartOverlays(p, layout))
  const overlayImgs = await Promise.all(overlays.map((o) => loadImage(o.src)))
  const maskImgs = await Promise.all(overlays.filter((o) => o.mask).map((o) => loadImage(o.mask)))

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // 위치 미리보기 그림자(drop-shadow 0 2px 3px, 화면 px)를 원본 해상도에 맞춰 키운 값
  const shadowScale = 2.5

  const draw = (o, img) => {
    const w = o.width * k
    const h = (w * img.naturalHeight) / img.naturalWidth
    ctx.save()
    ctx.translate(padX + o.x * k, padY + o.y * k)
    ctx.rotate(((o.rotate ?? 0) * Math.PI) / 180)
    if (o.flipX) ctx.scale(-1, 1)
    if (o.shadow !== false) ctx.filter = `drop-shadow(0px ${2 * shadowScale}px ${3 * shadowScale}px rgba(0,0,0,0.55))`
    ctx.drawImage(img, -w / 2, -h / 2, w, h)
    ctx.restore()
  }

  // 1) 차량 아래에 까는 부품(휠)
  overlays.forEach((o, i) => o.under && draw(o, overlayImgs[i]))
  // 2) 차량 사진(마스크가 있으면 순정 부품 자리를 비운 뒤) - 원본 크기 그대로 정수 위치에
  const vc = document.createElement('canvas')
  vc.width = nw
  vc.height = nh
  const vctx = vc.getContext('2d')
  vctx.drawImage(vehicleImg, 0, 0)
  maskImgs.forEach((m) => {
    vctx.globalCompositeOperation = 'destination-in'
    vctx.drawImage(m, 0, 0, nw, nh)
  })
  ctx.drawImage(vc, padX, padY)
  // 3) 차량 위 부품(겹침 순서 z)
  overlays
    .map((o, i) => [o, overlayImgs[i]])
    .filter(([o]) => !o.under)
    .sort((a, b) => (a[0].z ?? 10) - (b[0].z ?? 10))
    .forEach(([o, img]) => draw(o, img))

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('장착 모습 이미지를 만들지 못했어요.'))), 'image/png'),
  )
}
