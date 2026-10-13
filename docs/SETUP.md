# 실행 및 환경 설정

## 필요한 도구

| 도구 | 버전 | 비고 |
| --- | --- | --- |
| JDK | 21 | Gradle toolchain이 21을 요구 |
| Node.js | 18 이상 | 개발 환경에서는 24로 확인 |
| MySQL | 8.x | 로컬 3306, DB `ridefit`(없으면 접속 URL 옵션으로 자동 생성) |

## 1. 백엔드

```powershell
Copy-Item src/main/resources/application-local.properties.example src/main/resources/application-local.properties
# application-local.properties 에 DB 계정/비밀번호, jwt.secret(32바이트 이상 임의 문자열)을 채운다.
.\gradlew.bat bootRun
```

- 주소: `http://localhost:8080`, API 문서: `http://localhost:8080/swagger-ui/index.html`
- `application-local.properties`는 `.gitignore`에 포함되어 커밋되지 않는다. 실제 비밀번호·키를 다른 파일에 적지 않는다.
- 첫 실행 때 시더가 차량/부품/호환/정보글/매장 같은 카탈로그 데이터를 넣는다.
- 테스트 계정(`user@ridefit.dev`, `admin@ridefit.dev` 등)과 샘플 게시글은 **`ridefit.seed.demo-accounts=true`일 때만** 만든다(기본값 `false`).
  비밀번호가 `DataSeeder`에 공개된 개발용 값이라, 로컬 `application-local.properties`에서만 켜고 외부에 공개하는 서버에서는 켜지 않는다.
  예전에 만든 로컬 DB에는 계정이 이미 있으므로 이 값이 없어도 로그인은 그대로 된다(새 DB에서만 차이가 난다). 테스트(`application-test.properties`)는 켜 둔다.
- 관리자 지정: `ridefit.seed.admin-emails=a@example.com,b@example.com` - **이미 가입한** 회원의 역할만 ADMIN으로 바꾸고, 계정을 새로 만들지 않는다.
- 업로드 파일(저장한 장착 모습 등)은 `uploads/`(`UPLOAD_DIR`로 변경 가능)에 저장되며 커밋되지 않는다.

### 백엔드 환경 변수(선택)

| 키 | 용도 | 기본값 |
| --- | --- | --- |
| `UPLOAD_DIR` | 업로드 저장 폴더 | `uploads` |
| `FRONTEND_PUBLIC_DIR` | 차량·부품 원본 이미지 폴더(서버가 저장 이미지 검증에 사용) | `frontend/public` |
| `TOSS_SECRET_KEY` | Toss Payments **테스트** 시크릿 키(`test_`로 시작하지 않으면 거절) | 없음 → 결제 비활성 |
| `AI_FIT_PROVIDER`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `MAGICHOUR_API_KEY` | 선택 기능 "장착한 모습 만들기"(외부 이미지 생성). 키가 하나도 없으면 버튼만 비활성화되고 나머지 기능은 그대로 | 없음 |
| `AI_SYNTH_MODE`, `POLLINATIONS_API_KEY` | 예전 링크 합성 기능(`mock`/`live`)과 그 키 | `mock`, 없음 |

비용이 드는 외부 API 키는 넣지 않아도 핵심 기능(장착 미리보기·저장·360°)이 모두 동작한다.

## 2. 프런트엔드

```powershell
cd frontend
npm install
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }   # 처음 한 번만. 필요한 값만 채운다(.env.local은 커밋되지 않음)
npm run dev                          # http://localhost:5173 (포트 고정)
```

| 키(`frontend/.env.local`) | 용도 |
| --- | --- |
| `VITE_API_BASE_URL` | 백엔드 주소(기본 `http://localhost:8080`) |
| `VITE_KAKAO_MAP_KEY` | 정비소 상세 지도(Kakao JavaScript 키, Kakao Developers에 `http://localhost:5173` 도메인 등록 필요) |
| `VITE_TOSS_CLIENT_KEY` | Toss Payments 테스트 클라이언트 키 |

## 3. 테스트

```powershell
.\gradlew.bat test                 # 백엔드 - H2 인메모리 DB(test 프로필), 로컬 MySQL을 건드리지 않음
.\gradlew.bat test --rerun         # 캐시된 결과를 쓰지 않고 다시 실행
cd frontend; npm run lint; npm run build
```

## 주요 포트

| 포트 | 용도 |
| --- | --- |
| 5173 | Vite 개발 서버(지도 키 도메인과 맞추기 위해 다른 포트로 넘어가지 않고 실행을 멈춤) |
| 8080 | Spring Boot API, `/uploads/**` |
| 3306 | MySQL |

## 자주 발생하는 오류

| 증상 | 원인 / 해결 |
| --- | --- |
| `Port 5173 is in use` 로 프런트가 안 뜸 | 이미 실행 중인 Vite가 있음. 기존 창을 닫거나 그 서버를 그대로 사용 |
| 정비소 상세에서 지도가 안 보임 | `VITE_KAKAO_MAP_KEY` 없음 또는 Kakao 콘솔에 현재 주소(예: `http://localhost:5173`) 미등록 |
| 로그인 직후 바로 로그아웃됨 | 백엔드가 401 응답 - `jwt.secret` 변경 후 예전 토큰 사용. 다시 로그인 |
| "장착한 모습 만들기" 버튼이 비활성 | 외부 이미지 생성 API 키가 없음(정상). 레이어가 있는 부품은 [현재 모습 저장]으로 저장 |
| 결제 화면에 "결제 설정이 아직 되지 않았어요" | `VITE_TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` 미설정(테스트 키만 사용) |
| 백엔드 시작 시 DB 접속 오류 | MySQL 미실행 또는 `application-local.properties` 계정 정보 확인 |
