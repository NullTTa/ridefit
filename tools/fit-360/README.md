# fit-360 — Super Cub 110 머플러·사이드백 장착 레이어 생성기

AI/외부 API 없이 **같은 입력이면 같은 결과**가 나오는 스크립트다(2026-10 생성 결과를 다시 돌려 19개 파일 모두 픽셀 단위로 같음을 확인).
API 키·토큰 등 비밀 정보는 쓰지 않는다. 휠 레이어 생성기는 별도(`tools/wheel-fit`, Python).

| 스크립트 | 만드는 것 | 결과가 쓰이는 곳 |
|---|---|---|
| `muffler.mjs` | 순정 스타일 스테인리스 머플러 360° 레이어(02~05) + 05 마스크, 마차 휠 동시 장착용 변형(`COMBO=1`) | `constants/vehicle360Parts.js` |
| `sidebag.mjs` | 사이드백(한 쌍) 360° 레이어(02~08) + 2D 대표 사진 레이어(`rep`) | `vehicle360Parts.js`, `vehicleFitPositions.js`(2D·Hero) |
| `composite.mjs` | 뷰어와 같은 순서(아래 레이어 → 마스크 건 차량 → 위 레이어)로 합성한 확인용 이미지 | 확인용(서비스에 안 씀) |
| `spokes.mjs` | 바퀴 스포크 주기(도) 측정 - 머플러 메우기의 회전 각도(72°) 근거 | 확인용 |
| `views-muffler.json` / `views-sidebag.json` | 프레임별 실측값(아래 "수동 실측·추정") | 입력 |

## 준비 (Windows)

Node.js 18 이상. 이 폴더에서 한 번만:

```powershell
cd D:\개인프로젝트\ridefit\tools\fit-360
npm install          # pngjs 7.0.0 (node_modules/ 는 git 제외)
```

## 실행

결과는 **`out/`(git 제외)에 먼저 만들고**, 눈으로 확인한 뒤 `frontend/public`에 복사한다.
`frontend/public` 안의 기존 파일을 직접 출력 경로로 주면 `ALLOW_OVERWRITE=1` 없이는 저장하지 않고 멈춘다.

```powershell
# 머플러: node muffler.mjs <프레임> <레이어.png> <미리보기.png>   (마스크가 필요한 각도는 <레이어>-mask.png 도 만든다)
foreach ($v in '02','03','04','05') { node muffler.mjs $v "out/muffler/$v.png" "out/preview/muffler-$v.png" }
# 마차 휠과 함께 장착할 때의 변형(림 안쪽은 메우지 않고 마스크로 지움)
$env:COMBO = '1'; foreach ($v in '02','03','04') { node muffler.mjs $v "out/muffler/wheel-$v.png" "out/preview/muffler-wheel-$v.png" }; Remove-Item Env:COMBO

# 사이드백: node sidebag.mjs <프레임|rep> <레이어.png> <미리보기.png> [--wire]  (--wire = 미리보기에 가방 상자 윤곽)
foreach ($v in '02','03','04','05','06','07','08','rep') { node sidebag.mjs $v "out/sidebag/$v.png" "out/preview/sidebag-$v.png" }

# 확인용 합성(예: 03 + 마차 휠 + 머플러 변형)
$W = '../../frontend/public/assets/parts/360/super-cub-110/spoke-wheel'
node composite.mjs 03 out/check-03.png "under=$W/03.png" "mask=$W/mask-03.png,out/muffler/wheel-03-mask.png" "over=out/muffler/wheel-03.png"
```

Git Bash에서는 `for v in 02 03 04 05; do node muffler.mjs $v out/muffler/$v.png out/preview/muffler-$v.png; done`, `COMBO=1 node muffler.mjs ...` 처럼 쓴다.

### 결과를 서비스에 반영할 때의 파일 이름

| out/ | frontend/public/assets/… |
|---|---|
| `muffler/02~05.png` | `parts/360/super-cub-110/stainless-muffler/02~05.png` |
| `muffler/05-mask.png` | `…/stainless-muffler/mask-05.png` |
| `muffler/wheel-02~04.png` / `wheel-02~04-mask.png` | `…/stainless-muffler/wheel-02~04.png` / `wheel-mask-02~04.png` |
| `sidebag/02~08.png` | `parts/360/super-cub-110/saddlebag-pair-lace-v4/02~08.png` (2026-10, 바깥 면·뚜껑 = Hero 이미지, 끝 면 = 상품 사진(`endTex`). v3 = 끝 면까지 Hero 이미지 `-v3/`, v2 = 상품 사진 텍스처 `-v2/`, v1 = 처음 상자 `saddlebag-pair-lace/` - v1~v3는 서비스에서 안 써서 저장소에 올리지 않음, 상자/텍스처 값은 아래에 기록) |
| `sidebag/rep.png` | 확인용(서비스에 안 씀) - 2D 위치 미리보기·Hero·저장 이미지는 `parts/overlay/saddlebag-pair-lace-side.png`(커밋된 Hero 이미지) |

01 머플러/사이드백, 06~08 머플러는 그 각도에서 부품이 가려져 파일이 없다(`vehicle360Parts.js`에서 `null`).

## 필요한 입력(모두 저장소 안)

- 차량: `assets/vehicles/super-cub-110/360/01~08.png`(1497x704), 대표 사진 `assets/vehicles/super-cub-110.png`(1829x860)
- 머플러 상품 컷: `assets/parts/overlay/cub110-stainless-exhaust.png`(297x72, 투명)
- 사이드백 텍스처: `views-sidebag.json`의 `texSource` = `assets/parts/overlay/saddlebag-pair-lace-side.png`(222x181, 커밋된 Hero 이미지). 없으면 상품 사진 `assets/parts/saddlebag-pair-lace.png`
- (확인용) 마차 휠 레이어/마스크: `assets/parts/360/super-cub-110/spoke-wheel/`

입력 파일이 없으면 `입력 이미지가 없습니다: <경로>` 로 멈추고 아무것도 쓰지 않는다.

## 만드는 방법과 수동 실측·추정한 부분

**머플러**(`views-muffler.json`)
- `stock`: 순정 머플러 윤곽 다각형 - 프레임을 확대해 **손으로 실측**.
- `axis`: 순정 머플러 축(뒤 끝 → 앞 끝). 상품 컷의 꼬리관 끝/입구 끝을 이 두 점에 맞춰 원근 변환한다.
- 순정 머플러가 남는 자리: 뒷바퀴 타원(`wheel`, `tools/wheel-fit/views.json`과 같은 실측값) 좌표계에서 72° 배수 회전한 픽셀의 중앙값으로 메운다.
  72°는 **앞바퀴에서 측정한 스포크 주기**(`spokes.mjs`)이고, 뒷바퀴도 같은 디자인이라고 **가정**했다. 바퀴 밖은 주변색 확산으로 메운다.
- 05(후면): 머플러 끝이 정면으로 보이는데 상품 사진에 그 각도가 없어, **상품 컷의 평균 금속색 + 위쪽 조명 음영으로 원판(몸통 뒷면)과 꼬리관 링을 그렸다**
  (실제 촬영 이미지 아님). 배경과 맞닿은 순정 테두리는 차량 프레임 마스크로 지운다.

**사이드백**(`views-sidebag.json`)
- `tex`: `texSource` 이미지에서 가방의 바깥 면/앞 끝 면/뚜껑 띠 네 모서리 - **손으로 실측**(Hero 이미지는 측면이라 뚜껑 윗면이 없어 바깥 면 맨 위 띠를 쓴다).
- `box`: 가방 상자(뒤축 중심 기준 mm, X 앞 / Y 위 / Z 오른쪽). 짐받이 위치는 03 프레임에서 실측했지만
  **가방 크기(330x250x140mm)와 바깥쪽 거리(135~275mm)는 상품 치수 정보가 없어 추정**했다.
  2026-10 재조정: 홈 Hero 사이드백 레이어(`hero/layers/super-cub-110-sidebag.png`)를 기준으로, 상자를 `rep` 투영했을 때의
  윤곽이 Hero 가방과 가장 많이 겹치는 값(IoU 0.45 -> 0.74, 가방 깊이 140mm 유지)으로 바꿨다:
  X -120~170, Y 210~450, Z 120~260 (예전 X -205~125, Y 175~425, Z 135~275 - 가방이 85mm쯤 더 뒤라 02/06/08에서 차체 뒤로 튀어나옴).
  같은 날 v3: 기준을 커밋된 Hero 이미지(`overlay/saddlebag-pair-lace-side.png`, 대표 사진 498,450 / 가로 222)로 바로잡고(위 11차 레이어는 버클 디자인이 다름)
  텍스처도 그 이미지로 바꿔 X -70~200, Y 190~400, Z 120~260 (IoU 0.93).
  v4: Hero 이미지는 측면이라 끝 면이 30px 띠뿐이어서 05/04/06의 끝 면이 검은 판처럼 보였다 -> `endTex`로 앞/뒤 끝 면만 상품 사진의
  실제 끝 면(버클 없음, 예전 `tex.end` 값)을 쓴다. 실제 뒷면 사진이 아니라 같은 상품의 끝 면을 앞/뒤에 같이 쓰는 것이다.
- 360 프레임: 방위각/배율/뒤축 위치(`beta`, `s`, `C`, 고도 `phi` 6°)로 정사영. 배율과 방위는 뒷바퀴 타원에서 쟀고,
  머플러 끝 위치로 검증(02 프레임 예측 392 / 실제 395).
- 2D 대표 사진(`rep`): 렌즈/각도가 360 프레임과 달라, 3D 위치를 아는 기준점 5개(뒤축, 짐받이 뒤끝/앞 기둥, 미등, 머플러 뒤끝)와
  사진 속 위치로 정사영을 최소제곱으로 맞춘다(잔차 5~12px). 반대쪽 가방은 차체에 가려 그리지 않는다(`hideSides`).
- 왼쪽 가방은 같은 상품의 짝이라 같은 사진을 면 대응으로 좌우 반전해 쓴다. 차체 뒤쪽 가방은 차량 프레임이 투명한 곳에만 그린다(`behind`).
- 짐받이 위로 지나는 연결 끈 덮개(요크)는 그리지 않았다.

## 주의

- 결과물을 대량으로 바꾸기 전에 `out/preview/`와 `composite.mjs`로 확인하고, 브라우저(FitRoom 위치 미리보기/360° 보기)에서 각도별로 다시 본다.
- 실측값을 바꾸면 그 각도 결과만 달라진다. 레이어 파일 이름/각도 구성을 바꾸면 `vehicle360Parts.js`도 함께 고친다.
