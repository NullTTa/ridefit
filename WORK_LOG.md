# WORK LOG — home-rebuild

집에서 재작업한 내용 정리. 돌아와서 이 파일부터 읽으면 됨.

- 브랜치: `home-rebuild` (이 브랜치에서 전부 작업 후 `main`에 merge, merge까지 commit함. **push는 안 했음** — 직접 확인 후 push할 것)
- 지시사항의 "1~18번 다 만든 뒤 19번 스모크테스트" 순서대로, 그리고 핵심 등급을 우선으로 전부 진행함. 1~20번 **전부 구현 완료**.

## 우선순위 등급 해석에 대해 (먼저 읽어주세요)

지시문의 "우선순위" 문단에 적힌 번호(예: "9번(관리자 CRUD)", "10번(시드 데이터)")가 지시문 본문 자체의 섹션 번호(관리자 CRUD=7번, 시드 데이터=8번)와 어긋나 있었습니다. 번호 대신 **내용(관리자 CRUD, 시드 데이터 등)**을 기준으로 매칭해서, 핵심 등급을 다음으로 해석하고 진행했습니다:

- 핵심: 인증(1), 호환성 검사(3), AI 합성 mock(5), 관리자 CRUD(7), 시드 데이터(8), 스모크 테스트(19), 마무리(20)
- 이 해석이 의도와 다르다면 알려주세요.

결과적으로는 시간이 넉넉해서 20번까지 전부 끝냈기 때문에 이 해석 차이가 실제 결과물에 영향을 주진 않았습니다.

## 무엇을 했는지 (커밋 순서대로)

1. **인증 (JWT)** — Role(USER/ADMIN), Member에 BCrypt 비밀번호/role/email unique. `/api/auth/signup`, `/api/auth/login`. Spring Security + JWT stateless 필터. 차량 등록 등은 클라이언트 memberId가 아니라 JWT의 인증된 사용자로 처리(IDOR 방지). 프론트: 로그인/회원가입 페이지, Authorization 헤더 자동 첨부 API 헬퍼(`lib/api.js`), RequireAuth 가드, 헤더 로그인 상태 UI.
2. **테마** — 다크모드 토글 제거, 블루블랙 단일 테마(`#0B0E14`/`#131824`/`#232B3A`/`#3B82F6`/`#E7ECF3`/`#8B95A8`), 로고만 오렌지(`#FF6B35`) 유지.
3. **호환성 검사 (핵심)** — Part에 `sourceUrl`/`imageUrl` 추가. Jsoup으로 판매 링크 크롤링(제목/가격/이미지, 상품명에서 차종+연식 자동 인식 시도). 크롤링 실패는 정상 상황으로 취급해 수동 입력 폼으로 자연 전환. 자동/수동으로 확정된 차종에 Compatibility 레코드 생성 → "차량 선택 즉시 호환 여부 표시"는 이 레코드 존재 여부로 판정, 호환 안 되면 메시지만 보여주고 다음 단계 차단. 내 차고(Garage), 부품 찾아보기(카테고리 필터), 마이페이지 "최근 확인한 부품" 모두 구현.
4. **부품 충돌 감지** — PartConflict(partA, partB, reason) 최소 구조. 부품 찾아보기에서 여러 부품 체크 후 충돌 확인 가능.
5. **AI 이미지 합성 (핵심)** — `AI_SYNTH_MODE=mock|live`, 기본 mock(고정 SVG 샘플 반환). live 코드는 Pollinations `/v1/images/edits` 호출로 구성해뒀지만 **이번 세션에선 호출 안 함** (지시대로 mock 유지). 서버가 호환성 통과 여부를 다시 검증한 뒤에만 합성 실행. 크롤링+합성 합산 일일 20회 RateLimit. 실패 시 "지금은 이미지를 만들 수 없어요..." 안내로 감쌈.
6. **커뮤니티** — 목록(페이지네이션)/상세(댓글)/글쓰기. 장착 부품 + 호환 여부(맞았어요/안맞았어요) 기록 구조만 마련(Compatibility 자동 반영 로직은 스펙대로 안 만듦).
7. **관리자 CRUD (핵심)** — Compatibility/PartConflict 표 CRUD(둘 다 페이지네이션), 회원 목록(role 조회만, 변경 API는 의도적으로 없음 — ADMIN 전환은 DB 직접 수정 정책), 대시보드 통계 카드(17번도 같이 됨).
8. **시드 데이터 (핵심)** — DataSeeder(CommandLineRunner). Honda Super Cub 110 / PCX, 부품 9개, Compatibility(호환가능/브라켓필요/호환불가 다 포함), PartConflict 2건. 테스트 계정: `user@ridefit.dev` / `user1234!` (USER), `admin@ridefit.dev` / `admin1234!` (ADMIN).
9. **품질 다듬기** — 호환성 판정/PartConflict 필터링 단위 테스트. 실제 MySQL 없이 테스트가 돌아가도록 H2 기반 `test` 프로필 추가. 이 과정에서 `ModelYear.year` 컬럼명이 SQL 예약어와 충돌하던 실버그를 발견해 수정(`model_year_value`로 변경). springdoc-openapi는 이미 추가돼 있어서 별도 설정 없이 `/swagger-ui/index.html` 동작.
11. **Home/로그인/회원가입 애니메이션** — 차량 아이콘 중심 부품 라벨 5개가 8초 주기로 라운드로빈 표시 + 은은한 글로우, 차량 펄스 효과(tailwind keyframes). 로그인/회원가입 좌우 분할, Home은 같은 구조를 풀스크린 히어로로 재사용(비로그인 시 오른쪽에 실제 로그인 폼). 차량 이미지 경로는 `constants/images.js`로 분리해둠 — 나중에 실물 사진으로 교체 시 이 파일만 바꾸면 됨.
12. **화면 다듬기** — 404 페이지 추가. 빈 상태/로딩/유효성 메시지는 각 화면 구현 시점에 함께 처리함(별도 단계로 안 미뤘음).
13. **최저가 비교** — SellerListing 엔티티. "등록된 판매처 중 최저가"이지 실시간 자동 검색이 아님을 UI 문구에도 명시. 기존 크롤링 로직 재사용.
14. **영상 콘텐츠** — 유튜브 링크 임베드(YoutubeEmbed 컴포넌트). Part.installVideoUrl(카테고리별 설치 영상, 관리자가 `/admin/part-videos`에서 등록), Post.videoUrl(게시글 작성자가 등록).
15. **계정 관리 & 편의기능** — 닉네임/비밀번호 변경, 회원 탈퇴(차량/즐겨찾기/기록은 삭제, 게시글/댓글은 작성자 연결만 끊어 익명화 보존). JWT 만료 시 자동 로그아웃 + 로그인 페이지 리다이렉트 + 안내 문구(RequireAuth가 자동 처리). 부품 즐겨찾기(★ 토글, 마이페이지에서 조회/해제). 커뮤니티 글쓰기 사진 첨부(로컬 파일 업로드 → `/uploads/**`).
16. **페이지네이션** — 커뮤니티 목록, 관리자 회원/Compatibility/PartConflict 목록 모두 Spring Data `Page` + 이전/다음 UI로 적용됨 (3번/7번 작업 중 같이 처리).
17. **관리자 대시보드 통계** — 8번에 포함해서 처리함 (회원/차량/부품/게시글 수 카드).
18. **README.md** — 프로젝트 소개/기능/기술스택/로컬 실행법/환경변수 표/스크린샷 자리(플레이스홀더) 작성.
19. **스모크 테스트 (핵심)** — `SmokeTest.java`: 회원가입→로그인→차량 등록→부품 등록(수동 입력 경로)→라이브 호환성 확인→AI 합성(mock)→커뮤니티 글쓰기/댓글→일반 유저 관리자 접근 차단 확인→관리자 로그인→회원/Compatibility 관리 화면 접근→회원 탈퇴까지 MockMvc로 실제 실행. **이 과정에서 실제 버그를 하나 발견해서 고쳤음**: 회원 탈퇴 시 MyVehicle을 먼저 지우면서 그 차량을 참조하는 Post.myVehicle 외래키를 위반해 500 에러가 나고 있었음 → 차량 삭제 전에 관련 게시글의 author/myVehicle 연결을 먼저 끊도록 순서를 고침. 겸사겸사 GlobalExceptionHandler가 예외를 로그도 안 남기고 삼키던 것도 로깅하도록 고침.
20. **마무리** — 이 파일. 아래에 막힌 부분/확인 필요한 부분 정리.

## 막히거나 확인이 필요한 부분

- ~~로컬 MySQL 연결을 실제로 테스트하지 못했음~~ → **[추가 세션에서 해결됨]** 실제 로컬 MySQL(root/1234)로 접속 정보를 받아서 `application-local.properties`에 채우고, JDBC URL에 `createDatabaseIfNotExist=true`를 추가해 `ridefit` 스키마를 앱이 직접 생성하도록 했습니다. `./gradlew bootRun`으로 실제 MySQL에 붙여서 기동 확인, 시드 데이터(제조사/부품 한글 포함) 정상 조회, `user@ridefit.dev` 로그인, Swagger UI(`/swagger-ui/index.html`) 전부 실제로 확인했습니다. `application-local.properties`는 `.gitignore`되어 있어 이 계정 정보는 커밋되지 않았습니다 — 필요하면 직접 다른 계정으로 바꿔도 됩니다.
- **브라우저 스크린샷으로 UI를 직접 보지 못했음.** 이 환경에 `chromium-cli` 같은 브라우저 자동화 도구가 없어서, Home/로그인/회원가입의 애니메이션이나 390px 모바일 레이아웃을 실제로 렌더링해서 눈으로 확인하지는 못했습니다. Tailwind 모바일 퍼스트 컨벤션(그리드 기본 1열, `sm:`/`md:`부터 확장, 테이블은 `overflow-x-auto`)을 지켜서 작성했고 빌드는 항상 통과했지만, 시각적으로 깨지는 부분이 있을 수 있으니 `npm run dev`로 직접 한 번 봐주세요. 특히 애니메이션 타이밍/글로우 위치는 눈으로 미세조정이 필요할 수 있습니다.
- **AI_SYNTH_MODE는 계속 mock입니다.** live 전환용 Pollinations 호출 코드(`AiSynthService.callPollinations`)는 작성해뒀지만, 정확한 요청/응답 스키마는 Pollinations 공식 문서를 보고 검증된 게 아니라 합리적으로 추정해서 작성한 것입니다. 실제로 live로 켜기 전에 응답 파싱 부분(`json.path("data").path(0).path("url")`)이 실제 API 응답 구조와 맞는지 한 번 확인해주세요.
- **차량 사진은 여전히 임시 아이콘(`frontend/src/assets/hero.png`)입니다.** `frontend/src/constants/images.js` 파일 하나만 실제 사진으로 바꾸면 Garage 카드/애니메이션 전체에 반영됩니다.
- 관리자 Compatibility/PartConflict 추가 폼은 부품을 드롭다운(이름만)으로 고르게 되어 있어서, 부품이 많아지면 검색이 안 되는 게 불편할 수 있습니다 — 이번 범위에선 기능 동작까지만 맞췄습니다.
- 의도적으로 안 만든 것 (지시사항대로): 3D 부품 미리보기, 라이브 코칭 화상/음성·실시간 채팅.

## 확인해볼 것 (선택)

- `git log main..home-rebuild`로 커밋 15개 확인 가능. 각 커밋이 기능 단위로 나뉘어 있습니다.
- 로컬 실행 방법은 `README.md` 참고.
