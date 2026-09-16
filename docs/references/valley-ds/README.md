# 모두의계곡 — 설계 패키지

spotts.kr/firework(불꽃축제 지도)을 DevTools로 실측 추출한 디자인 토큰·컴포넌트 규격,
지도 개발 아키텍처, 그리고 계곡 서비스로 옮기기 위한 제품·데이터 설계입니다.

**어디부터 읽을까**

- 화면을 만들 거면 → `index.html` + `tokens/valley-tokens.css`
- 지도를 붙일 거면 → `docs/map-architecture.md` + `src/*.ts`
- 무엇을 만들지 정할 거면 → `docs/product-ideas.md`
- 데이터를 모을 거면 → `docs/data-sources.md` + `data/.schema/`
- **구현 직전이면 → `docs/open-questions.md` 부터.** 아직 검증 안 된 가정이 두 개 있습니다

- 추출일: **2026-09-01**
- 추출 방식: 라이브 DOM / CSSOM / computed style / MapLibre 스타일 JSON 직접 조회
- 추정값 없음 — 문서의 수치는 전부 실측입니다.

## 파일

| 경로 | 내용 |
|---|---|
| `index.html` | 디자인 시스템 문서 (브라우저로 열면 됨). 컴포넌트 라이브 프리뷰 + 다크/라이트 토글 포함 |
| `tokens/valley-tokens.css` | **바로 쓰는 파일.** `--vly-*` 접두사 토큰. import 후 컴포넌트에서 참조 |
| `tokens/spot-tokens.reference.css` | 원본 `--spot-*` 스냅샷. 대조용, 수정하지 말 것 |
| `tokens/map-palette.json` | MapLibre 다크/라이트 팔레트, 마커 색 체계, 라벨 언어 폴백, 겹침 제어 전략 |
| `docs/map-architecture.md` | **지도 개발 분석.** 렌더러 구성·모듈 구조·아이콘 파이프라인·카메라·장애 대응·타일 서빙 |
| `docs/product-ideas.md` | **제품 아이디어.** 킬러 기능 3개·데이터 모델·페인포인트·안 할 것·우선순위 |
| `docs/data-sources.md` | **데이터 소스 카탈로그.** VWorld 레이어 + 정부 OpenAPI를 기능별로 매핑, 좌표계·프록시 규칙 |
| `docs/open-questions.md` | **착수 전 체크리스트.** 검증 안 된 가정, API 신청, 결정 사항, 이번 주 순서, 결정 기록 |
| `data/.schema/valleys.schema.json` | 계곡 구간·시설·혼잡도·경보 JSON Schema 초안 |
| `data/example-valley.geojson` | 스키마를 통과하는 샘플 (계곡 1개 × 구간 3개) |
| `src/lazy-marker-icons.ts` | 지연 마커 아이콘 로더 (`setMissingStyleImageResolver` 패턴) |
| `src/use-map-camera.ts` | 바텀시트 보정 카메라 훅 (`easeTo({offset})` + 거리 비례 duration) |
| `src/base-map-health.ts` | 베이스맵 헬스 감시 + 소스만 재로드하는 재시도 |

`src/*.ts`는 maplibre-gl v6 + react-map-gl 기준으로 쓴 스타터입니다.
프로젝트에 복사한 뒤 호스트 이름(`tileHosts`)과 아이콘 ID 규약만 바꾸면 동작합니다.
이 셋은 **나중에 넣으면 구조를 다 뜯어야 하는 것들**이라 처음부터 깔고 가는 걸 권합니다.

## 빠르게 훑기

**토큰 구조** — 컴포넌트 CSS에 색 리터럴이 하나도 없고, `--vly-color-*` 30개만 교체하면
다크/라이트가 통째로 바뀝니다. 원본이 vanilla-extract 컨트랙트로 같은 구조를 씁니다.

**타입** — Pretendard 한 벌, 11~30px 1px 단위 램프.
행간 공식: `lineHeight = fontSize <= 17 ? fontSize * 1.5 : fontSize + 9` (30px만 +10).
굵기는 400 / 500 / 600 세 단계. 제목·본문 둘 다 15px이고 **굵기와 색으로만 위계**를 만듭니다.

**라운드** — 떠 있는 요소는 전부 `full(9999px)`, 리스트 카드만 `lg(12px)`, 바텀시트 상단만 16px.

**간격** — 8px 리듬 + 4px 미세조정. 카드 내부 패딩은 12px(`smd`), 화면 좌우 인셋은 16px(`md`).

## 컴포넌트 실측값

| 컴포넌트 | 규격 |
|---|---|
| 검색바 | h48 / radius full / bg 80% + `backdrop-filter: blur(14px)` / border 0.67px borderLight / shadow-lg / 상단 인셋 16 |
| FAB | 44×44 원형 / bg background / shadow-lg / 세로 스택 gap 8 |
| CTA 알약 | h48 / padding 0 16 / gap 6 / 15px·600 |
| 하단 GNB | 알약 h50 / 아이템 50×50(pad 6) / 아이콘 26~28 / 활성 foreground·비활성 muted / inset ring + shadow-gnb |
| 바텀시트 | radius 16 16 0 0 / shadow-sheet / 핸들바 36×4 radius full bg border / content padding-bottom = `--gnb-safe-area` |
| 세그먼트 | h40(pad 2) / 아이템 h36 / 활성 bg gray300 + shadow-sm / 15px·600 |
| 리스트 카드 | radius 12 / padding 12 / 카드 간격 8 / 제목 15·600, 설명 12·400 secondary, 메타 12·400 muted |
| 배지 | h22 / padding 2 8 / radius full / 12px·600 |

## 모션

| 용도 | duration | easing |
|---|---|---|
| 색·보더 상태 변화 | 0.15s | `ease` |
| 누름 피드백 | 0.12s | `ease-out` |
| 등장/사라짐 | 0.18~0.2s | `ease-out` |
| 시트·오버레이 | opacity 0.2s / transform 0.32s | `cubic-bezier(.22,1,.36,1)` |
| 시트 스냅·라운드 | 0.2s | `cubic-bezier(.28,1,.6,1)` |

opacity와 transform의 duration을 다르게 겁니다 — 먼저 흐려지고 늦게 이동합니다.

## 레이아웃 규칙

- 브레이크포인트는 `min-width: 768px` **하나**. 나머지는 `hover` / `pointer` / `prefers-*` 능력 질의
- `100dvh` + `viewport-fit=cover` + `user-scalable=no`
- `--gnb-safe-area: 66px` 를 GNB 높이와 시트 하단 패딩이 공유
- 시트 하단 인셋 = `max(--gnb-safe-area, --keyboard-inset-height)`
- 별칭 레이어: 컴포넌트는 `--sbs-surface` 같은 별칭을 보고, 별칭이 `--vly-color-background`를 가리킴.
  컴포넌트를 다른 프로젝트로 떼어갈 때 별칭 한 줄만 다시 연결하면 됩니다

## accent 선택 근거

| 토큰 | 값 | 흰 글자 대비 | 용도 |
|---|---|---|---|
| `primary` | `#0c8b80` | 4.2 : 1 | CTA·활성. 15px/600 이상 |
| `primaryStrong` | `#076a62` | 6.5 : 1 | 12px 이하 소형 텍스트·아이콘 |
| `link` (dark) | `#2fbfb2` | 7.8 : 1 (다크 바탕) | 다크에서 링크·강조 |

원본 `#297cff`는 흰 글자 대비 3.9:1로 본문 AA(4.5:1)에 못 미칩니다. 위 값은 그보다 낫게 잡았습니다.
뉴트럴은 원본(토스 계열)을 그대로 두는 걸 권합니다 — 한국 사용자에게 "익숙한 앱"으로 읽히는 효과가 큽니다.

## 도메인 치환표

| spotts | 모두의계곡 | 메모 |
|---|---|---|
| 관람 Spot (58) | 계곡·물놀이 지점 | tier 컬럼 그대로 필요 |
| 편의시설 (95) | 주차장·화장실·매점·평상·구조대 | 마커 9색 재배치 |
| 따릉이 잔여 3단계 | 주차 여유 / 혼잡도 | 색·아이콘 그대로 재사용 |
| 교통 통제 구간 | 입산 통제 · 물놀이 금지 구역 | 빨강 대시 라인 + control-point |
| 불꽃까지 거리 | 주차장/정류장까지 거리 | 카드 메타 12·400 |
| 오렌지플레이존 폴리곤 | 유료 구역 · 야영 가능 구역 | fill 0.075 / 선택 0.36 |
| 실시간 소식 SSE | 수위·혼잡 제보 피드 | 아이브로우 10·600 danger |

## 계곡에만 추가로 필요한 것

spotts에 없는 축이 **시간**입니다. 계곡은 계절·시간대(오전 한산 → 오후 만차)가 핵심 정보라,
카드 메타 한 줄과 마커 상태색을 시간축에 연동하는 컴포넌트가 하나 더 필요합니다.
`map-palette.json`의 `marker.status3`(여유/보통/혼잡)를 그 자리에 그대로 쓰면 시스템 안에서 해결됩니다.

지도 팔레트도 손봐야 합니다. 원본은 도심 야경 기준이라 `park`가 z9→z12에서 불투명도 0.5→0.2로 줄어드는데,
산·계곡이 주 무대면 반대로 녹지 불투명도를 높이고 `waterway-stream` 라인 폭을 키워 물줄기가 먼저 읽히게 해야 합니다.
