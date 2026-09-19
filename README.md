# RIDEFIT

바이크(오토바이) 애프터마켓 부품을 살 때 "이게 내 차에 맞을까?"를 매번 판매자에게 묻거나,
장착하고 나서야 아는 상황을 줄이기 위해 만든 서비스입니다. 내 차량(제조사/모델/연식)을
등록해두면, 부품 판매 링크만 붙여넣어도 실제 호환 데이터를 기준으로 맞는지 바로 확인하고,
호환되는 부품은 AI로 장착 모습을 미리 볼 수 있습니다.

## 왜 만들었나

애프터마켓 부품 시장은 "같은 브랜드의 같은 부품이어도 연식에 따라 안 맞을 수 있다"는 정보가
파편화되어 있습니다. 커뮤니티 글, 판매자 설명, 후기를 일일이 대조하는 대신, 부품과
차종(모델+연식)의 호환 관계를 데이터로 관리하고 즉시 조회할 수 있게 만드는 것이 이 프로젝트의
목표입니다.

## 핵심 기능

- **회원가입/로그인 (JWT)**: Spring Security + JWT 기반 stateless 인증. 차량 등록 등
  회원 관련 API는 클라이언트가 아니라 인증된 사용자 정보로만 처리합니다.
- **내 차고 (Garage)**: 등록한 차량을 카드로 보는 마이페이지형 화면.
- **호환성 검사**: 부품 판매 링크를 붙여넣으면 서버가 제목/가격/이미지를 대신 가져오고,
  상품명에서 차종을 자동 인식합니다. 실패하면(봇 차단 등, 정상적인 상황으로 취급) 수동 입력
  폼으로 자연스럽게 전환됩니다. 내 차량을 선택하는 즉시 호환 여부가 표시되고, 호환되는
  경우에만 다음 단계(AI 합성)로 넘어갈 수 있습니다.
- **부품 찾아보기**: 링크 없이도, 내 차량 기준으로 이미 호환이 확인된 부품을 카테고리별로
  둘러볼 수 있습니다. 여러 부품을 선택하면 서로 충돌하는 조합이 있는지도 확인합니다.
- **AI 장착 미리보기**: 호환이 확인된 부품에 한해 Pollinations API로 장착 모습을 합성합니다.
  `AI_SYNTH_MODE=mock`(기본값)에서는 고정 샘플 이미지로 동작해 API 비용 없이 흐름을 검증할
  수 있고, `live`로 전환하면 실제 이미지 생성 API를 호출합니다.
- **커뮤니티**: 장착 후기를 남길 수 있고, "장착한 부품 + 호환 여부(맞았어요/안 맞았어요)"를
  함께 기록해 나중에 호환성 데이터를 보완하는 데 쓸 수 있는 구조로 되어 있습니다.
- **관리자 페이지**: 회원/차량/부품/게시글 통계 대시보드, 호환성(Compatibility) 및 부품
  충돌(PartConflict) 데이터 CRUD, 회원 목록 조회.

## 기술 스택

**백엔드**
- Java 21, Spring Boot 4 (Spring Web MVC, Spring Data JPA, Spring Security)
- MySQL
- JWT (jjwt), BCrypt
- Jsoup (부품 링크 크롤링)
- springdoc-openapi (Swagger UI)

**프론트엔드**
- React 19, React Router
- Vite
- Tailwind CSS (블루블랙 단일 테마)

## 로컬에서 실행하기

### 사전 준비

- JDK 21 (Gradle이 `settings.gradle`의 foojay-resolver로 자동 프로비저닝도 시도합니다)
- Node.js 18+
- MySQL 서버 (로컬 3306 포트, `ridefit` 데이터베이스)

### 백엔드

```bash
# src/main/resources/application-local.properties.example 를 복사해서
# application-local.properties 를 만들고, 본인 DB 계정/JWT 시크릿으로 값을 채웁니다.
cp src/main/resources/application-local.properties.example src/main/resources/application-local.properties

./gradlew bootRun
```

`application-local.properties`는 `.gitignore`에 포함되어 있어 커밋되지 않습니다.
필요한 값:

| 키 | 설명 | 기본값 |
| --- | --- | --- |
| `spring.datasource.url` / `username` / `password` | MySQL 접속 정보 | - |
| `jwt.secret` | JWT 서명에 쓰는 32바이트 이상의 임의 문자열 | - |
| `jwt.expiration-ms` | 토큰 만료 시간(ms) | `86400000` |
| `AI_SYNTH_MODE` (환경변수) 또는 `ai.synth.mode` | `mock` \| `live` | `mock` |
| `POLLINATIONS_API_KEY` (환경변수) 또는 `pollinations.api-key` | Pollinations API 키 (live일 때만 필요) | (비어있음) |
| `GEMINI_API_KEY` (환경변수) 또는 `gemini.api-key` | Gemini API 키 (live일 때만 필요) | (비어있음) |

처음 실행하면 `DataSeeder`가 Honda Super Cub 110 / PCX 샘플 부품과 호환성 데이터, 테스트
계정(`user@ridefit.dev` / `admin@ridefit.dev`, 비밀번호는 코드의 `DataSeeder` 참고)을
자동으로 넣어줍니다.

API 문서는 백엔드 실행 후 `http://localhost:8080/swagger-ui/index.html` 에서 확인할 수
있습니다.

### 프론트엔드

```bash
cd frontend
npm install
npm run dev
```

기본적으로 `http://localhost:8080` 을 백엔드 API로 사용합니다. 다른 주소를 쓰려면
`frontend/.env` 에 `VITE_API_BASE_URL` 을 설정하세요.

## 화면 스크린샷

_추후 채울 예정입니다._

| 화면 | 스크린샷 |
| --- | --- |
| 홈 | _(placeholder)_ |
| 내 차고 | _(placeholder)_ |
| 호환성 확인 | _(placeholder)_ |
| 커뮤니티 | _(placeholder)_ |
| 관리자 대시보드 | _(placeholder)_ |
