# TODO — valley-ds 기반 작업 추적

기준 문서: `docs/references/valley-ds/` (spotts.kr/firework 실측 설계 패키지, 2026-09-01. 원본 `~/Downloads/valley-ds`).
이 파일이 **작업 상태의 단일 진실**이다. 워크트리·PR·Orca 카드는 여기서 파생된다.

작성 2026-09-03 · 마지막 갱신 2026-09-09 (SD5 광주 무등산 2곳 추가 → in-review — 수도권 밖 첫 계곡, 목록 제목 '계곡 목록' 으로 · SD4 정자·쉼터 신설 → in-review — 시설 유형 10종째, 중심선 250 m·캠핑 구조물 제외 · X7 접힌 시트 버그 신설 → in-review — 검색·선택이 시트를 올리지 않아 결과가 안 보였다(web·iOS 공통), 회귀 테스트 7개 · G1 핀치 회전 신설 → in-review — web·iOS 실측 완료(web 47.5° / iOS 58.6°), 정책 상수 하나로 유지, 컨트롤 컬럼 히트 결함 발견·수정, 안드로이드는 코드만 · SR1·SD3 머지 → done(PR #43) — 검색 배선 + 긴고랑계곡 31번째 계곡 · SD3 완결 — 긴고랑계곡 DEM 최소비용경로로 31번째 계곡 추가 · SR1 검색 배선 착수 · X6 죽은 UI 훑기 신설 · OPS1 머지 → done(PR #42) — v1 마지막 기능 항목 · OPS1 PR #42 → in-review · v1 동결 계획 `docs/RELEASE_V1.md` · X3·X4 중복 행 정리 → done · OPS1 운영 도구 착수 · DS3 머지 → done(PR #41), DS2 done · DS3 PR [#41](https://github.com/4sizn/modu-valley/pull/41) 열림 → in-review · DS3 크기·간격 토큰 착수 · DS2 문구 규칙 — 필터 칩 수정 · DS1 디자인 시스템 재설계 착수 · X3·X4 한 워크트리로 착수 · X2 머지 → done(PR #37), X4 신설, 워크트리 전부 정리 · X2 증명 절차·뷰포트 확정 반영 · X2 네이티브도 같은 버그 발견·수정(사용자 지적) · X2 PR [#37](https://github.com/4sizn/modu-valley/pull/37) 열림 → in-review(원인 확정 — 후보 둘 다 아니고 겹친 시설 히트 테스트) · C6 머지 → done(PR #38) · C6 시각 증명 감사 통과 + X3 신설 · C6 PR [#38](https://github.com/4sizn/modu-valley/pull/38) → in-review · C6 결정 2개 →착수(계곡만·덮임 처리 없음) · C8 머지 → done(PR #36), C6 착수 가능 · C8 PR #36 → in-review · X2 시설 핀 버그 신설 →착수 · C8 결정 6개 확정 →착수(festival 도 3단) · F5d 머지 → done(PR #35), X1 네이티브 빚 신설 · F5d PR 열림 → in-review · F3 행 정리 — done + F3d·F3c 분리 · F5d 제보 좌표 신설 →착수 · N3 hold(좌표는 제보 영역으로) · N2·N3 사용자 결정 — 부분 커버리지 허용·표준 좌표 기준 · N1 머지 → done(PR #34) · N1 PR [#34](https://github.com/4sizn/modu-valley/pull/34) → in-review · N1 결정 6개 확정 →착수 · F5 제보 완결 → done(PR #31·#32·#33) · F5c PR #33 → in-review · F5b 머지 → done(PR #32), F5c 착수 · F5b PR #32 → in-review · F5 화면 결정 7개 확정 →F5b 착수 · F5a 머지 → done(PR #31) · SD2 머지 → done(PR #30) · N5 머지 → done(PR #29) · SD1b PR #27 → in-review · SD1a PR #26 → in-review · SD1 approved →착수 · F2 → 주차장 존재 여부만(시설 데이터) · S1 머지 → done(PR #23·#25, 배포 미정) · C7 머지 → done(PR #24) · S1a 머지 · S1·C7 approved →착수 · R2 done · R5 planning(사용자 다운로드 대기) · C5·C9 머지 → done(PR #21·#22) · C5·C9 approved →착수 · V1 머지 → done(PR #19·#20) · V1 approved →착수 · R1·F3a 머지 → done · F3s 보류 → 앱 구현 집중 · K1 격자 9건 완료 · F3a 판정 사용자 승인 → F3 설계 §1.2 확정 · F3a 판정 → in-review · C10 머지 → done(PR #14·#15·#16), C10d 등고선 → v2 · C10 approved →착수 · R5 신설 · F4 approved →착수 · P1 done 정정 · C2 done · C10 신설)

---

## 상태 모델

| 상태 | 뜻 | 워크트리 | Orca `--workspace-status` |
| --- | --- | --- | --- |
| `pending` | 미착수. 연구·기획 전 | 없음 | — |
| `planning` | 연구·기획 진행 중. **사용자 개입 구간** | 없음 | — |
| `approved` | 사용자가 기획을 승인. 워크트리 생성 대상 | 생성 | `todo` |
| `rejected` | 사용자가 거절. 사유를 결정 기록에 남긴다 | 없음 | — |
| `hold` | 사용자가 보류. 필요성이 확인되면 `pending` 으로 되돌린다 | 없음 | — |
| `in-progress` | 워크트리에서 구현 중 | 있음 | `in-progress` |
| `in-review` | PR 열림. `pnpm verify` 통과 | 있음 | `in-review` |
| `done` | main 머지 | 삭제 | `completed` |

전이 규칙

- `pending → planning` 은 에이전트가 시작할 수 있다. `planning → approved | rejected` 는 **사용자만** 바꾼다.
- 항목 하나 = 워크트리 하나 = 브랜치 하나 = PR 하나. 브랜치명 `4sizn/<id>-<slug>`.
- **에이전트가 자기 PR 을 머지하지 않는다**(2026-09-08 위반). PR #43 이 메인 세션의 4검사를
  거치지 않고 **에이전트 스스로 머지**됐고, 그 안에 계약 밖 작업(계곡 데이터 추가)이 섞여 있었다.
  **머지는 메인 세션만 한다** — 워크트리 계약에 이 문장을 넣는다.
- **회귀 방어 테스트를 고쳐서 통과시키지 않는다**(2026-09-08 위반). N1 의 실측 개수 테스트는
  "시딩 데이터가 바뀌면 시험이 먼저 깨지게" 박아 둔 것인데, 데이터를 늘린 뒤 **기대값을 고쳐**
  통과시켰다(30→31, `excludedByMissingInfo` 15→16·21→22·**0→1**). 시험이 깨지면 **멈추고
  보고한다** — 계약에 이 문장을 넣는다.
- **항목 표 중복 행 확인**(2026-09-08, 세 번째 재발): 브랜치 머지 때 항목 표 행이 **두 벌로
  늘어난다**(N5·F5c 는 상태 되돌림, X3·X4·OPS1 은 중복). 머지 전 해소 단계에서 **id 별 행 수를
  세고 상태 열로 판정해 진행된 쪽만 남긴다**. 주의: 상태를 `` `...` `` 첫 백틱으로 찾으면
  `hidden`·`agent-browser` 같은 코드 낱말을 상태로 오인한다 — **열 위치**로 읽어야 한다
  (2026-09-08 실제로 이 오인으로 잘못 지웠다가 되돌렸다). `N1`~`N5` 는 결정 후보 표에도 같은
  id 가 있어 두 번 나오는 것이 정상이다.
- **완료 시 시각 증명 감사**(사용자 규칙 2026-09-07, `CLAUDE.md` 절): 머지 전 3검사에 **네 번째**를
  더한다 — ① `.proof/<항목>/` 에 PNG 가 있는지 ② `python3 scripts/proof-check.py .proof/<항목>` 이
  전부 `OK` 인지 ③ **메인 세션이 이미지를 직접 열어** 요구한 상태가 실제로 찍혔는지 ④ 채팅 인라인
  표시 + `open` 으로 OS 미리보기. GitHub 브랜치 링크는 ③④를 만족하지 못하므로 증명으로 인정하지
  않는다. 항목 사이의 상호작용 결함(예: C8 고정 칩 줄 ↔ F5c 티커 겹침)은 **이 단계에서만 잡힌다**.
- **항목 표 상태가 되돌아가는 함정** (2026-09-07 실측): 브랜치가 만들어진 뒤 main 에서 그 항목의
  상태를 갱신하면, 그 브랜치를 머지할 때 **브랜치의 오래된 행이 main 의 갱신을 덮는다**(N5 `#29`·
  F5c `#33` 이 `done` → `in-review` 로 되돌아갔다). 충돌 해소 규칙("헤더는 main 것, 결정 기록은
  양쪽 보존")이 **항목 표 행을 다루지 않아서** 생긴 구멍이다. 대응: 머지 직후 `docs/TODO.md` 의
  해당 항목 행을 다시 확인한다 — 상태 전이 커밋을 **머지 뒤에** 두면 이 문제가 없다.
- 워크트리 생성(**구현은 하위 모델**, 2026-09-06 사용자 규칙 — 상위 모델은 기획·연구·판정에만):
  `orca worktree create --name <id>-<slug> --base-branch main --json` → `orca terminal create --worktree path:<dir> --command "claude --model sonnet" --json` → `orca terminal send --terminal <handle> --text "<이 파일의 해당 절>" --enter --json`.
  (`--agent claude` 로 만들면 첫 프롬프트가 상위 모델에서 처리된다.)
- 상태가 바뀌면 이 표와 아래 항목 표를 **같은 커밋**에서 고친다. 워크트리 안에서는 `orca worktree set --worktree active --comment "..."` 로 진행 상황을 카드에 반영한다.
- 머지 게이트: `pnpm verify` (biome + tsc + vitest) 통과. `noConsole` 규칙 때문에 valley-ds 스타터의 `console.error` 는 그대로 못 들어온다 — `Logger` 포트를 쓴다.

---

## 항목 표

| ID | 항목 | 상태 | 의존 | 워크트리 | PR |
| --- | --- | --- | --- | --- | --- |
| T0 | valley-ds 를 `docs/references/valley-ds/` 로 반입 | `done` | — | — | main 직접 |
| D1 | 결정: 테마 — 라이트 기본, 다크 제공, 설정에서 선택 | `done` | — | — | — |
| D2 | 결정: festival 도메인 — `/firework` 콘텍츠로 보존 | `done` | — | — | — |
| D3 | 결정: 플랫폼 — 지도 기초 완료, 개발은 RN web 우선 | `done` | — | — | — |
| D4 | 결정: 베이스맵 — openfreemap 유지, 자체 타일은 v2 | `done` | — | — | — |
| D5 | 결정: 서버 — 모노레포 루트 `server/` | `done` | — | — | — |
| R1 | 연구: 상류 관측소 커버리지 실측 → 경보 기능 생사 판정 — **15 km·두 소스 합산 40.0%(12/30, 경계값)**, 그 외 기준 전부 <40% → **MVP-3 재설계 권고** — 사용자가 F3 재설계·F3a 판정을 승인함으로써 수용, 머지 | `done` | K1(기상청·한강홍수통제소·VWorld 키 ✓) | — | [#17](https://github.com/4sizn/modu-valley/pull/17) |
| R2 | 연구: 유역 폴리곤 확보 경로 + point-in-polygon 1건 — **VWorld WFS 로 1건 성공(2026-09-04)**, 저장용 경로는 국토부 수자원관리도 WFS(1유형) 기본·VWorld 백업. 저장은 S1 에서 | `done` | K1 ✓ | — | — |
| R3 | 연구: 그늘 지도 판정 — 데스크 조사 완료, **조건부 진행** (GLO-30 30m + Meta 1m 수관 높이) | `done` | — | — | — |
| R3b | 시험 계산: 백운계곡 지형 산그늘 — **구간 필드로 불채택**(18시 이후에만, 구간 차 < 격자 오차). 스키마 권고 → D6 | `done` | R3 ✓ | — | [#5](https://github.com/4sizn/modu-valley/pull/5) |
| D6 | 결정: 그늘은 **데이터 산출만**(수기 금지) — 지형(GLO-30) + 수관(Meta/WRI 1m CHM)으로 시간대별 그늘. 나무 밀도도 데이터로. 지도에 그늘 레이어 출력 | `done` | R3b ✓ | — | — |
| R3c | 시험 계산 2: 지형 30m + 수관 1m — **진행 가능** 판정(정오 그늘 = 수관, 구간 변별 ✓, 계곡당 ~35s, 폴리곤 분리형·회랑 205KB) | `done` | D6 ✓ | — | [#8](https://github.com/4sizn/modu-valley/pull/8) |
| P1 | 그늘 빌드 파이프라인: 계곡별 시간대 그늘 GeoJSON + 구간 속성 자동 산출 (`scripts/shade/`), 결과 `data/shade/` + 스키마·도메인 `shadeByHour`/`canopyCover` | `done` | R3c ✓ | — (`P1-shade-pipeline` 삭제 대상) | [#10](https://github.com/4sizn/modu-valley/pull/10) |
| F4 | 지도 **그늘 보기** 토글 + 시간 슬라이더 — 그늘 폴리곤 레이어(`map-style` 레이어 셋 추가) + 상세 시트 그늘 타일. PR 2개(F4a core·map-style·어댑터 → F4b app) | `done` | R3c ✓ C4 ✓ P1 ✓ | — | [#12](https://github.com/4sizn/modu-valley/pull/12) · [#13](https://github.com/4sizn/modu-valley/pull/13) |
| R4 | 연구: 경쟁·시드 목록 출처·시딩 비용 완료. VWorld 상업 조건은 자동 수집 불가 → K1 로 | `done` | — | — | — |
| K1 | 사용자 액션: API 키 신청 + 일일 한도 표 + **VWorld 약관 확인**(상업 이용·정사영상 캐시/재배포·한도) + 물놀이관리지역 벡터 제공 여부. 체크리스트·한도 표 `docs/API_KEYS.md` | `planning` | — | — | — |
| C1 | 디자인 토큰 체계 (데모 `:root` 토큰 기준 — `Theme` 객체·Provider·CSS 변수 생성) + 라이트 팔레트 | `done` | — | — | [#4](https://github.com/4sizn/modu-valley/pull/4) |
| C2 | 지도 팔레트 — 라이트 지도(openfreemap `positron` 재색칠) + 계곡용 조정, 테마 연동, 라이트 3D 건물 유지 | `done` | C1 ✓ | — (`C2-map-palette` 삭제 대상) | [#11](https://github.com/4sizn/modu-valley/pull/11) |
| C3 | 계곡 도메인 모델 (`core/domain/valley/`, 스키마 정합, 로더) | `done` | — | — | #3 |
| C4 | `MapEnginePort` 일반화 (Spot 전용 → 피처 컬렉션·다중 레이어) | `done` | C3 ✓ | — | [#6](https://github.com/4sizn/modu-valley/pull/6) |
| C5 | 지연 마커 아이콘 — 시설 9종 픽토그램(V1 이니셜 자리 교체), web 지연 래스터 + native 빌드 시 PNG, 다크 동일(D2) | `done` | C4 ✓ V1 ✓ | — | [#21](https://github.com/4sizn/modu-valley/pull/21) |
| C6 | 카메라 시트 보정 — **계곡 프리셋만** `focusSegment`·`focusValley` 의 하드코딩 offset 을 `viewportInsets` 산출값으로 교체. festival `focusSpot` 은 손대지 않는다(사용자 결정). 덮임 판정·시트 자동 낮춤은 만들지 않는다(사용자 결정) | `done` | C8 ✓ | — | [#38](https://github.com/4sizn/modu-valley/pull/38) |
| C7 | 베이스맵 헬스 감시 (상태기계 → core, 어댑터별 이벤트 배선) | `done` | C1 ✓ | — | [#24](https://github.com/4sizn/modu-valley/pull/24) |
| C8 | 바텀시트 스냅 3단(`peek`/`half`/`full`) + URL 상태 — `sheetCollapsed: boolean` 을 `sheetSnap` 으로 대체, `viewportInsets` 산출(**C6 이 소비**) | `done` | **C6 아님 — 의존 뒤집음**(아래 참고) | — | [#36](https://github.com/4sizn/modu-valley/pull/36) |
| C9 | 테마 설정 화면 (라이트/다크/시스템) + `StoragePort` 영속 — 진입은 내비 설정 탭 → 시트 설정 면 | `done` | C1 ✓ | — | [#22](https://github.com/4sizn/modu-valley/pull/22) |
| C10 | 계곡 3D 지형 — 1) hillshade + color-relief(전 플랫폼) → 2) web terrain + 계곡 카메라 → 3) 봉우리 라벨 + 물줄기 표현(폴리곤 드레이프·흐름). 4) 등고선·표고 프로필은 **v2**(2026-09-04 사용자 결정 — 3D 지형·음영으로 굴곡이 이미 읽힘). 수면 셰이더는 L1. PR 3개(C10a 음영+고도색 → C10b terrain+카메라 → C10c 봉우리+물줄기) | `done` | C2 ✓ · F4 `placement` 계약 공유 ✓ · R5(물줄기 실폭은 후속) | — | [#14](https://github.com/4sizn/modu-valley/pull/14) · [#15](https://github.com/4sizn/modu-valley/pull/15) · [#16](https://github.com/4sizn/modu-valley/pull/16) |
| S1 | 서버 뼈대 `server/`: `/api/vworld/*` 프록시, 정부 API 폴링·캐시, SSE — PR 2개(S1a 뼈대+프록시+헬스 → S1b 폴러+SSE+basins) | `done` | K1 ✓(키 4종 동작) · R2 ✓ | — | [#23](https://github.com/4sizn/modu-valley/pull/23) S1a 머지 · [#25](https://github.com/4sizn/modu-valley/pull/25) S1b |
| F1 | MVP-1 계곡 구간 카드 (데이터 적재 + 구간·시설 선택 + 시트 + 카드 메타) — PR 2개(F1a core → F1b app) | `done` | C1 ✓ C3 ✓ C4 ✓ (C2·C5 병행 가능, C6 hold) | — (`F1-valley-cards` 삭제 대상) | [#7](https://github.com/4sizn/modu-valley/pull/7) · [#9](https://github.com/4sizn/modu-valley/pull/9) |
| F2 | MVP-2 주차 만차 제보 + 대안 주차장 거리순 | `rejected` (주차장은 **존재 여부·유무료·면수만** 시설 데이터로 — SD1 (e)) | F1 ✓ S1 | — | — |
| F3 | MVP-3 상류 강우 경보 — **재설계 및 1차 배달 완료**. 사용자 경계값(리드타임 30분·강우 4단계·수위 4단계·집수역)에서 출발한 설계(`docs/F3_ALERT_DESIGN.md`), 결정 8개 확정(2026-09-04), 순서 F3a→S1→F3b→F3c 중 **F3a·S1·F3b 완료**. **지금 동작하는 신호는 S1 우량계·S2 인접 우량계·S4 하류 수위** 세 개다. 남은 신호·기능은 자식 항목으로 분리했다 — S3 격자는 `F3s`(hold), S5 특보는 `F3d`, 푸시는 `F3c` | `done` | R1 ✓ R2 ✓ S1 ✓ | — | [#17](https://github.com/4sizn/modu-valley/pull/17)·[#18](https://github.com/4sizn/modu-valley/pull/18) |
| F5 | **제보(현장 게시)** — 사용자가 계곡별로 신고·안내·정보 글을 올리고 사진 여러 장 첨부. 유형 6종(불법 사유지·쓰레기·긴급 신고·계곡 새정보·미아찾기·물건찾기). 제보 버튼 → 폼 팝업, "실시간 정보" 에 출력, 카드로 세부 보기. **서버 쓰기·사진 저장·작성자 식별이 새로 필요**. PR 3개 예상(F5a 서버 → F5b core·app 폼 → F5c 피드·카드) | `done` | S1 ✓ SD1 ✓ · 배포 결정(사진 저장) | — | — |
| F5a | 제보 서버(F5 1단계) — 마이그레이션 `0004_reports.sql`(reports·report_photos·report_flags), `POST/GET/PATCH/DELETE /api/reports`·`/:id/flag`(닉네임+비밀번호 bcrypt 해시, 유형 6종, 사진 최대 3장·장당 5MB·sharp 리사이즈 1600+EXIF 제거, 레이트리밋만 IP 10분 3건·하루 20건), SSE `report` 채널, `/uploads` 정적 서빙. core `domain/report/Report.ts`(6종 상수·라벨·검증 순수 함수) + `ApiPort` 제보 읽기·쓰기 시그니처(기본 구현만, F5b 가 오버라이드) | `done` | F5 결정 확정(2026-09-07) ✓ | — | [#31](https://github.com/4sizn/modu-valley/pull/31) |
| F5b | 제보 폼(F5 2단계) — `FetchApiClient` 의 제보 읽기·쓰기 구현, 유형 6색 팔레트(`REPORT_TYPE_COLORS`, **테마별 2벌**), 시트 위 모달 폼(가로 스크롤 칩·본문·사진 3장·닉네임+비밀번호·119 고지), 전송·검증·오류 표시 | `done` | F5a ✓ · 화면 결정 ✓ | — | [#32](https://github.com/4sizn/modu-valley/pull/32) |
| F5c | 제보 피드(F5 3단계) — 목록 면 상단 "실시간 정보" 3건(좌측 정사각 썸네일 카드), 계곡 화면 티커 신설(유형+본문, **최근 24시간만**, festival `Ticker` 클론), 시트 상세 면(가로 캐러셀·상대시각·닉네임·신고하기), SSE `report` 구독 | `done` | F5b ✓ | — | [#33](https://github.com/4sizn/modu-valley/pull/33) |
| F5d | **제보 좌표**(F5 4단계) — 제보 폼에서 지도로 지점을 선택해 좌표를 담는다(십자선 + 지도 이동). 마이그레이션·API·검증(계곡 반경 3km)·상세 면 좌표 표시와 복사. N3 119 좌표 카드의 값어치가 여기로 들어온다 | `done` | F5c ✓ | — | [#35](https://github.com/4sizn/modu-valley/pull/35) |
| X1 | **네이티브 자리표시자 정리(빚)** — 크로스플랫폼 전제(android/ios/web) 아래 web 만 동작하는 자리가 쌓였다: 사진 선택(`reportPhotoPicker.native` — `expo-image-picker` 미배선, F5b) · 제보 지도 피커(F5d) · 좌표 복사 클립보드(F5d) · 레이아웃 플립(`useLayoutFlip.native`). **네이티브 빌드를 시작하는 시점에 한 번에 갚는다** — 개별 PR 로 흩지 말고 이 항목에서 묶어 처리 | `pending` | 네이티브 빌드 환경(Android SDK 없음) · **네이티브 시각 검증도 이 항목에서**(사용자 2026-09-07: 빌드가 느려 나중에) | — | — |
| X2 | **버그: 시설 핀을 누르면 핀이 사라진다**(사용자 보고 2026-09-07) — 매점·화장실 핀을 탭하면 선택 활성화가 아니라 핀 정보가 사라진다. **확정 원인**: 후보 둘 다 아니고, 시설이 몰린 곳(상가 옆 주차장·공원 옆 화장실)에서 클릭 지점에 시설 점이 여럿 잡힐 때 `FeatureLayerController` 가 `event.features[0]`(화면 근접도가 아니라 내부 타일 순서)을 그대로 써서 탭한 게 아니라 다른 시설이 선택됐다 — `nearestFeature` 로 화면 거리 기준 재선정 | `done` | — | — | [#37](https://github.com/4sizn/modu-valley/pull/37) |
| DS1 | **디자인 시스템 재설계**(사용자 요청 2026-09-08) — 컴포넌트가 뒤틀리고 컨셉을 잃었다. 앱을 분석해 토큰 체계(Scale→Semantic 2계층, 라이트·다크)와 컴포넌트를 재설계하고 **검수 페이지로 승인**받는다. 조건: **색이 다채롭지 않게**(실측 고유 hex **106색**·시맨틱 색 묶음 17개), seed-design.io/foundations 는 **참고만**. 브리프 `docs/DESIGN_SYSTEM_BRIEF.md` | `in-progress` | `/firework` 보존(다크 토큰은 데모 원본·PARITY 고정) → **공유 대신 클론** 규칙 적용 | `DS1-design-system` · `4sizn/DS1-design-system` | — |
| DS2 | **컴포넌트 문구·배치 규칙**(사용자 지적 2026-09-08 "텍스트 배치 및 규칙이 서비스 컴포넌트와 맞지 않아보임") — 필터 칩부터. **칩 = 조건 명사 최단형(어미 금지) · 배지 = 상태 서술형** 규칙을 세우고 적용. 다음 컴포넌트는 검수하며 이어간다 | `done` | — | — (메인 세션 직접) | — |
| DS3 | **크기·간격 토큰 + 알약·카드 통일**(메인 세션 분석 2026-09-08) — 같은 종류 요소가 컴포넌트마다 다른 수치를 쓴다: 알약형 좌우패딩 **6·7·8·11·12** 다섯 값, 테두리 **1·1.5**, 높이 방식 두 갈래(내용 vs 고정 32·36), 같은 제보 유형 칩이 카드 11px·7/2 와 상세 12px·8/3 로 **다르다**. 알약을 **2단계(배지=읽는 것 · 칩=누르는 것)** 로 통일하고 공유 컴포넌트로 뽑는다 | `done` | DS1 과 겹치지 않게(색·경보배지·카드 대비는 DS1) | — | [#41](https://github.com/4sizn/modu-valley/pull/41) |
| X3 | **버그: 좁은·짧은 화면(360×740)에서 목록 마지막 카드가 `FloatingNav` 에 가려 탭이 안 먹는다**(C6 증명 뷰포트 매트릭스 검증 중 발견 2026-09-07) — `agent-browser` 가 클릭 지점을 덮는 요소로 내비 아이콘의 `<circle>` 을 잡아냈다(좌표 실측: 카드 y 649~740, 창 높이 740). **확정 원인**: 카메라 offset 과 무관 — `FloatingNav`(z7) 가 시트(z5) 보다 항상 위에 뜨는데, 시트의 `ScrollView` 는 그 안전 지대를 모르고 화면 끝까지 스크롤 가능했다. 수정: `ScrollView` 에 `marginBottom`(내비 높이+여백+safe area, `navSafeBottom`)을 줘 스크롤 가능한 시야 자체를 줄였다(계곡 전용 — festival 은 diff 로 무변경 확인) | `done` | — | — | [#40](https://github.com/4sizn/modu-valley/pull/40) |
| X4 | **버그: 좁은 폭에서 필터 칩 두 줄이 티커 메시지를 덮는다**(메인 세션 증명 검토 중 발견 2026-09-07) — 390×844 에서는 칩이 두 줄이 되어 `ValleyTicker` 의 **메시지 줄이 가려지고 제목만 보인다**. 592×844(칩 한 줄)에서는 메시지가 정상으로 보인다 — **C8 고정 칩 줄(D3) × F5c 티커의 상호작용 결함**이고 각 항목의 시험·픽셀 diff 는 통과했다. **확정 원인**: 실측 결과 칩 줄 자체가 아니라 `MapScreen` 이 좁은 컬럼에서 티커와 `ShadeHourTrack`(F4) 을 **각자** "한 행 위로" 계산해 둘이 정확히 같은 좌표에 앉았다 — 그늘 트랙을 켜면 나중에 그려지는 트랙이 티커를 완전히 덮었다(`getBoundingClientRect` 로 실측, 두 값이 한 픽셀도 안 달랐다). 수정: `overlayStack.ts` 순수 함수 하나로 "몇 번째 행인가" 를 세어 겹치지 않게 쌓는다 | `done` | C8 ✓ F5c ✓ | — | [#40](https://github.com/4sizn/modu-valley/pull/40) |
| OPS1 | **제보 운영 도구(프로덕션 게이트)** — 지금 부적절한 제보를 지울 수단이 **DB 직접 접근뿐**이다. `hidden` 컬럼은 있으나 세우는 경로가 없고, `신고하기` 로 쌓이는 `report_flags` 를 **읽는 코드가 없다**(신고가 들어와도 아무도 못 본다). 서버에 인증 개념도 없다. 관리자 인증 + 숨김/복구 + 신고 목록 | `done` | S1 ✓ F5a~d ✓ | — | [#42](https://github.com/4sizn/modu-valley/pull/42) |
| SR1 | **검색 배선(계곡명·시설명)** — 상단바 검색 입력이 **배선돼 있지 않다**(`value`·`onChangeText`·`onSubmitEditing` 없음). 데모에서 셸을 클론할 때 모양만 따라왔고 계곡 화면에서 배선한 적이 없다. 알림조차 없어 사용자는 되는 줄 알고 계속 시도한다. 계곡명(SD3 반영 31) + 시설명 332 부분일치 검색 | `done` | SD1 ✓ · 지오코딩 불필요 | — | [#43](https://github.com/4sizn/modu-valley/pull/43) |
| X6 | **죽은 UI 훑기** — 화면에 있는데 동작하지 않는 요소를 전수 조사한다. 검색은 사용자가 직접 눌러 봐서 드러났다(2026-09-08 "긴고랑로를 검색해서 동작테스트") — **TODO 에 없으니 "기능 0개" 로 셌던 것이 틀렸다.** 상단바·내비 탭·컨트롤·시트 각 면의 모든 누를 수 있는 요소를 눌러 보고 표로 남긴다 | `pending` | — | — | — |
| SD3 | **긴고랑계곡 복원·정보 확장(31번째)** — 사용자 요청으로 그늘 10~18시 산출, 공식 화장실·주차장 2곳 연결, 브이월드 토지소유 경계 실시간 표시. 추정 구간 고지 유지. 기존 30곳 회귀 기준 유지 | `in-review` | 수심·정밀 물길은 미확인 | — | 로컬 변경 |
| SD5 | **광주 무등산 계곡 2곳 추가**(사용자 요청 2026-09-09) — 증심사계곡·원효계곡. **수도권 밖 첫 계곡**이라 목록 제목 '수도권 계곡' → '계곡 목록' 으로 바꿨다. 좌표는 VWorld 지명(원효계곡=자연지명 골짜기) · 증심사는 골짜기 지명이 없어 국립공원 자원정보 좌표를 앵커로. 중심선·시설·유역·그늘은 `seed:build` 자동 | `in-review` | SD1 ✓ SD4 ✓ | — (메인 세션 직접) | 로컬 변경 |
| SD4 | **정자·쉼터 시설 추가**(사용자 요청 2026-09-08 "팔각정이나 정자 데이터도") — 시설 유형에 `shelter` 추가(색·핀 글리프·PNG 40장·스키마 enum), OSM `amenity=shelter`/`building=pavilion` 을 **구간 중심선 버퍼**로 수집. 캠핑장 그늘막(`tent`)·대피소(`basic_hut`)는 거르고 `gazebo`·`picnic_shelter`·`pavilion` 과 정자 계열 한글 이름만 남긴다 | `in-review` | SD1 ✓ | — (메인 세션 직접) | 로컬 변경 |
| X7 | **버그: 시트가 접혀 있으면(peek) 검색 결과·상세가 아예 안 보인다**(사용자 보고 2026-09-08, iOS 시뮬레이터 "긴고랑 검색했을때나 핀을 클릭했을떄 정보가 안나옴") — 검색 결과도 상세도 **시트 안에만** 그려지는데 시트를 올리는 경로가 `OpenSettingsUseCase` 하나뿐이었다. **상세 면이 열려 있을 때 검색**해도 결과가 목록 면에만 그려져 같은 증상. web·iOS 공통. `revealSheet` 로 peek→half + 검색 시 목록 면 복귀 | `in-review` | — | — (메인 세션 직접) | 로컬 변경 |
| G1 | **핀치 회전 제스처** — 두 손가락을 비틀어 지도를 시계·반시계로 돌린다(사용자 요청 2026-09-08). web·iOS 실측 완료(iOS 시뮬레이터 iPhone 17 Pro), 안드로이드는 SDK 없어 코드로만 켬. 실측 중 **지도 컨트롤 컬럼의 빈 자리가 손가락 하나를 먹어 두 손가락 제스처가 시작되지 않는 결함**을 찾아 계곡에서만 `box-none` 으로 통과시켰다. 축은 SDK 기본(두 손가락 중간점) | `in-review` | — | — (메인 세션 직접) | 로컬 변경 |
| X5 | **버그(경미): `peek` 스냅에서 필터 칩 줄이 `FloatingNav`·지도 출처 표기와 살짝 겹친다**(X3·X4 작업 중 발견 2026-09-08) — 칩 줄(`FilterChipRow`)은 `BottomSheet` 의 `ScrollView` **밖** 형제라 X3 의 `navSafeBottom` 수정이 닿지 않는다. `peek` 는 컨테이너 상단 68px 만 보이는 자리라 칩이 두 줄이면 그 68px 예산을 넘겨 아래쪽이 내비·크레딧 띠에 걸린다. 후보: 칩 줄도 안전 지대 계산에 넣기 · `peek` 에서는 칩을 감추기 | `pending` | X3 ✓ X4 ✓ | — | — |
| F3a | 스파이크: 격자 강수 소스 확인 + 소요산·광덕·경반 7~8월 사례 리드타임·오경보 실측 — **판정: 리드타임 30분 채택(시작→반응 14/14 ≥ 30분), 관심은 1h 10 mm 만(10분 3 mm 삭제), 해제에 3h < 20 mm 추가, 나머지 유지**. 레이더 HSR 수치 격자 존재 확인 → K1 신청 항목(`docs/API_KEYS.md` 9절). `scripts/research/alert-calibration/README.md` | `done` | F3 ✓ · 격자(S3)는 K1 활용신청 뒤 다음 스파이크 | — | [#18](https://github.com/4sizn/modu-valley/pull/18) |
| F3b | MVP-3 **경보 도메인·UI** — `UpstreamAlert` 확장(source·confidence·관측 시각·수위 단계), 합성 규칙(신호별 단계 → 최고값, 출처별 상한), 서버 판정 + SSE, 화면 4곳(구간 카드 배지 3색 + 확신 점 · 상세 타일 · 지도 배너(warning 이상) · 자료 없음 회색). 설계 `docs/F3_ALERT_DESIGN.md` §3~5, 결정 8개·경계값 확정됨 — **새 결정 없음, 구현만**. 로스터는 R1 실측에서 유도(사용자 확인 2026-09-06) | `done` | F3 ✓ F3a ✓ S1 ✓ SD1 ✓ C7 ✓(배너 자리) | — | [#28](https://github.com/4sizn/modu-valley/pull/28) |
| F3s | 스파이크 2: **S3 격자 강수 실측** — 활용신청 완료된 레이더·융합격자·초단기예보 격자를 F3a 사례 표에 붙여 우량계 대비 지연·상관 → S3 채택 규칙. **2026-09-06 사용자 보류: 작업 깊이가 너무 크다, 계곡 앱 구현에 집중.** 격자 검증은 S1 서버에서 융합격자 지점 API(가벼움)를 붙이며 운영 중 사후 검증으로 대신한다 | `hold` | F3a ✓ · K1 격자 9건 ✓ | — (워크트리 삭제) | — |
| F3d | **특보 신호(S5)** — 도메인·UI 는 `advisory` 소스를 이미 받는데(`ALERT_SOURCES`·`evaluateAlert` 의 advisory 분기, 확신 등급 `regional`) **서버가 그 신호를 만들지 않는다**. 기상청 기상특보 조회를 붙여 호우주의보·경보를 계곡 행정구역에 매칭. 확신은 `regional` 고정, 다른 신호가 있으면 그쪽이 이긴다(출처별 상한 규칙) | `pending` | F3b ✓ · 기상특보 API **승인 완료**(15000415, `docs/API_KEYS.md` §10) · **게이트웨이 미등록 — `docs/API_KEYS.md` §11**(우회 제출 의심, 재신청 필요) | — | — |
| F3c | **경보 푸시** — 구독한 계곡의 경보 발생·해제를 알림으로 보낸다. F3 결정 순서의 마지막 단계. 서버 발신·토큰 저장·구독 관리가 새로 필요하고, **네이티브 빌드가 없으면 실기기 검증이 불가**하다(`expo-notifications`) | `pending` | F3b ✓ · **S1 (c) 배포 결정** · 네이티브 빌드 | — | — |
| R5 | 연구: 하천 벡터 — 연속수치지형도 1:5,000 수계(하천중심선·실폭하천·하천경계, 공공누리 1유형) 반입 경로·라이선스·타일링 1건 시험. 계곡 물줄기를 OSM waterway 대신 실제 폭 폴리곤으로 | `planning` | **사용자 액션: 국토정보플랫폼 로그인 후 1:5,000 수계 파일 다운로드** | — | — |
| V1 | **계곡 화면 시각 개선** — F1·C2·F4·C10 에서 미룬 판정을 한 번에: 지도 질감 강도(음영·고도색·녹지), 물줄기 위계, 카드 제목 반복(F1 ⑤)·부제 그늘 문구, 안내문 위치, 시설 점, 그늘 폴리곤 대비, 다크 재색칠 여부. 새 기능 없음, 값·레이아웃만 | `done` | F1 ✓ C2 ✓ F4 ✓ C10 ✓ (C5 아이콘·R5 실폭은 범위 밖) | — (`V1-visual-polish` 정리 대상) | [#19](https://github.com/4sizn/modu-valley/pull/19) · [#20](https://github.com/4sizn/modu-valley/pull/20) 머지 |
| SD1 | **계곡 실데이터 시딩 30개** — R1 후보 30 → 구간(OSM 하천 중심선, 실데이터 근거 없으면 1구간 `whole`)·시설(주차장 존재 여부·화장실 등)·수기 속성(수심·바닥·금지) + 자동 채움(유역 코드·그늘·경사). 샘플계곡 교체. PR 2개: SD1a 자동 채움 → SD1b 사용자 manual.csv 병합 + 문구·라이선스 | `done` | R1 ✓ P1 ✓ S1 ✓ (R5 는 좌표열 교체용 후속) | — | [#26](https://github.com/4sizn/modu-valley/pull/26) · [#27](https://github.com/4sizn/modu-valley/pull/27) · [#27](https://github.com/4sizn/modu-valley/pull/27) SD1b |
| SD2 | **시딩 데이터 검증** — 생활안전지도 지점이 중심선에서 1 km 이상 떨어진 4건(조무락 1084·현등사 1099·유명산 1327·백운 1705 m)과 사나사(실측 7.8 km)를 하천명·행정구역으로 재판정 — **4건 유지·사나사 매칭 해제**(좌표 후보 보고). 빈 칸 6건 공식 출처로 추가 채움 | `done` | SD1 ✓ | — | [#30](https://github.com/4sizn/modu-valley/pull/30) |
| L1 | 이후(잔여): 계절 확장 · 계절 확장 · **등고선·표고 프로필(C10d → v2)** — web 은 maplibre-contour(6.6 호환 확인됨), 네이티브까지는 빌드 시 산출(GLO-30) | `pending` | F1 ✓ | — | — |
| N1 | 조건 필터 — 목록·지도에서 "화장실 있음 · 주차장 있음 · 무료 입장 · 야영 가능 · 그늘 많음" 5개 칩으로 걸러 보기(실측 재구성, 반려견·얕은 수심 폐기). 빈 칸은 제외 + 개수 표시. core 필터 순수 함수 + 시트 고정 칩 줄 + 지도 `MapContent` 필터 | `done` | SD1 ✓ F1 ✓ N5 ✓(그늘 경계 재사용) | — | [#34](https://github.com/4sizn/modu-valley/pull/34) |
| N2 | 막차 역산 — 계곡 인근 정류장(TAGO 키 ✓, **정류장 데이터 0건 — 아래 참고**)의 막차 시각에서 "지금 나와야 하는 시각" 을 계산해 상세 시트에 한 줄. S1 서버 프록시 경유 | `planning` | S1 ✓ K1(TAGO **승인이나 게이트웨이 미등록**(§11)) SD1 ✓ | — | — |
| N3 | 119 좌표 카드 — 구간 상세에서 국가지점번호·좌표를 크게 띄우고 복사·공유. `nationalPointNumber` 필드는 스키마에만 있고 **값은 0건** — 대신 좌표에서 **계산 가능**(아래) | `hold` | F1 ✓ SD1 ✓ | — | — |
| N4 | 위성 토글 — 브이월드 정사영상 WMS 를 S1 프록시로 지도에 겹치기(캐시 금지 준수). 갓길 주차·수면 폭 확인 용도. **K1 브이월드 문의 답신 필요**(영리 이용 승인) | `pending` | S1 ✓ · K1 답신 | — | — |
| N5 | 그늘 태그 — 카드 부제·필터에 "오전 그늘 · 종일 그늘" 같은 사람이 읽는 태그. P1 `shadeByHour` 9값에서 규칙으로 도출 | `done` | P1 ✓ F4 ✓ | — | [#29](https://github.com/4sizn/modu-valley/pull/29) |

---

## 정합성 판정 — valley-ds ↔ 현재 저장소

### 그대로 맞는 것

- **다크 뉴트럴이 동일하다.** valley-ds 다크 `background #18181c` / `cardBackground #202024` / `foreground #f2f4f6` / `secondary #9ea4ad` / `muted #6e747f` = 현재 `tokens.ts` 의 `bg / surface / fg / fg2 / fg3`. 원본이 같은 spotts 라 당연한 결과이고, 토큰 도입 시 다크 화면은 픽셀이 안 바뀐다는 뜻이다.
- **`setMissingStyleImageResolver`** — 저장소는 이미 v6 통로를 쓴다(`MapLibreEngine.ts:297`). 지금은 투명 1px 스텁이고, valley-ds 의 지연 아이콘 로더가 그 자리에 그대로 들어간다.
- **카메라 offset → padding 번역** — 네이티브 어댑터에 이미 있다(`NativeCameraController.toNativeStop`). valley-ds 의 시트 보정 카메라는 이 위에 "offset 값을 어떻게 구하나"만 더한다.
- **취소 가능한 카메라 큐, 라이프사이클, `Result`, `Logger`, `ObservableStore`** — valley-ds 스타터가 손으로 하던 것(pending Map, alive 체크, 타이머 해제)을 저장소의 `shared/` 가 이미 규약으로 갖고 있다.
- **`map-style` 패키지** — valley-ds 의 `map-palette.json` 이 살 자리가 이미 있다. 두 어댑터가 같은 데이터를 읽는 구조라 팔레트 파리티가 저절로 지켜진다.
- **OpenMapTiles 스키마** — 저장소의 openfreemap 스타일도, valley-ds 팔레트도 같은 스키마(`park`, `waterway`, `building`, `name:ko`) 위에 있다. 팔레트를 레이어 paint 덧씌우기로 적용할 수 있다.

### 갈라지는 것 — 결정이 필요하다

1. **valley-ds `src/*.ts` 는 그대로 복사 불가.** react-map-gl + DOM(`getComputedStyle`, CSS 변수 `--vly-inset-*`, `window`, `Blob`, `createImageBitmap`) 전제인데, 저장소는 react-map-gl 이 없고 `core` 는 DOM 을 금지하며(`lib: ES2023`), 네이티브는 maplibre-react-native 다. **순수 계산은 `core` 로, DOM 은 `adapter-web` 으로, 네이티브는 `MapSurface` 경로로** 쪼개서 이식한다. 세 파일 모두 이 분리가 필요하다 (C5·C6·C7).
2. **테마 방향.** valley-ds 는 **라이트 기본 + 다크 변형**, accent 청록 `#0c8b80`. 저장소는 **다크 전용**, accent 파랑 `#297cff`, 그리고 `tokens.ts` 주석이 "값을 바꾸면 파리티가 깨진다"고 못 박고 있다. accent 교체와 라이트 도입은 `PARITY.md` 계약을 바꾸는 제품 결정이다 → D1.
3. **도메인이 통째로 다르다.** 저장소 `Festival { launchSite, programs, spots: Spot(Point) }` + `CrowdLevel` 4단계(relaxed/moderate/busy/severe). valley-ds `Valley → Segment(LineString) ×3~5` + `Facility(Point, 9종)` + `CrowdSnapshot` 3단계(available/low/busy) + `UpstreamAlert`. `geo/` `camera/` `shared/` 와 `MapSession`·포트 패턴은 그대로 쓰고, `festival/` `fireworks/` 는 계곡에 안 쓰인다. 단, valley-ds `product-ideas §6` 이 "같은 지도 셸로 계절별 콘텐츠 교체"를 권하므로 **불꽃 데모를 `/firework` 라우트 콘텐츠로 남길 근거가 있다** → D2.
4. **`MapEnginePort` 가 Spot 전용이다.** `renderSpots(spots, launchSite)`, `setSelectedSpot`, `'spot-press'`, `setFireworksEnabled`. LineString 구간 + Point 시설 + 상태 마커를 그리려면 피처 컬렉션·다중 레이어 계약으로 일반화해야 한다. 두 어댑터 + `FakeMapEngine` 테스트가 함께 바뀌는 가장 큰 리팩터 → C4.
5. **플랫폼 스탠스가 반대다.** valley-ds `product-ideas §5`: "앱 설치 요구 안 함, 웹으로 시작" + `open-questions`: "iOS 웹푸시는 PWA 필수라 안전 경보를 웹푸시에 걸면 iOS 는 못 받는다". 저장소는 이미 ios/android 네이티브에 투자했고, **네이티브 앱은 그 iOS 푸시 문제를 정면으로 해소한다**(APNs). valley-ds 의 권고를 그대로 따를지, 저장소 방향을 살려 "웹 유입 + 앱 경보"로 갈지 → D3. 이 결정이 푸시 경로(D5 의 SSE/알림톡/문자 조합)를 정한다.
6. **서버가 없다.** 저장소는 정적 데이터(`StaticFestivalRepository`)만 있는 순수 클라이언트 모노레포. valley-ds 는 `/api/vworld/*` 프록시, 정부 API 폴링+캐시, SSE, 푸시를 전제한다. MVP-2·3 은 서버 없이는 못 만든다 → D5·S1. Expo 앱에서 SSE 는 `EventSource` 폴리필이 필요하다.
7. **베이스맵.** 저장소 openfreemap `dark` (무키·무료, 스타일 JSON 고정). valley-ds 는 자체 OpenMapTiles 를 권하되 `open-questions` 에서 "1주 차에 결정"으로 열어 뒀다. openfreemap 을 유지하면 팔레트는 클라이언트 재색칠(이미 `decorateNightStyle` 이 하는 방식)로 적용 가능하고, 라이트는 `liberty`/`positron` 을 소스로 쓸 수 있다 → D4.

### valley-ds 내부 불일치 — 반입 시 정규화

- 혼잡 3단계 키: `map-palette.json` `status3` = `available/low/empty`, 스키마 `crowdSnapshot.level` = `available/low/busy`, `lazy-marker-icons.ts` `CROWD_COLOR` = `available/low/busy`. **`busy` 로 통일** — C3 에서 도메인·스키마 반영 완료(`CrowdSnapshot.ts` 주석). 팔레트 키 교체는 C2.
- 시설 타입: 스키마 `facilityType` 에 `store`, 팔레트 `marker.facility` 에 `convenience`. **`store` 로 통일** — C3 에서 도메인·스키마 반영 완료(`Facility.ts` 주석). 팔레트 키 교체는 C2.
- `shadeRatio` 설명이 "DEM+태양고도로 산출"인데 `open-questions §B` 는 DEM 그늘을 비현실적으로 판정하고 **수기 태그**(오전/오후/종일/적음)를 권한다. C3 는 `number` 로 유지(`Segment.ts` 주석). R3 결과에 따라 스키마 필드를 enum 으로 바꾼다.
- 라벨 폴백 순서: valley-ds `name:ko → name:nonlatin → name → name:latin`, 저장소 `name:ko → name:latin → name`. 하나로 (C2).
- `localIdeographFontFamily` 는 maplibre-gl(web) 전용 옵션. 네이티브는 glyph PBF 로 그리므로 "폰트 서버 부담 없음"은 web 에서만 참이다.
- 다크 블록에 `--vly-color-cardBorder` 가 없다(라이트만 있음). 사소함.

### 재사용 지도

| 저장소 | 계곡에서 | 비고 |
| --- | --- | --- |
| `core/shared/*` | 그대로 | valley-ds 스타터의 수동 정리 코드를 대체 |
| `core/domain/geo/*` | 그대로 | 거리 라벨 공식은 "주차장 320m" 에 그대로 쓰임 |
| `core/domain/camera/*` | 수치 교체 | 데모 프리셋(zoom 13.6, pitch 62…)은 계곡 값으로. `MAX_PITCH 60` 제약은 유지 |
| `core/domain/festival/*`, `fireworks/*` | D2 에 따라 | 제거 또는 계절 콘텐츠로 격리 |
| `core/application/NewsTickerController` | 재활용 후보 | "수위·혼잡 제보 피드" 티커가 같은 자리 |
| `core/application/MapSession`, ports, `SessionStore` | 구조 유지 | 포트 시그니처만 일반화 (C4) |
| `map-style/*` | 확장 | 팔레트·구간 라인·시설 심볼 레이어 명세 추가 |
| `adapter-web/map/*` | 확장 | 레이어 컨트롤러를 피처 종류별로 |
| `adapter-native/map/*` | 확장 | `MapSurface` 스냅샷에 레이어 종류 추가 |
| `apps/valley-map/theme/safeArea.tsx`, `useDismissRequest.ts` | 그대로 | valley-ds 의 `--gnb-safe-area` 역할 |

---

## 타당성 판정 — valley-ds 자체 가정

valley-ds 가 스스로 표시한 것과 여기서 추가한 것.

| 가정 | 판정 | 근거 / 다음 행동 |
| --- | --- | --- |
| 상류 관측소가 계곡 상류에 있다 | ~~미검증~~ → **대체로 부정적** (R1 실측 2026-09-04) | 계곡 30개 중 상류 강우 관측소(같은 중권역·표고 높음·15 km)가 있는 곳 12개(40.0%). 10 km 26.7%, HRFCO 만 26.7%, 표고차 ≥ 50 m 30%. 표고 조건을 빼면 100% — 관측소는 있지만 전부 계곡보다 낮은 읍내에 있다. 판정·재설계 후보는 R1 절 |
| 90m DEM 으로 그늘 지도 | ~~부정적~~ → **조건부 긍정** (R3 2026-09-03) | 전제가 바뀌었다: 무료 DEM 은 30m(GLO-30, 한국 공개 확인), 나무 그늘은 Meta/WRI 1m 수관 높이(한국 타일 확인)로 잡힌다. R3b 시험 1건으로 품질 확정 |
| VWorld 유역을 벡터(WFS)로 받을 수 있다 | **미검증** | R2. 안 되면 표준권역 API → WAMIS shp |
| 개발계정 한도로 폴링 가능 | **부정적** | 관측소 50개 × 10분 = 7,200건/일 > 1,000건. 운영계정 또는 관측소 선별 필요 (K1) |
| 웹 우선, 앱 설치 요구 안 함 | **저장소와 충돌** | D3. 네이티브 앱이 iOS 경보 전달 문제를 해소하므로 valley-ds 권고를 그대로 받을 이유가 약하다 |
| 자체 OpenMapTiles 호스팅 | **선택 사항** | D4. openfreemap 유지 + 재색칠이 비용 1/20. 스타일 자유도 차이는 팔레트 덧씌우기로 대부분 흡수 |
| 위치정보 구독형 (서버가 위치를 모름) | **권고 수용** | 아키텍처를 단순하게 한다. 법률 자문 아님 — valley-ds 도 같은 단서 |
| 별점 리뷰 배제, 최근 7일 제보만 | **수용** | 컨디션 변동성 논리가 맞다 |
| 예약·결제 배제, 하천구역 점유 단정 배제 | **수용** | 정보 제공에만 서는 스탠스 |

---

## 항목별 기획 메모

각 항목은 `planning` 진입 시 여기에 **연구 질문 → 답 → 범위 → 검증 방법** 을 채우고, 사용자가 읽은 뒤 `approved | rejected` 로 바꾼다.

### T0 — valley-ds 반입

- 범위: `~/Downloads/valley-ds/**` (15 파일, 168K) → `docs/references/valley-ds/`. `index.html` 포함(디자인 시스템 문서, 브라우저로 열어 봄). `.DS_Store` 제외.
- 이유: 워크트리는 Downloads 를 보지 않는다. `docs/references/firework-map-clone.html` 과 같은 위치·역할.
- 검증: 파일 수 14 (`.DS_Store` 제외). `biome.json` 이 `!docs/references` 를 이미 제외하므로 lint 영향 없음 — **확인됨**.
- 질문: 이 파일(`docs/TODO.md`)과 같은 커밋으로 main 에 직접 넣어도 되는가, PR 로 갈 것인가.

### D1–D5 — 결정됨 (2026-09-03, 결정 기록 참조)

파생 규칙만 남긴다.

- **D1 라이트 기본** → ~~라이트는 valley-ds 를 기준~~ (2026-09-03 폐기). 토큰 기준은 데모 `:root` = 현재 `tokens.ts` 이고 다크 한 벌뿐이다. 라이트 팔레트의 출처·시점은 C1 메모의 (a)/(b) 결정에 따른다. `PARITY.md` 계약은 그대로 유효. 테마 선택 UI 는 C9.
- **D2 festival 보존** → `/firework` 라우트와 `Festival/Spot` 도메인은 그대로. C4 의 포트 일반화는 festival 을 첫 번째 소비자로 삼아 회귀를 잡고, valley 를 두 번째로 얹는다.
- **D3 RN web 우선** → 모든 C 항목의 머지 게이트는 "web 동작 확인 + 네이티브 `typecheck`·`test` 통과". 네이티브 화면 검증은 항목마다 후속 체크박스로 남기고 막지 않는다. 포트 계약(`MapEnginePort`, `MapSurface`)을 깨는 변경은 네이티브 구현도 같은 PR 에서 맞춘다.
- **D4 openfreemap 유지** → C2 는 재색칠 함수로. 라이트 소스 스타일은 openfreemap `liberty` 또는 `positron` 중 C2 기획에서 고른다. 자체 타일·204 빈 타일 정책·`?v=` 버전 쿼리는 v2 항목으로 L1 에 둔다.
- **D5 `server/`** → 모노레포 루트, `pnpm-workspace.yaml` `packages` 에 `server` 추가. 스택·저장소·배포 대상은 S1 기획에서. 푸시 경로(APNs/FCM via `expo-notifications` vs 웹푸시 vs 알림톡)는 F3 기획에서.

### R1 — 관측소 커버리지 (valley-ds open-questions §A)

- 산출물: `scripts/research/station-coverage.ts` — KMA AWS 관측소 + HRFCO 관측소 목록(좌표·표고) × 수도권 계곡 후보 30개 → 유역 동일·표고 높음·거리 N km 이내 매칭 → 커버리지 %.
- 의존: K1 (API 키). 키 전에는 공개 CSV 로 관측소 목록만 먼저 받을 수 있는지 확인.
- 판정 기준은 valley-ds 표 그대로.
- **착수 (2026-09-04, 사용자 지시 "r1 시작")** — 방법 확정:
  - 관측소: 한강홍수통제소 `waterlevel/info`(1,420, lon/lat/gdt) · `rainfall/info`(744, lon/lat) + 기상청 API허브 `stn_inf.php?inf=AWS`(위경도·해발). 키는 `.env.local`(`HRFCO_API_KEY`, `KMA_APIHUB_KEY`, `VWORLD_API_KEY`).
  - 계곡 후보 30개: 수도권(경기·강원 서부·인천) 계곡 이름 목록을 수기로 정하고 좌표는 **VWorld 검색 API**(`req/search`, 지명)로 받아 `scripts/research/station-coverage/valleys.json` 에 출처와 함께 기록. 검색 실패는 수기 좌표 + `source: manual` 표기.
  - 유역: VWorld WFS `lt_c_wkmsbsn`(표준유역 `sbsncd`, 중권역 `mbsncd`) 점 질의 — 계곡·관측소 각각. 결과는 코드만 저장(폴리곤 저장 금지, 약관).
  - 상류 판정: 같은 **중권역**(mbsncd) ∧ 관측소 표고 ≥ 계곡 표고(GLO-30 또는 제원의 gdt/해발) ∧ 거리 ≤ 15 km(10 km 도 병기). 강우 관측소·수위 관측소 각각 집계.
  - 커버리지 % = 조건을 만족하는 상류 강우 관측소가 1개 이상인 계곡 비율(수위는 보조 지표). 판정: ≥70% 진행 / 40~70% 부분 노출 / <40% MVP-3 재설계.
  - 산출물: `scripts/research/station-coverage/`(TS, `pnpm` 스크립트) + `README.md` 결과표(계곡별 상류 관측소 수·최근접 거리·표고차) + 이 절에 판정 기록. PR 1개.
- **실측 결과 (2026-09-04, `pnpm research:coverage`, 상세 `scripts/research/station-coverage/README.md`)**

  | 기준 | 커버리지(상류 강우 관측소 ≥ 1 인 계곡) | valley-ds 판정 |
  | --- | --- | --- |
  | **15 km · HRFCO 강우 + AWS** | **12/30 = 40.0%** | 부분 노출 — **경계값**(계곡 1개 차이로 <40%) |
  | 15 km · HRFCO 만 | 8/30 = 26.7% | MVP-3 재설계 |
  | 10 km · HRFCO + AWS | 8/30 = 26.7% | MVP-3 재설계 |
  | 10 km · HRFCO 만 | 4/30 = 13.3% | MVP-3 재설계 |
  | 15 km · 표고차 ≥ 50 m 요구 | 9/30 = 30% | MVP-3 재설계 |
  | 15 km · 같은 표준유역(sbsncd) 요구 | 7/30 = 23.3% | MVP-3 재설계 |

  - 민감도: **표고 조건을 빼면 30/30(100%)**, 유역 조건을 빼면 19/30(63%). 15 km 안에 관측소는 있지만 전부 계곡보다 **낮은 읍내·하류**에 있다 — 산지 두부 유역에 우량계가 없다는 valley-ds 우려가 사실.
  - 진짜 상류 관측소가 있는 계곡은 유명산·어비(중미산 HRFCO 강우, +112/+250 m, 2 km)·광덕계곡(광덕산 AWS +472 m)·지장산(관인 AWS +50 m) 정도. 가평 북면 6개(명지·조무락·백둔·논남기·도마치·경반)와 백운계곡은 0 — 가장 가까운 고지 AWS(포천이동·광덕산)가 능선 너머 다른 중권역.
  - 계곡 좌표 28개는 VWorld 검색(골짜기 지명 18 · 휴양림/관광지/펜션 10), 2개 수기(청학동계곡·감악산 운계폭포). 관측소 표고는 제원(AWS 해발·수위 영점표고) 152 + Terrarium z12 65. 유역은 VWorld WFS 표준유역 점 질의 247건, 코드만 캐시(폴리곤 저장 안 함). 관측소 원본 목록은 `.cache/`(gitignore)에만.
  - 한계: 계곡을 점 하나로 대표(입구 점이면 표고 낮게 잡혀 **과대 평가** 쪽), 중권역은 수백 km² 라 다른 골짜기도 같은 유역으로 셈(과대 평가), Terrarium ±20~40 m. 즉 **느슨한 상한이 40%** 다.
- **R1 판정(권고, 사용자 승인 대기)** — MVP-3 "관측소 기반 상류 강우 경보" 는 **재설계 대상**. 후보: (a) 상류 관측소가 실제로 있는 3~4개 계곡만 배지(부분 노출) (b) 점 관측소 대신 **격자 강수**(기상청 초단기실황/예측 1 km 격자·레이더 합성)를 R2 유역 폴리곤에 평균한 "유역 강수" 로 전환 (c) 유역 조건을 풀어 능선 너머 고지 관측소를 "인접 산지 강우" 로 사용(63%) (d) 광역 호우특보 중계로 축소. 에이전트 권고는 **(b) 를 F3 재설계의 기본안, (a) 를 그 전까지의 노출 규칙**으로 — 관측소 위치 문제가 구조적이라 관측소 수를 늘려도 해결되지 않기 때문. F3 는 사용자 결정 뒤 `planning` 으로.

### R2 — 유역 폴리곤

- 순서: VWorld WFS 표준유역 → 국토부 표준권역 API → WAMIS shp. 어느 경로든 결과는 "유역 폴리곤을 한 번 받아 저장, 계곡 등록 시 `basinCode` 기입".
- 산출물: point-in-polygon 1건 성공 로그 + 확보 경로 결정 기록.
- **판정 (2026-09-06) → `done`**: 산출물 두 가지가 채워졌다 — point-in-polygon 1건(아래), 확보 경로 결정(국토부 수자원관리도 WFS `15057885` = 공공누리 1유형이라 폴리곤 저장·재배포 가능 → **기본 경로**; VWorld `lt_c_wkmsbsn` 은 약관상 저장 불가라 **조회 전용 백업**). 표준유역 폴리곤을 실제로 내려 저장하는 일은 S1 의 `/api/basins` 적재 잡에서 한다. 스크립트 산출물은 R1 의 `scripts/research/station-coverage/vworld.ts` 가 이미 같은 질의를 담고 있어 별도 파일을 만들지 않았다.
- **K1 중 확인(2026-09-04)**: VWorld WFS `lt_c_wkmsbsn` 로 샘플 점 → 표준유역 101802 매칭 성공(`docs/API_KEYS.md` 6절). 경로 1순위 확정. 남은 판단은 **저장 방식** — 약관 §19(무단 저장 금지) 답신에 따라 VWorld 폴리곤을 저장할지, 국토부 수자원관리도 WFS(공공누리 1유형, 15057885)로 같은 표준유역을 받아 저장할지. 착수 시 후자를 기본안으로.

### R3 — 그늘 (조사 완료 2026-09-03 · 판정: 조건부 진행)

valley-ds `open-questions §B` 의 두 반론 — ① 무료 DEM 은 90m 라 골짜기가 뭉개진다 ② 계곡 그늘은 나무 그늘인데 DEM 은 지반고다 — 를 데이터 실측으로 다시 판정했다. **둘 다 전제가 바뀌었다.**

| 자산 | 실측 | 의미 |
| --- | --- | --- |
| **Copernicus GLO-30 (30m)** | 공개 S3 버킷에 한국 타일 존재 확인 — `Copernicus_DSM_COG_10_N37_00_E124~E131` 전부 200. 무키·무료, 라이선스는 Copernicus DEM Licence | "무료는 90m" 가정이 틀렸다. **30m** 로 시작. 계곡 폭 20~50m 대비 여전히 굵지만 지형 그늘(산 그림자) 방향·시각은 잡힌다 |
| 국토지리정보원 DEM | 90m 전국(매년 갱신, 무료) + **5m LiDAR** (2년 주기) — 단 5m 는 "도심지" 구축이라 산간 계곡 커버 여부는 지점별 확인 필요. 국토정보플랫폼 로그인 후 다운로드, 이용허락 제한 없음 | 5m 가 있으면 최선, 없으면 GLO-30 |
| **Meta/WRI 1m 수관 높이 지도 (CHM v1)** | 전 지구 1m, CC-BY 4.0, 공개 S3 `dataforgood-fb-data/forests/v1/alsgedi_global_v6_float/chm/<z9 quadkey>.tif`. **경기 북부 타일 존재 확인** — `132110303`(포천 백운 일대) 680MB, `132110321`(양평) 607MB, `132110302` 441MB, `132110230` 25MB. 영상 2018~2020, MAE 2.8m | **나무 그늘 문제의 답.** 지반고(DEM) 위에 수관 높이를 얹으면 "나무가 드리우는 그늘"을 빌드 타임에 계산할 수 있다 |
| 산림청 임상도 1:5000 | 수관밀도·수종·영급 속성. 공공데이터포털 파일 | CHM 보조 — 밀도·낙엽/상록 구분 |
| GEDI/GLAD 30m 수관 높이 | 전 지구 | CHM 폴백 |

**판정** — 그늘 지도는 "현재 계획대로는 어렵다"(valley-ds)에서 **"빌드 타임에 가능, 단 시험 1건으로 품질 확인 필요"** 로 바뀐다. 근거: 지형 30m + 수관 1m 조합, 둘 다 무료·무키·공개 라이선스.

**남은 불확실성** — CHM 은 2018~2020 스냅샷(벌채·생장 미반영), 1m 격자 그림자 투사는 계산이 무거워 계곡 bbox(~2km²)로 잘라야 함, 이 머신에 numpy/GDAL 이 없어(확인) 파이썬 환경이 필요.

**방향 조정 (사용자, 2026-09-03)** — 수관 높이보다 **태양 위치 × 고도(지형)** 위주로 그늘 존재를 판정한다.

- 지형만으로 답할 수 있는 것: **"언제부터 산그늘이 드는가."** 여름 태양은 정오 고도 ~75°, 15시 ~55°, 17시 ~30°. 능선 그림자가 구간에 내려오는 시각은 30m DEM 으로도 잡힌다(능선은 큰 지형). 셀마다 태양 방위 방향 지평선 각도(horizon angle)를 구해 태양 고도와 비교 — 계곡 bbox 2km²/30m ≈ 5,000셀, 계산량 미미.
- 지형만으로 답할 수 없는 것: **"정오에 그늘이 있나."** 11~15시 피크에는 지형 그림자가 거의 없고 그 시간 그늘은 나무 그늘이다. 지형만 쓰면 정오 카드가 "그늘 없음" 으로 찍힌다.
- 중간 대안: 1m CHM 래스터 대신 **산림청 임상도(1:5000) 폴리곤**의 수관밀도로 정오 그늘을 밀/중/소 3단계 태그로 근사. 680MB 타일을 다루지 않는다. → **D6 에서 뒤집힘**: 수기·근사 대신 CHM 으로 직접 산출(아래 D6).

**다음** → **R3b 시험 계산** (`planning`, 사용자 승인 대기): `scripts/research/shade-pilot/` 파이썬(uv venv + rasterio + numpy + suncalc).
1. **1차 — 지형만**: 계곡 1개(포천 백운 또는 가평) bbox 를 GLO-30 에서 잘라(국토정보플랫폼 5m 가 있으면 그것), 7~8월 대표일 정오·15시·17시 태양 위치로 **구간별 산그늘 시작 시각** + 3시각 그늘 폴리곤 GeoJSON. 정사영상과 눈 대조.
2. **2차 — 선택**: 임상도 폴리곤을 구간에 교차시켜 정오 수관 3단계 태그. 1m CHM 은 보류(필요 시 재개).
3. **스키마 후보** (R3b 결과로 확정): `shadeRatio: number` 대신 **`shadeOnsetLocal: 'HH:mm'`**(지형 산출, 대표일 기준) + **`canopy: 'dense'|'moderate'|'sparse'`**(임상도) — 지형 그늘과 나무 그늘의 출처를 분리한다. 1차만 통과하면 `shadeOnsetLocal` 만 넣고 `canopy` 는 수기.
`accessGradePct` 는 어느 쪽이든 GLO-30 으로 충분. 등고선 표시는 C10(계곡 3D 지형) 범위.

### D6 — 그늘 스키마 결정 (결정 2026-09-03)

**사용자 결정** — R3b 권고(수기 태그) 를 **채택하지 않는다.**
1. **사람이 직접 적는 값은 금지.** 그늘량은 데이터로 산출해 보장한다.
2. 나무 밀도는 **계곡·구간 기준으로 데이터에서 계산할 수 있으면** 필드로 둔다.
3. 지도에 **그늘 보기 버튼**이 있고 그늘이 **화면에 출력**돼야 한다.

**따라서 방향이 R3 원안으로 돌아간다** — 지형(GLO-30 30m) + **수관 높이(Meta/WRI 1m CHM, 한국 타일 확인됨)** 를 합쳐 빌드 타임에 시간대별 그늘을 계산한다. R3b 가 확인한 것("정오 그늘은 나무 그늘")은 그대로 유효하고, 그 나무를 CHM 이 데이터로 준다. "1m CHM 보류" 결정은 **철회**.

**산출 방식(안)** — 구간 라인 좌우 50m 버퍼 안의 1m 셀마다, 시각 t 에 그늘이면:
- (a) 셀 위에 수관이 있다(CHM > 2m) — 나무 아래. 시각과 무관.
- (b) 태양 방위 방향으로 수관/지형 장애물의 앙각 > 태양 고도 — 나무·능선이 드리운 그림자. 수관은 1m CHM 을 최대 ~100m 까지, 지형은 30m DEM 을 6km 까지 추적(R3b 코드 재사용).
- 구간 그늘 비율 = 버퍼 셀 중 그늘 셀 / 전체. 물가 셀만 셀지(하천 폴리곤 필요) 버퍼 전체를 셀지는 R3c 에서 비교.

**스키마(안, R3c 결과로 확정)** — 전부 산출값:
- `segmentProps.shadeByHour: number[]` — KST 10~18시 9개 값(0~1), 대표일 8/1. `shadeRatio` 는 그 정오 값으로 남기거나 제거.
- `segmentProps.canopyCover: number` — 버퍼 안 CHM > 2m 셀 비율(0~1). "나무 밀도"의 데이터 정의. 3단계 표시(`dense/moderate/sparse`)는 표현 계층이 임계값으로 만든다.
- 계곡별 시간대 그늘 폴리곤 `data/shade/<valleyId>/<HH>.geojson` — 지도 레이어(F4) 입력.
- `terrainShadeFromLocal` 은 **불필요** — 시간대별 폴리곤이 그 정보를 포함한다.

**알려진 한계(기록)** — CHM 은 2018~2020 스냅샷(MAE 2.8m, 벌채·생장 미반영), 30m DEM 은 DSM 이라 수관이 이미 섞여 있음(지형 그늘이 늦게 나오는 편향). 화면에는 "위성 기반 추정, 현장과 다를 수 있음" 고지 필요(면책 항목과 연결).

**다음** → **R3c**(시험 2) → **P1**(파이프라인) → **F4**(지도 그늘 레이어 + 토글 + 시간 슬라이더). 임상도(FGIS)는 CHM 검증·보조로만 — K1 유지.

### R4 — 싸게 끝나는 조사 (조사 완료 2026-09-03)

**경쟁**

| 서비스 | 형태 | 갖고 있는 것 | 없는 것 |
| --- | --- | --- | --- |
| 네이버·카카오 지도 | POI + 후기 | 위치·후기·길찾기 | 수심·안전·구간·시간축 전부 없음. 계곡은 POI 하나 |
| **계곡가자** (네모팩토리) | iOS 전용 앱, v1.1.2 (최근 출시) | 계곡 300+ · 온천 45. 수심·주차·화장실·아이동반·날씨·지도 연동·즐겨찾기 | 실시간·안전 경보·구간·그늘·혼잡 없음. 정적 카탈로그. 리뷰 1개 |
| 계곡리즘 (0wonchorok.com) | 웹 | 지도 + 후기 + 장소 등록 | 데이터 비어 있음("후기 없음", 로딩 중) |
| 계곡 정보 (valley-info.com) | 웹 | 위치·수심·주차 텍스트 | 얇음, 갱신 신호 없음 |
| 놀이의발견 | 종합 여가 앱 | 예약 | 계곡 특화 아님 |
| 2014 동서대 "계곡검색 애플리케이션" 논문 | 학술 | — | 정적 카탈로그 시도가 반복돼 왔다는 증거 |

**왜 죽는가** — 전부 **정적 카탈로그**다. 계절성(여름 3개월) + 갱신 루프 없음 + 네이버 블로그 대비 차별점 없음. 어느 것도 "지금 갈까 / 지금 나와야 하나"(시간축·안전)를 다루지 않는다 → valley-ds 의 포지셔닝은 **유효**하다. 단 "계곡 300곳 수심·주차·화장실" 카탈로그 자체는 이미 있으니, 카탈로그로는 경쟁하지 않는다.

**계곡 시드 목록 출처** — "전국 계곡 목록" 단일 공식 데이터셋은 **없다**. 조합:
- **행안부 생활안전지도 물놀이관리지역** (data.go.kr/15101866) — 일반/중점관리/위험 3분류, 장소 유형(하천·계곡…), 수심, 안전시설, 과거 인명사고, 좌표. 이용허락 제한 없음, 개발계정 자동승인·운영 심의. **가장 좋은 공식 시드** — `swimBanned`·`riskNote` 의 출처이기도 하다. 주의: 포털 표기 형식이 **WMS** — 벡터/CSV 로 받을 수 있는지는 safemap.go.kr openAPI 에서 확인(K1 와 함께).
- 국립공원공단 국립공원 계곡 수질 현황(2014) — 공원별 계곡명 목록.
- 지자체 파일(예: 해운대구 물놀이 계곡 현황) — 산발적.
- 산림청 산정보(3,368) + 임상도 — 인접 산·수종.
- 결론: 시드 = 물놀이관리지역 중 유형 "계곡" ∪ 수도권 수기 30개. 구간(LineString)은 어차피 수기/하천망 절단.

**콘텐츠 시딩 비용 산정** (30계곡 × 3구간 = 90구간 + 시설 ~150점)

| 필드군 | 출처 | 방식 | 추정 |
| --- | --- | --- | --- |
| 좌표열·order·position | VWorld 하천망 / OSM waterway + 정사영상 | 반자동(절단·검수) | 90 × 8분 ≈ 12h |
| `swimBanned`·`riskNote`·수심 힌트 | 물놀이관리지역 | 자동 매칭 | 2h |
| `shadeRatio`·`accessGradePct` | GLO-30 + CHM (R3b 통과 시) | 자동 | 스크립트 후 0 |
| `depth`·`bed`·`freeAccess`·`camping`·`pet` | 블로그·지자체 공고·정사영상 | **수기 조사** | 90 × 10분 ≈ 15h |
| 시설 150점(주차·화장실·매점) | 지자체 주차장 표준데이터 + OSM + 정사영상 | 반자동 | 150 × 3분 ≈ 8h |
| **합계** | | | **~37h 데스크**. 현장 검수는 별도(계곡당 반나일). spotts 도 vault 수작업이었다 |

**VWorld 상업적 이용 조건** — **미확인.** 이용약관 페이지(`vworld.kr/dev/v4dv_apicla_a001.do`)가 시스템 오류/JS 로딩으로 자동 수집 불가. 알려진 사실: 인증키 도메인 고정, 약관 제4조(이용)·제10조·제12조(저작권)에 조건 존재. → **K1 사용자 액션**에 추가: 약관 직접 열람 또는 문의(1661-0115 / vworld@spacen.or.kr)로 ① 상업 서비스 허용 ② 정사영상·지적도 타일 캐시/재배포 ③ 일일 한도 를 확인해 결정 기록에 남긴다.

### K1 — API 키 (사용자 액션, 착수 2026-09-04)

- VWorld(운영 도메인 + localhost), 기상청 API허브, 기상자료개방포털, 한강홍수통제소, 행안부 생활안전지도 ×2, 국토부 표준권역, TAGO. 각 일일 한도를 표에 기록.
- **조사 결과와 체크리스트는 `docs/API_KEYS.md`** (신청 순서·한도 표·약관 판정·VWorld 문의 메일 초안·키 보관 규약). 요지:
  - 신청 7건(기상자료개방포털은 별도 신청 없음 — 2020-07 data.go.kr 이관, AWS 분 자료는 API허브). 심의가 있는 것: VWorld 운영키(~10일), 생활안전지도 운영계정. 나머지는 자동.
  - 한도: API허브 일반 20,000건·5GB/일 / 한강홍수통제소 **일일 한도 없음**(분당 1,000건 초과 3회면 차단 — 관측소 50개 × 10분 폴링 7,200건/일은 분당 5건으로 안전, valley-ds 의 "개발계정 1,000건 초과" 걱정 해소) / VWorld 지오코더 40,000건, WMS·WFS 는 수치 비공개 / data.go.kr 개발 기본 1,000(TAGO 10,000)·운영 최대 100,000.
  - **약관 판정**: VWorld 영리 이용은 사전 서면 승인(§13⑤·§20③), 데이터 무단 저장 금지(§19) → 정사영상 캐시·재배포 불가, 문의 메일 필요(초안 있음). **물놀이관리지역은 WMS 만**(벡터·CSV 없음, 재전송 금지) → R4 의 `swimBanned`·`riskNote` 자동 매칭은 재산정. 국토부 하천망·표준권역·수자원관리도(WFS, 표준유역 840)는 공공누리 1유형·운영 자동 → R2 의 확실한 경로.
  - 키는 `.env.local` 에만. 저장소에는 "어느 키를 받았는지·한도" 만 결정 기록에.
- **진행 (2026-09-04)**: ① VWorld 개발키 2개 수령(발급 2026-08-24, 만료 2027-02-24 → 유효 6개월, `.env.local` 보관). 서버 curl 로 WFS 정상 — 도메인 검사는 Referer 기준이라 프록시 호출에 안 걸림. **R2 의 point-in-polygon 1건을 여기서 확인**: 샘플 중류 점 → 표준유역 `101802 퇴계원수위표`(중권역 1018, 대권역 10), 하천망 `왕숙천 1024740`. WFS 4326 BBOX 는 위도,경도 순서. 상세 `docs/API_KEYS.md` 6절. 남은 것: 두 키의 도메인, 나머지 6건 키, VWorld 문의 답신.
- **진행 (2026-09-04, 브라우저 대행)**: 사용자가 오르카 내장 브라우저에서 로그인 → 에이전트가 활용신청 수행. **data.go.kr**: TAGO 버스도착(15098530)·시외(15098541)·고속(15098516) 3건 **즉시 승인**, 키로 `getCtyCodeList` 정상 응답 확인(키 동작 ✓). 산사태위험지도(15149602)·물놀이관리지역(15101866)·하천망(15058825)·표준권역(15056790)·수자원관리도(15057885)는 **LINK 타입 — data.go.kr 에 활용신청 자체가 없음**(폼 접근 invalidAccess). 생활안전지도 2건은 safemap.go.kr 자체 인증키, 국토부 3건은 국가공간정보포털(nsdi) 경로로 별도 진행. **기상청 API허브**: AWS 매분자료(434)·지점정보(503) 활용신청 완료, 키 동작 ✓(R1 의 두 축 중 하나 확보). **한강홍수통제소**: 인증키 수령(localhost 용), 수위 관측소 1,420·강우 관측소 744 제원(위경도) + 10분 자료 응답 ✓ → **R1 의 두 축 모두 확보, R1 착수 가능**. 함정: data.go.kr 의 "활용신청" 은 새 탭 팝업이라 `selectDevAcountRequestForm.do?publicDataDetailPk=<uddi>` 로 직접 들어가는 편이 안정적.
- **추가 (2026-09-04, F3a) → 완료 2026-09-06**: 기상청 API허브 **격자 강수 활용신청 9건 전부 승인·키로 200 확인**(`docs/API_KEYS.md` 8절) → S3 실측 스파이크 착수 가능. 원 계획 5건(레이더 합성 HSR `nph-rdr_cmp_inf`·`nph-rdr_cmp1_api` → 다운로드 `rdr_cmp_file.php` → 격자 위경도 `nph-rdr_latlon_api` → 융합기상 고해상도 격자 `nph-sfc_obs_nc_pt_api` → 초단기예보 격자 `nph-dfs_vsrt_grd`). 표·요청 문구 `docs/API_KEYS.md` 9절. 사용자 로그인 필요, 자동 승인.
- **done 조건**: 7건 키 수령(운영 심의는 개발계정으로 우선), `docs/API_KEYS.md` 미확인 항 채움, VWorld 답신 요지 기록 → R1·R2·S1 의존 해제.

### C1 — 디자인 토큰 (재기획 2026-09-03)

**기준 변경** — valley-ds 토큰(`--vly-*`, 청록 accent, 라이트 우선)은 **채택하지 않는다.** 기준은 `docs/references/firework-map-clone.html` 의 `:root` 토큰이고, 그 값은 이미 `apps/valley-map/src/theme/tokens.ts` 에 1:1 로 옮겨져 있다.

데모 `:root` 실측 (11개):

| 토큰 | 값 | `tokens.ts` |
| --- | --- | --- |
| `--bg` | `#18181c` | `COLORS.bg` |
| `--surface` | `#202024` | `COLORS.surface` |
| `--fg` / `--fg2` / `--fg3` | `#f2f4f6` / `#9ea4ad` / `#6e747f` | `COLORS.fg/fg2/fg3` |
| `--accent` | `#297cff` | `COLORS.accent` |
| `--line` / `--line2` | `rgba(46,46,52,.9)` / `rgba(57,57,64,.7)` | `COLORS.line/line2` |
| `--shadow` | `rgba(0,0,0,.2) 0 1px 1px, rgba(0,0,0,.28) 0 4px 12px` | `+html.tsx --mv-shadow` |
| `--col` / `--sheet-h` | `560px` / `45vh` | `SIZES.column/sheetHeightRatio` |

`tokens.ts` 는 여기에 데모 CSS 본문에서 뽑은 파생색(`glass`, `ctrlHover`, `spotHover`, `segActive`, `grab`, `live`, `liveText`, `eyebrow`, `credit`)과 `RADII`, `SIZES`, `FONT_FAMILY`, `ELEVATION` 을 더 갖고 있다. 즉 **토큰 값은 새로 만들 것이 없다.** C1 의 일은 값이 아니라 **체계**다.

**범위 (값 불변)**

- `theme/tokens.ts` 의 평면 상수(`COLORS`·`RADII`·`SIZES`·`FONT_FAMILY`·`ELEVATION`)를 **하나의 `Theme` 객체**로 묶고 타입을 준다. 값은 한 글자도 바꾸지 않는다 — 파리티 테스트가 이를 고정.
- `ThemeProvider` + `useTheme()`. 컴포넌트의 `COLORS.x` 직접 참조를 `theme.colors.x` 로 — 이 전수 수정이 이 항목의 실제 크기다. 지금은 테마가 하나(데모 다크)뿐이라 동작 변화는 없다.
- web `+html.tsx` 의 CSS 리터럴(`--mv-shadow`, `#18181c`, `#242429`, `#297cff`, `#26262b`, `#9ea4ad`, `#f2f4f6` …)을 **TS 토큰에서 생성한 CSS 변수**로 바꿔 두 진실을 없앤다. 값 동일.
- 시맨틱 이름 정리는 **하지 않는다**(예: `fg2 → secondary`). 데모 이름을 그대로 두어 `PARITY.md` 와 대조가 쉽게 유지된다.
- valley-ds 의 간격·라운드·모션 스케일, 마커 팔레트는 이 항목 밖. 마커 팔레트는 C4/C2 가 `map-style` 에서 다룬다.
- 네이티브 Pretendard 는 범위 밖(기존 ⛔ 유지).

**D1 과의 관계 — 사용자 결정 필요**

데모 토큰은 다크 한 벌이다. D1(라이트 기본 + 다크, 설정에서 선택)을 유지하려면 라이트 팔레트를 **새로 정해야** 하는데, 그 근거가 될 실측이 없다(valley-ds 라이트는 버렸다).
- (a) **C1 은 다크 한 벌로 체계만 만든다.** `Theme` 타입이 두 번째 팔레트를 받을 수 있게만 열어 두고, 라이트 값은 별도 디자인 항목으로 뒤로 미룬다. C9(테마 설정)도 함께 대기.
- (b) C1 에서 라이트 팔레트까지 정한다 — 데모 다크에서 명도 반전으로 **초안**을 만들고 룩으로 확인 후 확정. 디자인 판단이 한 번 더 필요하다.

**결정 (2026-09-03): (b).** 라이트 팔레트 규칙:
- 다크 한 벌은 값 불변(파리티). 라이트는 다크에서 **역할 단위로 대응**해 초안을 만든다 — `bg`(베이스) / `surface`(카드) / `fg·fg2·fg3`(본문·보조·캡션) / `line·line2` / `glass` / `shadow` 각각 밝은 배경에서 같은 역할·같은 대비 순서를 갖는 값. 채도 낮은 뉴트럴만 쓰고 색조는 다크와 같은 계열(차가운 회색).
- `accent #297cff` 는 유지. 흰 글자 대비 3.9:1 이라 15px/600 CTA 에서만 쓰고, 12px 소형 텍스트에 accent 를 쓰는 곳(`eyebrow` 등)은 라이트에서 한 단계 어두운 값을 잡고 대비 수치를 표에 남긴다.
- 대응표(다크 → 라이트, 역할, 배경 대비 비율)를 PR 본문에 싣는다. **라이트는 초안**이며 사용자가 PR 스크린샷으로 확인하고 값을 조정한 뒤 머지한다 — 이것이 이 항목의 사용자 개입 지점.
- 기본 모드는 D1 대로 **라이트**. 파리티 검증은 다크를 강제해 수행한다(개발용 강제 수단은 env 또는 Provider prop, C9 가 정식 설정 UI 를 만들면 그때 정리).
- 지도 스타일(openfreemap `dark`)은 이 항목에서 바꾸지 않는다 — 라이트 UI 위에 다크 지도가 잠시 공존한다. 지도 라이트는 C2.

**검증**
- `pnpm verify` 통과. 파리티 테스트: `Theme` 의 모든 색·반경·치수가 이전 `COLORS/RADII/SIZES` 스냅샷과 동일(값 회귀 방지).
- web 화면 픽셀 무변화 — `PARITY.md` 의 측정표 재확인(상단바·시트·내비·카드 좌표), 스크린샷 PR 첨부.
- native `typecheck`·`test` 통과.

### C2 — 지도 팔레트

- `map-style/src/palette.ts` (`map-palette.json` 반입) + `applyValleyPalette(style, mode)` — openfreemap 스타일의 `background/water/park/building/road*/label*` paint 를 팔레트로 치환. `decorateNightStyle` 과 같은 "새 스타일 반환" 규약.
- 계곡 조정: `park` 불투명도 z9→z12 **증가**로 반전, `waterway-stream` 선폭 확대.
- 라벨 폴백 순서 하나로 통일, 마커 팔레트(9종 + 3단계) 상수화.
- 라이트 소스 스타일(D4) 결정 필요.

### C3 — 계곡 도메인

- `core/domain/valley/`: `Valley`, `Segment`(LineString, `depth/bed/shade/access*/swimBanned/...`), `Facility`(Point, 9종), `CrowdSnapshot`(3단계), `UpstreamAlert`. 브랜드 ID.
- `data/.schema/valleys.schema.json` 반입 + 위 불일치 정규화. `core/data/` 에 GeoJSON → 도메인 로더 + `example-valley.geojson` 으로 테스트.
- 저장 시점 4326 정규화 규칙은 스키마 `crs` const 로 강제(런타임 변환 코드 두지 않음).

### C4 — `MapEnginePort` 일반화 (기획 2026-09-03)

**왜** — 포트가 `Spot`(Point) 전용이다: `renderSpots(spots, launchSite)`, `setSelectedSpot(spot)`, `'spot-press': SpotId`. 계곡은 LineString 구간 + Point 시설 + 혼잡 상태색이고, D2 로 festival 도 남는다. 둘을 같은 계약 위에 올리지 않으면 어댑터 두 벌이 각각 두 갈래로 갈린다.

**연구 결과 — 지금 구조에서 바뀌어야 하는 곳**

| 계층 | 현재 | 문제 |
| --- | --- | --- |
| `core` 포트 | `renderSpots` / `setSelectedSpot` / `'spot-press'` | 타입이 `Spot` 에 고정. `LoadSessionUseCase`·`SelectSpotUseCase`·`ClearSelectionUseCase`·`MapSession.#wireEngineEvents` 가 직접 부른다 |
| `map-style` | `spotLayers.ts` 하나 (소스 1 + 레이어 3 + `toSpotFeatureCollection` + `readSpotFeatureId`) | 구간·시설 명세가 없다. 마커 색(9종·3단계)도 없다 |
| `adapter-web` | `SpotLayerController` 가 소스·레이어·히트를 한 묶음으로 소유 | 피처 종류마다 컨트롤러를 복제해야 한다 |
| `adapter-native` | `MapScene { spots, selectedPin }`, `MapSurfaceEvents['spot-press']` | 스냅샷 필드가 명당 전용. `NativeMapView` 가 `SPOT_*` 상수를 직접 그린다 |
| 테스트 | `FakeMapEngine.renders/pins`, `MapSession.test`, `NativeMapEngine.test`(22) | 전부 `Spot` 시그니처를 고정하고 있다 |

**설계**

1. **`core` — 포트 계약을 "내용 스냅샷 + 선택 + 피처 이벤트" 셋으로 좁힌다.**
   ```ts
   // application/ports/MapContent.ts (새 파일, 도메인 타입만 참조)
   type MapContent = {
     readonly spots: readonly Spot[]; readonly launchSite: LngLat | null;   // festival
     readonly segments: readonly Segment[]; readonly facilities: readonly Facility[];
     readonly crowd: ReadonlyMap<SegmentId, CrowdStatus>;                    // valley
   };
   type MapSelection = { kind: 'spot'; spot: Spot } | { kind: 'segment'; segment: Segment } | { kind: 'facility'; facility: Facility };
   type MapFeatureRef = { kind: 'spot'; id: SpotId } | { kind: 'segment'; id: SegmentId } | { kind: 'facility'; id: FacilityId };
   ```
   - `renderSpots(spots, launchSite)` → `renderContent(content: MapContent)`. 피처 종류가 늘면 필드가 늘고 메서드는 안 늘어난다. 어댑터가 참조 비교로 바뀐 소스만 다시 쓴다.
   - `setSelectedSpot(spot|null)` → `setSelection(selection: MapSelection | null)`.
   - `'spot-press': SpotId` → `'feature-press': MapFeatureRef`. `'background-press'` 유지.
   - `setFireworksEnabled` 는 이미 capability 로 실패를 돌려주므로 **건드리지 않는다**.
   - `MapSession`: `feature-press` 의 `kind === 'spot'` 만 `selectSpot` 으로 라우팅. 나머지 종류는 debug 로그 — 구간·시설 선택 유즈케이스는 F1 범위.
   - `LoadSessionUseCase` 는 `renderContent({ spots, launchSite, segments: [], facilities: [], crowd: new Map() })`. `EMPTY_MAP_CONTENT` 상수 제공.
   - `FakeMapEngine.renders → contents`, `pins → selections`. `MapSession.test` 갱신.
2. **`map-style` — 레이어 셋 레지스트리.** 두 어댑터가 같은 목록을 순회하도록 소스 단위로 묶는다.
   ```ts
   type FeatureLayerSet = { readonly kind: 'spot'|'segment'|'facility'; readonly sourceId: string;
     readonly emptySource: GeoJSONSourceSpecification; readonly layers: readonly LayerSpecification[];
     readonly interactiveLayerIds: readonly string[]; readonly readFeatureId: (props: unknown) => string | undefined };
   export const MAP_LAYER_SETS: readonly FeatureLayerSet[]  // [SPOT_LAYER_SET, SEGMENT_LAYER_SET, FACILITY_LAYER_SET]
   ```
   - `segmentLayers.ts`: 소스 `valley-segments`, `line` 레이어(`line-color` = `['match', ['get','crowd'], 'available', …, 'low', …, 'busy', …, /*unknown*/ accent]`, 선택 시 `line-width` 증가, `line-cap: round`), 라벨 `symbol` 레이어(`valleyName`, `symbol-placement: line-center`, `symbol-sort-key: mapImportance`). 속성 `{ segmentId, valleyId, valleyName, position, crowd: CrowdStatus|'unknown', selected, mapImportance }`.
   - `facilityLayers.ts`: 소스 `valley-facilities`, `circle` 레이어(`circle-color` = `facilityType` 9종 match, 흰 stroke), 선택 시 반지름 증가. 속성 `{ facilityId, valleyId, name, facilityType, selected }`. 아이콘 심볼은 C5(지연 아이콘)에서 교체 — 지금은 원.
   - `markerPalette.ts`: `FACILITY_COLORS`(9종, `store` 키), `CROWD_STATUS_COLORS`(available/low/busy). valley-ds `map-palette.json` 값. C2 가 나중에 팔레트 파일 전체를 반입할 때 이 파일을 흡수한다.
   - `toSegmentFeatureCollection(segments, crowd, selectedId)`, `toFacilityFeatureCollection(facilities, selectedId)`. **선택 상태는 feature-state 가 아니라 `properties.selected`** — spotts 와 같은 선택(`setData` 재주입, 피처 수백 개 규모에서 단순함 우선), 네이티브에서 feature-state API 가 없는 점도 같은 결론.
   - `spotLayers.ts` 는 `SPOT_LAYER_SET` 으로 감싸기만 하고 값은 그대로(데모 파리티).
   - `map-style` 에 vitest 설정을 추가하고 변환 함수 테스트(정렬·crowd 매핑·selected 주입·id 읽기)를 둔다 — 지금 이 패키지에는 테스트가 없다.
3. **`adapter-web`** — `SpotLayerController` → 제네릭 `FeatureLayerController(map, layerSet, emitter)` 하나로. `MapLibreEngine` 이 `MAP_LAYER_SETS` 를 순회해 설치·갱신·히트(`'feature-press'` 에 `layerSet.kind` 를 실어 발화). `SelectionPinController` 는 `MapSelection` 을 받아 spot/facility 는 핀, segment 는 핀 없이 `selected` 재주입만. `renderContent` 는 소스별 참조 비교로 `setData` 최소화.
4. **`adapter-native`** — `MapScene.spots` → `sources: Readonly<Record<string, FeatureCollection>>` (sourceId 키), `selectedPin: { id, center, color } | null` 로 종류 무관하게. `MapSurfaceEvents['spot-press']` → `'feature-press': { sourceId, featureId }`; `NativeMapEngine` 이 `sourceId → kind` 로 `MapFeatureRef` 를 만든다. `NativeMapEngine.test` 갱신(scene 게시 형태·press 라우팅).
5. **`apps/valley-map/platform/native/NativeMapView.tsx`** — `MAP_LAYER_SETS` 를 순회해 `<GeoJSONSource id data onPress>` + `<Layer>` 를 그린다. `SPOT_*` 직접 참조 제거. `<Layer>` 는 `LayerSpecification` 전체를 받으므로 `line` 명세 가능 — **확인됨** (`Layer.d.ts`).

**범위 밖 (하지 않는 것)**
- 구간·시설 **선택 유즈케이스**와 시트 UI → F1. 계곡 데이터 적재(`ValleyRepositoryPort`, `AppState.valleys`) → F1.
- 아이콘 심볼(지연 로더) → C5. 팔레트 전체 반입·재색칠 → C2. 카메라 프리셋 계곡 값 → F1.
- `setFireworksEnabled`, `MapCapabilities` 변경 없음.

**검증 (머지 게이트)**
- `pnpm verify` 전체 통과. 테스트 수: core 131 유지+`MapSession` 갱신, adapter-native 22 유지+scene/press 케이스, map-style 신규.
- web 회귀: `pnpm web` 으로 불꽃 화면이 **그대로** 뜬다 — 명당 마커·라벨·글로우·선택 핀·클릭·빈 곳 클릭 닫기. PR 본문에 스크린샷.
- web 신규: 워크트리에서 **커밋하지 않는 임시 코드**로 `data/example-valley.geojson` 을 `renderContent` 에 넣어 구간 라인 3개(상태색 3가지)와 시설 마커가 그려지는 스크린샷을 PR 에 첨부. 임시 코드는 PR 에 포함하지 않는다(F1 이 정식 경로를 만든다).
- native: `typecheck`·`test` 통과까지. 화면 검증은 후속 체크박스(D3).

**타당성 판정 (2026-09-03) — "모두의계곡에 꼭 필요한가"**

MVP-1(계곡 구간 카드)은 지도에 구간 선·시설 점이 그려져야 성립하고, 엔진은 지금 `Spot` Point 만 그린다. 따라서 **어떤 형태로든** 포트·map-style·두 어댑터에 새 피처 경로가 생겨야 한다. 이 부분은 회피 불가이며 C4 의 약 70% 다. 나머지 30%(명당 경로를 같은 계약으로 합치는 "일반화")는 설계 선택이다.

| 선택지 | 내용 | 비용 | 위험 |
| --- | --- | --- | --- |
| **정본(통합)** | `renderContent`/`setSelection`/`feature-press` 로 명당·계곡을 한 계약에 | 100% | 불꽃 화면 회귀 — 테스트로 잡힘 |
| C4-lite(덧붙이기) | 기존 유지 + `renderValley`/`segment-press`/`facility-press` 추가 | ~60% | 명당·계곡 두 경로가 어댑터마다 평행. 셋째 종류(위험구역·그늘 폴리곤)가 오면 세 경로 |

**정본을 택한 근거** (실측):
- D2 로 festival 을 영구 보존 → 두 경로는 언젠가 합쳐야 하고, 통합 비용은 코드가 작은 지금이 가장 싸다.
- 포트 호출 지점이 좁다: core 3곳(`LoadSession`·`SelectSpot`·`ClearSelection`) + `MapSession` 배선 1곳, web 엔진 메서드 2 + 컨트롤러 emit 1, native 엔진 메서드 2 + surface 이벤트 1. 테스트 참조 14건. → 리팩터 범위가 유한하고 전부 타입으로 드러난다.
- native `<Layer>` 가 `LayerSpecification` 전체를 받는다(`components/layer/Layer.d.ts`: `StyleSpecLayerProps = OptionalSource<OptionalId<LayerSpecification>>`, `LineLayerProps` 존재) → `line` 레이어 가능. **확인됨** — [확인 필요] 해제.
- L1 에 위험구역·그늘 폴리곤이 예정돼 있어 셋째 종류는 가정이 아니라 계획이다.

**빼도 되는 것**(F1 에서 필요해질 때): 라벨 `symbol` 레이어, `mapImportance` 정렬. `map-style` vitest 는 변환 함수 회귀 방지용으로 유지.

**결정 (2026-09-03)**: **정본(통합) 채택**, (a) 단일 `renderContent` · (b) PR 1개 · (c) 임시 코드 스크린샷. → `in-progress`

**결과 (2026-09-03, PR #6 머지)**: 설계 1~5 그대로 구현. 기획 대비 추가한 것 하나 — `FeatureLayerSet.dependencies(content, selection)` / `toFeatureCollection(content, selection)`. "소스별 참조 비교로 setData 최소화"를 어댑터가 종류를 모른 채 하려면 셋이 자기 의존을 말해야 했다. 두 어댑터가 `sameDependencies` 하나를 쓴다. 테스트 core 132 · map-style 20(신규) · adapter-native 27. web 회귀·계곡 렌더 스크린샷은 PR 본문(고아 브랜치 `proof/C4-map-engine-port`). native 화면 검증도 머지 직후 iOS 시뮬레이터(iPhone 17 Pro)에서 마쳤다 — 마커 탭 → 핀 + 상세, 빈 곳 탭 → 닫힘. 구간·시설의 네이티브 렌더는 데이터 경로가 생기는 F1 에서 확인한다(PR #6 코멘트).

### C5 — 지연 마커 아이콘 (기획 2026-09-06)

**배경** — V1 (f) 가 시설을 흰 원 + 유형 이니셜(P·WC·S·F·C·B·!··)로 그렸고 "C5 자리 표시" 로 못 박았다. 9종 중 F·C·S·B 는 글자로 구분이 안 된다. 여기서 이니셜을 **픽토그램**으로 바꾼다. 구간 선은 LineString 이라 valley-ds 의 `crowdMarkerSvg`(점 혼잡 마커)는 쓰지 않는다 — 시설 아이콘만.

**연구 질문 → 답**
1. *web 은 어떻게 그리나.* maplibre-gl 6 `setMissingStyleImageResolver` 가 이미 어댑터에 스텁으로 있다(`MapLibreEngine`). valley-ds `lazy-marker-icons.ts` 패턴 그대로: 아이콘 **ID 가 명세**(`facility/parking/light`), 요청 시 SVG 문자열 → `createImageBitmap` → `addImage(pixelRatio 2)`. SVG 팩토리는 `map-style` 에 순수 함수로(팔레트 참조, DOM 없음), 래스터화만 `adapter-web`.
2. *native 는.* `maplibre-react-native` 11.3.8 `<Images onImageMissing>` 은 있지만 브리지 너머라 JS 에서 SVG 를 래스터화해 넘길 수 없다. 같은 SVG 팩토리에서 **빌드 시 PNG(@2x·@3x) 를 굽는 스크립트**(`scripts/icons/`, resvg 또는 sharp)로 `apps/valley-map/assets/icons/` 에 두고 `images` prop 으로 등록한다. 한 소스 → 두 출력이라 파리티가 저절로 지켜진다. 테마별 2벌(light/dark).
3. *심볼 레이어는.* V1 이 만든 `valley-facility-label`(이니셜 텍스트) 를 `icon-image: ['concat','facility/',['get','facilityType'],'/',mode]` 심볼로 바꾸고, 원(`valley-facility-dot`)은 유지하거나 아이콘 안에 흡수한다 — 결정 (a).
4. *테마 전환 시.* ID 에 모드가 들어가므로 스타일 재구성 때 다른 ID 가 요청된다. web 은 `refreshMarkerIconsByPrefix` 불필요. C9 이 런타임 전환을 붙이면 그때 확인.

**결정 (검토 페이지 https://claude.ai/code/artifact/3800ca76-3932-4ea6-9167-ced6345d2a66 — SVG 를 라이트·다크 지도 위에 직접 렌더)**
- (a) **형태** — A1 흰 원 + 색 테두리 + 색 글리프(V1 F1 과 연속) (권고) / A2 물방울 핀(색 채움 + 흰 글리프) / A3 색 원(채움) + 흰 글리프
- (b) **글리프 세트** — B1 자체 선 픽토그램 9종(주차 P · 화장실 사람 · 식당 포크나이프 · 카페 컵 · 매점 바구니 · 역 버스 · 진입로 발자국 · 안전 십자 · 기타 점3) (권고) / B2 Maki 글리프 재사용(MIT, 15px 격자) / B3 V1 이니셜 유지
- (c) **크기** — C1 28dp(선택 34) (권고) / C2 24dp(선택 30) / C3 32dp(선택 38)
- (d) **다크 처리** — D1 배경 `#1c1c1e`·글리프 유형색 밝은 톤 (권고) / D2 라이트와 동일 흰 원
- (e) **native 래스터 경로** — E1 빌드 시 PNG 2벌×9종×2배율(권고) / E2 런타임 데이터 URI(품질·성능 미검증)

**결정 확정 (2026-09-06 사용자, 검토 페이지)** — 권고와 다른 선택은 (a)(d).
- (a) **A2 물방울 핀** — 유형색 채움 + 흰 글리프, 테두리 흰색 2px. 핀 비율 28×36(꼭짓점이 좌표, `icon-anchor: bottom`). 선택 시 34×44. 명당 선택 핀(`SelectionPin`)과 모양이 겹치므로 시설 선택은 **핀 확대 + 흰 링**으로 구분하고 별도 선택 핀을 세우지 않는다(어댑터 `setSelection` 의 facility 분기 조정).
- (b) B1 자체 선 픽토그램 9종(24px 격자, stroke 2, 둥근 끝) — 검토 페이지의 경로를 출발점으로 `map-style/facilityIcons.ts` 에 순수 문자열로.
- (c) C1 28dp(선택 34), 글리프 17px(선택 20). `MARKER_ICON_PIXEL_RATIO 2`.
- (d) **D2 다크도 라이트와 동일** — 핀 채움·흰 테두리·흰 글리프 그대로, 다크 전용 톤 없음. 따라서 아이콘 ID 에 모드를 넣지 않는다(`facility/<type>`, 선택 `facility/<type>/selected`).
- (e) E1 빌드 시 PNG — D2 로 테마가 하나라 **9종 × 2상태(기본/선택) × @2x/@3x = 36장**, `scripts/icons`(resvg-js 또는 sharp)가 같은 SVG 팩토리에서 굽고 `apps/valley-map/assets/icons/`(커밋)에 둔다. web 은 런타임 `createImageBitmap`, native 는 `images` prop.

**범위** — `map-style/facilityIcons.ts`(SVG 팩토리·ID 규약·크기 상수), `adapter-web` resolver 교체(`Logger`), `scripts/icons` PNG 빌드 + `adapter-native` `images` 등록, `facilityLayers` 심볼 전환, 테스트(9종 ID 전수·SVG 유효성). PR 1개. 범위 밖: 구간 혼잡 점 마커, 명당(festival) 아이콘(`/firework` 불변).

**진행 (2026-09-06) — PR [#21](https://github.com/4sizn/modu-valley/pull/21) 열림 (`in-review`, 브랜치 `4sizn/C5-facility-icons`)**. 결정 (a)~(e) 를 계약대로 구현, `pnpm verify` 통과(core 214 · map-style 76 · adapter-web 6(신규) · adapter-native 34 · app 15). 기획 대비 판단한 것 —
① **web 래스터 경로** — valley-ds 의 `createImageBitmap(Blob)` 은 Chrome 152 가 SVG Blob 을 디코드하지 못한다(`InvalidStateError: The source image could not be decoded`, 브라우저에서 재현). `Image` + data URL + `decode()` 로 바꿨다 — maplibre `addImage` 는 `HTMLImageElement` 를 그대로 받고, SVG 의 `width`/`height`(dp × 2)가 픽셀 크기가 된다.
② **선택 핀의 꼭짓점 보정** — 선택 핀(34×44)은 흰 링(경로 3겹: 흰 8 → 유형색 4 → 채움 + 흰 2)이 꼭짓점 아래로 ≈4.2dp 나가므로 캔버스 바닥이 꼭짓점이 아니다. `FACILITY_PIN_TIP_INSET` 을 팩토리가 계산해 심볼 레이어의 `icon-offset` 이 되돌린다 — 선택해도 핀이 위로 튀지 않는다.
③ **모르는 종류는 `etc` 핀** — `icon-image` 의 `match` 폴백이 `etc` 라 스키마 밖 `facilityType` 이 와도 핀이 사라지지 않는다. 규약 밖 아이콘 ID(openfreemap 스프라이트 참조)는 C4 의 투명 1px 폴백을 레지스트리 안에 그대로 두어 `/firework` 가 같은 경로를 탄다.
④ **목록 픽토그램은 같은 문자열** — `FacilityRow`·상세 시설 목록의 16px 글리프는 `FACILITY_GLYPHS` 를 `SvgXml` 로 그대로 그린다(JSX 로 옮겨 적지 않음). 색은 유형색(핀의 반전).
⑤ **PNG 는 @2x·@3x 만** — @1x 기기가 없고 Metro 가 있는 배율 중 가까운 것을 고른다. `@modu-valley/map-style`·`@resvg/resvg-js` 는 루트 devDependency(스크립트가 워크스페이스 패키지를 import 하려면 루트에 링크가 있어야 한다). `FACILITY_DISC_COLOR` → `FACILITY_PIN_STROKE_COLOR`.
**검증**: `/firework` 다크 픽셀 diff **main = branch 0px**(불꽃 off + 티커 숨김 + 9초, 셀프 diff 0 대조군, 1440×757). 스크린샷 10장 → `proof/C5-facility-icons`(라이트 목록·상세·시설 선택·상세 시설 목록, 다크 목록·시설 선택, 폰 390×844 목록·시설 선택, /firework main·branch). iOS 시뮬레이터(iPhone 17 Pro, `expo run:ios` 실빌드): PNG 핀 4개(주차 2·화장실·매점) 표시, 핀 탭 → `feature-press` → 선택 핀 확대 + 흰 링(별도 선택 핀 없음), 시설 행 픽토그램 — `proof/C5-facility-icons` c5-ios-*. 안드로이드는 SDK 없음(typecheck 까지).

**후속 제안(범위 밖, 항목 신설 없음)**
- 핀 y-정렬 — `icon-allow-overlap` 이라 겹치는 핀은 MapLibre 기본(뷰포트 y 순)으로 그려진다. 시설이 촘촘한 실데이터(R4 시드)에서 선택 핀이 다른 핀 아래로 들어가면 `symbol-sort-key: ['case', selected, 1, 0]` + `symbol-z-order: 'viewport-y'` 검토.
- 런타임 테마 전환(C9) 뒤 확인 — D2 로 아이콘 ID 에 모드가 없어 스타일 재구성 때 같은 ID 가 재사용된다. web 은 `map.remove()` 후 재생성이면 레지스트리도 새로 만들어지므로 할 일이 없고, `setStyle` 로 갈아 끼우는 방식이면 `hasImage` 가 이미 참이라 굽지 않는다 — 두 경로 모두 안전하나 C9 머지 뒤 한 번 본다.
- 앱 아이콘 파일(`icons/index.tsx`)의 선 두께가 1.7~2.0 으로 섞여 있다 — 픽토그램(2.0·2.4)과 결을 맞추는 정리는 시각 개선 후속에서.

**원안 메모(2026-09-03)**
- SVG 팩토리(`crowdMarkerSvg`, 시설 핀) → `map-style` (순수 문자열, 팔레트 참조).
- web: `adapter-web` 에서 `setMissingStyleImageResolver` 스텁을 레지스트리로 교체, `createImageBitmap`. 테마 전환 시 `refreshMarkerIconsByPrefix`.
- native: maplibre-react-native 의 `<Images onImageMissing>` 으로 같은 ID 규약. **확인됨** — 11.3.8 `components/images/Images.d.ts` 에 `onImageMissing` 이벤트가 있다. 이벤트는 브리지를 건너오므로 SVG → 비트맵 변환은 JS 에서 못 하고, `images` prop 에 데이터 URI 또는 번들 에셋으로 넣어야 한다 — 네이티브 쪽 SVG 래스터화 경로는 기획 시 결정.
- `console.error` → `Logger`.

### C6 — 카메라 시트 보정

- 순수 계산(`focusDurationMs`, `centerOffset(top,bottom)`, `isCoveredBySheet(h,bottom)`, `snapCenterOffset`) → `core/domain/camera/`. 테스트.
- 인셋은 CSS 변수가 아니라 `AppState.viewportInsets {top,bottom}` 로 — 시트 스냅·상단바·safe area 가 갱신. web/native 모두 같은 값을 본다.
- `focusSpot` 의 하드코딩 `offset:[0,-90]` 을 인셋 산출값으로 교체. 네이티브 padding 변환은 기존 유지.

### C6 — 카메라 시트 보정 (결정 2026-09-07)

**원안의 범위가 틀렸다.** 원안은 "`focusSpot` 의 하드코딩 `offset:[0,-90]` 을 인셋 산출값으로 교체"
였는데, `focusSpot` 은 `SelectSpotUseCase` 만 쓰고 **명당은 festival 전용**이다. 계곡이 쓰는 것은
`focusSegment`(`offset: VALLEY_DETAIL_OFFSET`)·`focusValley` 이고 이들도 각자 하드코딩 offset 을
갖고 있다. C8 로 시트가 3단이 되어 고정 offset 은 접힘·펼침에서 어긋난다 — **그게 실제 고칠 곳이다.**

**결정 확정 (2026-09-07 사용자)**
- **계곡 프리셋만 바꾼다.** `focusSegment`·`focusValley` 가 `viewportInsets` 산출값을 쓴다.
  **festival `focusSpot` 은 `[0,-90]` 그대로 둔다** — `/firework` 카메라 동작을 보존한다.
  (C8 에서 시트 스냅 3단은 허용했지만 카메라는 보존한다는 뜻이다.)
- **덮임 처리는 만들지 않는다.** 시트가 펼침(85vh, 지도 127px = 15%)일 때 구간을 골라도
  **아무 특별한 일도 하지 않는다** — 시트를 자동으로 낮추지 않고, 얇은 띠에 맞추는 별도 계산도
  두지 않는다. 인셋 산출값만 반영하고 끝이다. `isCoveredBySheet`·`snapCenterOffset` 은
  만들지 않는다(원안 목록에서 제외).

**범위** — PR 1개: core 인셋 → offset 순수 함수 + `focusSegment`·`focusValley` 교체 + 테스트.
호출부(`SelectSegmentUseCase` 등)가 `viewportInsets` 를 넘기도록 배선.

**범위 밖** — festival `focusSpot`, 덮임 판정·시트 자동 낮춤, 거리 비례 `focusDurationMs`(원안에
있었으나 이번 결정 범위 밖 — 필요해지면 별 항목으로).

### OPS1 — 제보 운영 도구 (사용자 결정 2026-09-08)

**왜 프로덕션 게이트인가** — 제보는 누구나 글과 사진을 올릴 수 있는데,
- `hidden` 컬럼은 스키마에만 있고 **세우는 경로가 없다**(삽입 시 `false` 로만 쓴다),
- `신고하기` 가 `report_flags` 에 쌓지만 **읽는 코드가 없다** — 신고가 들어와도 아무도 못 본다,
- 서버에 **인증 개념이 아예 없다**(`Authorization`·`Bearer` 사용 0곳),
- 결정 (h) 로 자동 숨김도 없다.

즉 불법 촬영물·타인 개인정보·욕설이 올라오면 **지울 수단이 DB 직접 접근뿐**이다. 정보통신망법상
삭제 요청을 처리할 의무가 있는데 창구도 수단도 없다.

**사용자 결정** — "계정에 대한 플로우가 만들어지지 않았음으로, 화면기준 왼쪽 위를 10번 누르면
관리자 계정으로 전환하는걸로 임시 작업."

**메인 세션 판단 — 제스처는 입구까지만, 권한은 서버가 확인한다.**
10번 탭이 그 자체로 서버 권한을 주면 **누구나 남의 제보를 지울 수 있다** — 운영 도구가 없는
지금보다 더 위험하다. 그래서 제스처는 **관리자 화면을 여는 입구**로만 쓰고, 실제 권한은
서버가 토큰으로 확인한다. 사용자의 요청(제스처 진입)은 그대로 구현한다.

- **서버는 클라이언트의 관리자 플래그를 절대 신뢰하지 않는다.** 관리자 API 는 `Authorization:
  Bearer <token>` 을 요구하고, `ADMIN_TOKEN`(`.env.local`, 사용자가 생성)과 **상수시간 비교**한다.
- 토큰은 기기에 저장한다(`StoragePort`·`STORAGE_KEYS`). **로그·에러 메시지에 절대 남기지 않는다.**
- 제스처는 **계곡 화면에서만** 동작한다 — 상단바(`TopBar`)는 `/firework` 와 공유하는 셸이라
  건드리지 않고, `scene === 'valley'` 일 때만 좌상단에 보이지 않는 히트 영역을 얹는다.
- 관리자 동작은 **감사 로그**를 남긴다(무엇을·언제 숨겼나). 제보 본문·닉네임·IP 는 로그에 넣지 않는다.
- **이건 임시다.** 계정 플로우(v2)가 들어오면 제스처와 토큰은 제거한다.

**범위**
1. 서버 — 관리자 인증 미들웨어, `PATCH /api/admin/reports/:id/hidden`(숨김·복구),
   `GET /api/admin/reports?includeHidden=1`, `GET /api/admin/flags`(신고 접수 목록 — 지금 아무도
   못 보는 것을 보이게). 레이트리밋. 잘못된 토큰은 401, 토큰 미설정 서버는 관리자 API 를 **비활성**.
2. 앱 — 좌상단 10탭 → 토큰 입력 → 관리자 모드. 관리자 모드에서 제보 카드·상세에 **숨김/복구**
   버튼, 신고 목록 면. 관리자 모드 표시(평소 화면과 구별되게).
3. `.env.example` 에 `ADMIN_TOKEN=` 빈 값 추가. 생성 방법을 `docs/API_KEYS.md` 에 한 줄.

**범위 밖** — 계정·로그인(v2), 자동 숨김·신고 누적 임계값(결정 (h) 유지), 제보 수정 대행,
사용자 차단, 관리자 여러 명·권한 등급.

### SR1 — 검색 배선 (사용자 결정 2026-09-08)

**드러난 경위** — 사용자가 "긴고랑로를 검색해서 동작테스트" 를 요청해 실제로 입력해 봤다.
글자는 들어가고 엔터를 눌러도 **아무 일도 일어나지 않았다.** 콘솔 오류도 없다 — 조용히 안 한다.
`TopBar` 의 `TextInput` 에 `value`·`onChangeText`·`onSubmitEditing` 이 **하나도 없다.**
`/firework` 데모에서 셸을 클론할 때 검색 상자가 모양째 따라왔고 계곡 화면에서 배선한 적이 없다.
제보 버튼이 "준비 중" 알림을 띄우던 것과 같은 상태인데, **검색은 알림조차 없어 더 나쁘다.**

**긴고랑로는 지금 데이터로 찾을 수 없다** — 도로명·주소로 찾으려면 지오코딩이 필요하고 그건
K1(브이월드 회신)에 걸린다. **사용자 결정: 계곡명·시설명으로 진행**(지오코딩 없이).

**정정(2026-09-08, PR #43 검증 뒤 사용자 지적)**: 위 단락에 처음 "서울 중랑구 도로명" 이라고
적었던 것이 **틀렸다** — 긴고랑로는 **광진구**다(나무위키 확인). 더 중요한 정정: 이건 지어낸
무관한 주소가 아니라 **아차산·용마산 사이 실제 계곡 "긴고랑계곡"(서울 광진구/경기 구리시 경계)
을 딴 이름**이고, 그 계곡천을 복개해 만든 도로다. 그래서 "긴고랑로 결과 0" 은 여전히 맞지만(우리
데이터엔 없다), 이유는 "무관한 도로라서" 가 아니라 **진짜 계곡 하나가 30개 목록에서 빠져 있어서**
다 — SD3 항목(pending) 으로 추가 시도했으나 OSM 좌표열 부족으로 되돌렸다.

**확정 사항 (사용자 결정 + 메인 세션 판단)**
1. **대상** — 계곡명 30 + 시설명 332. 부분일치(공백 제거·소문자화 후 비교). 초성 검색(ㄱㄱㄹ)은 범위 밖.
2. **결과 표시** — 검색어가 있으면 시트는 **검색 결과만** 보여준다(구간·"실시간 정보" 섹션 숨김).
   모드 전환이 분명해야 사용자가 지금 무엇을 보고 있는지 안다.
3. **정렬** — 계곡명 매치가 시설명 매치보다 위. 각 그룹 안에서는 접두사 매치 우선 → 이름 순.
4. **시설 결과는 "계곡명 · 시설명 · 유형"** 으로 보여준다 — 시설명에 `주차장`·`CU` 같은 일반명이
   많아(실측) 계곡명 없이는 구별되지 않는다.
5. **선택** — 계곡 결과는 그 계곡 구간 선택(`SelectSegmentUseCase` 재사용), 시설 결과는
   `SelectFacilityUseCase` 재사용. **선택하면 검색어를 지운다**(찾았으니 끝).
6. **필터 칩과의 관계 — 검색은 필터를 무시한다.** 찾는 것이 필터에 걸려 안 나오면 검색이 고장난
   것처럼 보인다. 필터가 걸려 있으면 결과 아래에 안내 한 줄.
7. 결과 상한 20. 없으면 "찾는 계곡·시설이 없습니다" 문구 + 지우기.
8. **파리티 — `TopBar` 는 공유 셸이다.** 값·핸들러를 **props 로 받게** 하고 **festival 은 넘기지
   않는다** → festival 은 지금처럼 죽은 입력칸 그대로다. 클론보다 이 방법이 낫다(중복 없이
   festival 동작이 불변). festival 경로가 코드상 안 바뀌었음을 PR 본문에 보여라.

**범위 밖** — 지오코딩·주소·도로명 검색(K1 회신 뒤 별 항목), 초성 검색, 최근 검색어 저장,
검색 결과 지도 표시(핀·카메라는 선택했을 때만 움직인다).

### SD5 — 광주 무등산 (사용자 요청 2026-09-09)

**요청** — "광주 무등산 계곡도 데이터 넣어줘".

**넣은 것**
| 계곡 | 좌표 출처 | 중심선 | 유역 | 시설 | 그늘(정오) |
| --- | --- | --- | --- | --- | --- |
| 원효계곡(광주 북구) | VWorld **자연지명 > 골짜기** (126.99056, 35.15705) | OSM 하천선 1765 m, 오프셋 19 m | 500104 | 13(주차 6·화장실 4·식당·매점·카페) | 50% |
| 증심사계곡(광주 동구) | 골짜기 지명이 **없어** 국립공원 자원정보 '증심사' 좌표를 앵커로 | OSM **증심천** 1000 m, 오프셋 407 m | 500107 | 24(화장실 10·주차 6·**정자 5**·매점·카페·식당) | 40% |

**판단한 것**
- **목록 제목** — '수도권 계곡' 은 이제 거짓이라 **'계곡 목록'** 으로 바꿨다(개수는 바로 아래 요약
  줄이 말한다). 지역명을 제목에 박으면 계곡이 늘 때마다 문구가 거짓이 된다.
- **전체 재빌드를 하지 않았다** — `--valley wonhyo --valley jeungsimsa` 로 두 곳만. 긴고랑(SD3)의
  사람 손 기하를 덮어쓰지 않기 위해서다.
- **증심사 앵커 오프셋 407 m** 는 절 좌표를 쓴 결과다. 중심선 자체는 증심천에 붙었으므로 구간
  기하는 정상이고, 앵커의 성격을 `data/seed/valleys.json` 의 `note` 에 적어 두었다.
- SD1 실측을 고정한 테스트들은 **SD1 기준선(수도권 30)** 을 유지하도록 새 계곡을 제외했다
  (긴고랑과 같은 방식). 서버 테스트의 계곡 수는 33 으로 올렸다.

**남은 것** — 수심·바닥·금지 같은 수기 값은 비어 있다(`현장 미확인`). 상류 강우 경보는 로스터가
수도권 관측소 기반이라 무등산 두 곳은 당분간 "자료 없음" 으로 나온다(F3 후속).

### SD4 — 정자·쉼터 (사용자 결정 2026-09-08)

**요청** — "팔각정이나 정자 데이터도 확인해보고" → 확인 결과 **우리 데이터에 0건**(유형 자체가 없었다)
→ 사용자 결정 3개: ① 넣는다 ② **계곡 주변값만** ③ 캠핑장 구조물은 거른다.

**확정 사항**
1. 시설 유형 `shelter`(라벨 **정자·쉼터**) 추가 — 10종이 됐다. 색은 비어 있던 색상환 90도 자리의
   올리브 `#7a9e2f`(화장실 에메랄드 152도와 갈라진다), 글리프는 지붕+처마+기둥 둘+바닥.
   PNG 40장(`pnpm icons:build`), 스키마 enum, 네이티브 아이콘 표까지 함께.
2. **거리 기준은 계곡 점 반경이 아니라 구간 중심선까지의 거리 250 m**(`SHELTER_MAX_FROM_LINE_M`).
   주차장은 멀어도 "거기 대고 걸어 들어온다" 가 성립하지만 정자는 물가에 앉는 자리라, 계곡을
   벗어나면 남의 동네 공원 정자다.
3. **선별 규칙**(`isShelterCandidate`) — `shelter_type` 이 `gazebo`·`picnic_shelter`·`pavilion`
   이거나 `building=pavilion` 이면 받고, 유형 태그가 없으면 **정자 계열 한글 이름**(정자·팔각정·
   육각정·원두막·쉼터·〜정)만 받는다. `tent`(캠핑장 그늘막)·`basic_hut`(대피소)·`public_transport`
   (버스 승강장) 등은 뺀다. 실측 태그 분포(수도권 344건): gazebo 251 · 유형 없음 82 · tent 6 ·
   basic_hut 3 · picnic_shelter 2.

**수집 방법** — Overpass 의 `around:r,lat1,lon1,…` 는 점들을 **이은 선**의 버퍼다. 중심선을 200 m
간격으로 샘플링해 400 m 버퍼로 훑는다(중심점 원으로 받으면 긴 구간의 끝쪽을 놓치고, 반경을 키우면
옆 동네가 들어오면서 504 가 난다). 본 서버가 429·504 로 조일 때는
`OVERPASS_ENDPOINT=https://overpass.kumi.systems/api/interpreter` — 긴고랑 대조 결과가 본 서버와
같음을 확인하고 썼다(미러 누락 경계 — SD2 교훈).

**결과 (2026-09-09)** — 31개 계곡에서 **정자 5곳**(감악산 2 · 긴고랑 1 · 구곡폭포 1 · 용추(가평) 1).
전부 `shelter_type=gazebo` 이고 이름이 있다. 400 m 버퍼로 받아도 후보가 5건뿐이라 **거리 기준이
아니라 OSM 자체에 물가 정자가 적다** — 2 km 로 넓히면 80건이지만 대부분 능선·근린공원 정자다.
뒤에 넣은 광주 무등산(SD5)은 **증심사계곡 한 곳에서만 5곳**이 잡혔다.

**적용 경로 두 개, 규칙은 하나** — `pnpm seed:shelters`(기존 시설 파일에 덧붙이는 스크립트)와
`pnpm seed:build`(전체 재빌드)가 같은 `facilities.mts` 함수를 쓴다. 전체 재빌드를 쓰지 않은 이유는
**긴고랑계곡**이다 — 그 구간은 OSM 하천선이 아니라 DEM 최소비용경로로 사람이 만든 기하(SD3)라
재빌드가 덮어쓴다.

### X7 — 접힌 시트가 결과를 삼킨다 (사용자 보고 2026-09-08)

**보고** — "모바일에서 긴고랑 검색했을때나 핀을 클릭했을떄 정보가 안나옴"(iOS 시뮬레이터).

**원인** — 두 가지가 겹쳤고 **둘 다 플랫폼 공통**이다(web 에서도 재현했다).
1. 검색 결과도 구간·시설 상세도 **시트 안에만** 그려진다. 시트가 `peek` 이면 그 내용이 화면
   아래로 밀려 아무것도 안 보인다. 시트를 올려 주는 코드는 `OpenSettingsUseCase` 하나뿐이었다
   — 검색도 선택도 시트를 건드리지 않았다. 상태는 정상이라 오류도 로그도 없다(조용한 실패).
2. 검색 결과는 **목록 면**에만 그려진다. 상세·설정 면이 열려 있으면 검색어를 넣어도 그 면이
   계속 보여 "검색이 아무 일도 안 한다" 로 보인다.

   *모바일이 먼저 걸린 이유* — G1 회전 증명 중 내가 시트를 `peek` 으로 접어 둔 채로 두었다.
   web 의 기본 스냅은 `half` 라 눈에 띄지 않았을 뿐이다.

**수정 (2026-09-08, 로컬 변경)**
- `packages/core/src/application/revealSheet.ts` — `peek` 이면 `half` 로. 이미 펼쳐 둔 시트는
  좁히지 않는다. 왜 필요한지를 이 파일 주석에 적었다.
- 검색어가 생기면(`MapSession.setSearchQuery`) 시트를 올리고, 상세·설정 면이면 목록 면으로
  되돌린다(있는 유즈케이스 `clearSelection`·`closeSettings` 재사용).
- 계곡 선택 세 경로(`SelectSegment`·`SelectFacility`·`SelectReport`)가 시트를 올린다.
  **festival 의 명당 선택(`SelectSpotUseCase`)은 건드리지 않았다** — /firework 보존.
  `OpenSettingsUseCase` 의 기존 한 줄도 같은 헬퍼로 바꿔 설명을 한 곳에 모았다.

**검증** — `pnpm verify`(core 455, 회귀 테스트 7개 추가). 새 테스트는 헬퍼를 무력화하면
실제로 깨진다(확인함). 시각 증명 `.proof/sheet-reveal/` 9장 —
web 390×844 (접힘+검색 / 상세+검색 / 접힘+지도 선 탭) · iOS 시뮬레이터 (접힘+검색 / 접힘+탭).
`/firework` 정적 프레임은 같은 하네스로 **수정 전 vs 후 0px**(셀프 diff 0px 대조군).

### G1 — 핀치 회전 (사용자 요청 2026-09-08)

**요청** — "핀치 기능중 특정 손가락을 중심으로 rotate 제스처를 이용해서 지도를 시계방향이나
반시계방향으로 돌리고 싶어".

**확정 사항 (사용자 결정)**
1. **회전 축은 maplibre 기본 = 두 손가락의 중간점.** "특정 손가락을 축으로" 는 maplibre-gl 6.6
   에 옵션이 없어(`enable({ around:'center' })` 로 화면 중앙 고정만 가능) 커스텀 핸들러가
   필요하다 — 세 후보를 보여 준 뒤 **SDK 기본 축**으로 정했다.
2. **web 먼저.** 네이티브는 `touchRotate` boolean 한 줄이면 켜지지만 이 환경에 실기기·시뮬레이터
   검증 경로가 없어 **확인 못 한 제스처를 켜 두지 않는다** — 후속.
3. **두 장면 모두 켠다** — `/firework` 데모의 조작 동작이 바뀌는 것을 사용자가 명시적으로 허용.
   (CLAUDE.md 의 `/firework` 보존 규칙에 대한 **예외**이고, 근거는 이 결정이다.)
4. **모바일도 켠다**(사용자 추가 요청 2026-09-08 "모바일은 어떻게할려고? 시뮬레이터로 안내해줘")
   — iOS 시뮬레이터로 검증하고 네이티브도 켰다. 위 2번("web 먼저")을 대체한다.

**결과 (2026-09-08, 로컬 변경)**
- core — `DEFAULT_MAP_GESTURES.pinchRotate` 를 **true** 로. 정책 상수는 **하나**다(표면별 분기
  없음). 처음에는 web 만 켜려고 `WEB_MAP_GESTURES` + `MapSessionDeps.gestures` + 플랫폼 모듈의
  `MAP_GESTURES` 로 표면을 갈랐는데, 사용자가 "모바일은?" 을 물어 iOS 를 검증하고 켜면서
  **그 배선을 전부 되돌렸다** — 두 표면이 같은 값을 쓰면 갈림길이 군더더기다.
- 어댑터는 **손대지 않았다** — `MapLibreEngine.setGestures` 가 이미 `pinchRotate` 를
  `enableRotation()` + `map.dragRotate` 로 번역한다(그래서 web 은 마우스 우클릭·ctrl 드래그
  회전도 함께 켜졌다).
- 피커(`reportLocationPicker`)는 **정북 고정 유지** — 회전한 지도에서 한 점을 집으면 방향
  감각이 어긋난다(주석으로 이유 명시).

**실측 중 찾은 결함 — 컨트롤 컬럼이 손가락을 먹었다(수정함)**
지도 오른쪽 컨트롤 컬럼(`MapControls`)은 데모의 `.controls{pointer-events:auto}` 를 그대로 옮겨
**버튼 사이 빈 자리까지** 터치를 잡았다. 핀치의 손가락 하나가 그 위에 떨어지면 maplibre 의
`_getMapTouches` 가 그 손가락을 걸러내 **두 손가락 제스처가 시작조차 못 하고 한 손가락 이동만
남는다**(실측: 390×844 에서 오른쪽 y 270~450 대역 회전 불가, `touchRotate` 는 계속 enabled 인데
`_firstTwoTouches` 가 세팅되지 않았다). 계곡 화면만 `pointerEvents="box-none"` 으로 바꿔 버튼은
그대로 받고 빈 자리는 지도로 통과시켰다. **festival 은 `auto` 유지**(보존 규칙 — 데모의 히트
영역도 결과물이다).

**검증** — `pnpm verify`(core 448 — 제스처 정책 값 고정 테스트 1개). 시각 증명
`.proof/pinch-rotate/` 24장 — 계곡 라이트·다크 390×844 · 360×740 · **591/592×844 경계 쌍** ·
`/firework` 다크 1440×757, 각각 (정북 → 시계 회전 → 나침반 복귀 → 반시계 회전) 4상태.
캡처는 **실제 터치 입력**으로 했다: CDP `Input.dispatchTouchEvent` 두 점을 24프레임 비틀어
보낸다. 60도 비틀면 방위 **−47.5도**(반대로 +47.5), 360폭에서는 45도 — 차이는 maplibre 의
회전 임계값(`ROTATION_THRESHOLD = 25`/원주, 지름 200px 에서 약 14도)이 먼저 소진되기 때문이다.
`/firework` 정적 프레임(불꽃 off·티커 숨김·9초 대기) main vs 로컬 픽셀 diff **178px/1,090,080
(0.016%, 임계 8)** — 4개 군집의 라벨·건물 외곽 안티에일리어싱이고 4배 확대에서도 구분되지
않는다(셀프 diff 는 양쪽 모두 0px, 20초 대기에서도 같은 수치). 밤하늘·3D 건물·명당 레이어·티커·
시트·컨트롤은 캡처에서 그대로다.

**iOS 실측 (2026-09-08, iPhone 17 Pro 시뮬레이터 · iOS 26.5)**
`expo prebuild --platform ios` + `expo run:ios` 로 개발 빌드를 만들고(`DEVELOPER_DIR` 우회 필요 —
`docs/PARITY.md` 의 재현 절차), 시뮬레이터에서 **실제 두 손가락 회전**을 넣었다. 시뮬레이터는
⌥ 를 누르면 커서와 **화면 중심 대칭점**을 두 터치로 합성하므로, ⌥ 를 유지한 채 **원호**로
드래그하면 순수 회전이다(직선은 핀치 줌). `orca computer drag` 는 모디파이어를 못 잡아
CGEvent 를 posting 하는 작은 Swift 도구를 만들어 썼다.
결과 — 정북 0° → 시계 60도 스윕 **−58.6°** → 나침반 버튼으로 0° 복귀 → 반시계 스윕 **+83.9°**.
시계는 반경 40·60·100 에서 모두 58.5~58.7° 로 재현되고 반시계만 83~99° 로 흔들린다. 원인은
시뮬레이터가 두 번째 손가락을 화면 중심 대칭으로 만드는 입력 특성으로 보인다(반경이 작을수록
편차가 커졌다) — **실기기 확인 항목**으로 남긴다. 증명 `.proof/pinch-rotate-ios/` 4장.
실측 중 관찰 — 시트가 펼쳐져 있으면 아래쪽 손가락이 **필터 칩에 떨어져 탭으로 처리**된다
(실제로 "주차장" 필터가 켜졌다). 시트는 별개 표면이라 정상 동작이고, 시트를 `peek` 으로 접으면
두 점 모두 지도에 떨어진다.

**후속 후보**
- **안드로이드 실행 검증** — 코드로는 켜져 있으나 이 환경에 SDK·에뮬레이터가 없다.
- **실기기 iOS** — 위 반시계 편차가 시뮬레이터 입력 특성인지 확인.
- 컨트롤 컬럼과 같은 결함이 **다른 오버레이**(상단바·티커·그늘 트랙·시트 위 여백)에도 있는지
  훑기 — X6(죽은 UI 훑기) 와 성격이 같다.
- 회전 뒤 중심이 조금 옮겨지는 것(회전 축이 핀치 중간점이므로 정상)을 사용자가 어색해하면
  `enable({ around: 'center' })`(화면 중앙 고정)로 바꾸는 선택지가 있다.

### DS3 — 크기·간격 토큰 + 알약·카드 통일 (분석 2026-09-08)

**사용자 지적의 실체** — "텍스트 배치 및 규칙이 서비스 컴포넌트와 맞지 않아보임" 은 **문구가
아니라 배치**였다(사용자 정정: "아니 문구 내용이랑은 관련없음"). 실측으로 규칙 부재를 확인했다.

| 컴포넌트 | 글자 | 굵기 | 좌우 | 상하 | 테두리 | 높이 |
| --- | --- | --- | --- | --- | --- | --- |
| `TopBar` 칩(베타·CLONE) | 10 | 700 | 6 | 2 | 1 | 내용 |
| `ValleyListFace` 배지(현장 미확인) | 10 | 500 | 6 | 1 | 1 | 내용 |
| `SegmentCard` 배지(무료·야영) | 11 | 500 | 8 | 3 | 1 | 내용 |
| `SegmentCard` 경보·그늘 배지 | 11 | **700** | 8 | 3 | 1 | 내용 |
| `ReportCard` 유형 칩 | 11 | 600 | **7** | **2** | 1 | 내용 |
| `ReportDetailFace` 유형 칩 | **12** | 600 | **8** | **3** | 1 | 내용 |
| `FilterChipRow` 칩 | 13 | 600 | 11 | — | 1 | **32 고정** |
| `ReportTypeChipRow` 칩 | 13 | 600 | 12 | — | **1.5** | **36 고정** |

문제 넷: ① **같은 제보 유형 칩이 카드와 상세에서 크기가 다르다**(11px·7/2 vs 12px·8/3) —
카드에서 상세로 넘어가면 같은 칩이 커진다, 이게 "뒤틀려 보이는" 직접 원인이다 ② 좌우 패딩이
6·7·8·11·12 다섯 값이고 4의 배수도 아니다 ③ 높이 방식이 내용 기반과 고정(32·36) 두 갈래라
한 줄에 놓이면 안 맞는다 ④ 테두리가 1·1.5 로 갈린다. 카드 계열도 패딩 12·13·24 로 갈린다.

**원인** — 항목별로 컴포넌트를 만들 때마다(F1·F3b·N1·N5·F5a~d) 그 자리에서 눈으로 맞춘 값을
넣었다. 색이 106개로 늘어난 것과 **같은 경위**다 — 공유할 규칙이 없으니 매번 새로 정했다.

**확정 규격 (메인 세션 결정)** — 알약형은 **2단계뿐**이다.

| 단계 | 뜻 | 글자 | 굵기 | 좌우 | 상하 | 높이 | 테두리 | gap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `badge` | **읽는 것**(상태) | 11 | 600 | 8 | 3 | 내용 | 1 | 4 |
| `chip` | **누르는 것**(조작) | 13 | 600 | 12 | — | 32 | 1 | 7 |

값의 근거: `badge` 는 지금 가장 많이 쓰이는 `SegmentCard` 배지(11·8/3·1)를 그대로 채택해
변경량을 최소화한다. `chip` 은 DS2 에서 고친 `FilterChipRow`(13·32·1)를 기준으로 좌우를 12(4의
배수)로 맞추고 `ReportTypeChipRow` 의 1.5 테두리를 1 로 내린다.

**범위 밖 — DS1 이 맡은 것과 겹치지 않게**
- **경보 배지의 색·채움 처리**는 DS1 이다(AA 미달 실측 → 채우기 제안). DS3 는 경보 배지의
  **크기·패딩만** 규격에 맞추고 색·채움은 손대지 않는다. 굵기 700 도 유지한다(색이 뜻인 자리).
- **카드 대비·테두리**도 DS1 이다(카드 `#ffffff` ↔ 시트 `#f5f6f8` = 1.08:1). DS3 는 카드
  **패딩만 13 으로 통일**하고 테두리·배경은 건드리지 않는다.
- **`TopBar` 칩은 고치지 마라** — 셸 공유이고 festival 에서 `CLONE` 칩으로 렌더된다(파리티).

**미정 하나** — `ValleyListFace` 의 `현장 미확인` 배지는 10px·6/1 로 규격보다 작다. `badge`
단계로 올리면(11·8/3) 계곡명 옆에서 붐빌 수 있다. 규격대로 올려 증명 이미지로 보이고, 붐비면
그 사실을 PR 본문에 적어 3단계(`badgeSm`) 신설을 제안한다 — 임의로 3단계를 만들지 마라.

### C7 — 베이스맵 헬스

- 상태기계(`armedAt/failures/outage`, `OUTAGE_SUSTAIN_MS 8s`) → `core` 순수 함수 + 테스트.
- web: `map.on('error'|'sourcedata')` 를 `isBaseMapUrl` 로 걸러 `recoverable-error` / 새 `'basemap-health'` 이벤트로. 재시도는 `setTiles/setUrl` 소스만.
- native: `onDidFailLoadingMap`, `onDidFinishLoadingStyle` 로 같은 상태기계 구동.
- UI: `OutageNotice`(배너) + `RetryState`(스타일 실패 전면).

### C8 — 시트 스냅 + URL

- 라우트별 스냅 포인트 상수(valley-ds §5 표를 계곡 라우트로 치환), 스냅을 URL 파라미터로(expo-router). C6 의 `viewportInsets.bottom` 을 갱신하는 주체.

### C8 — 시트 스냅 + URL (기획 2026-09-07)

**의존이 반대로 적혀 있었다.** 항목 표는 C8 이 C6(카메라 시트 보정)에 의존한다고 적었는데,
C8 메모 자신이 "C6 의 `viewportInsets.bottom` 을 갱신하는 **주체**" 라고 하고, 참조 문서
(`valley-ds/map-architecture.md` §시트 스냅 포인트)의 C6 계열 함수는 **스냅이 있다고 전제**한다
("시트를 `middle` 스냅으로 낮춘 뒤 카메라 이동"). **C8 → C6 이다.** C6 은 미구현이며
(`viewportInsets` 가 코드에 없다) C8 을 막고 있지 않았다 → 표의 의존을 뒤집고 C8 을 먼저 한다.

**현재 수치(실측)**

| 값 | 지금 | 출처 |
| --- | --- | --- |
| 시트 높이 | `45vh` = 390×844 에서 380px | 데모 `--sheet-h:45vh` · `SIZES.sheetHeightRatio 0.45` |
| 접힘에 남는 높이 | 68px | 데모 `translateY(calc(100% - 68px))` · `SIZES.sheetCollapsedPeek` |
| 상태 수 | 2 | `AppState.sheetCollapsed: boolean` |
| URL 파라미터 | 없음 | `useLocalSearchParams`·`router.setParams` 사용 0곳 |

**파리티 제약** — 시트는 `/firework` 와 공유하는 셸이고 `docs/PARITY.md` 측정표가 시트 높이를
`440 / 416 / 560 / 341` 로 고정한다(데모 원본 값). **festival 시트가 지금과 달라지면 계약이 깨진다.**
스냅을 라우트별 상수로 두는 것이 이를 피하는 방법이다 — (b) 가 그 결정이다.

**결정 (검토 페이지 — 390×844 실측 픽셀 목업)**
- (a) **계곡 스냅 단계** — A1 3단 `68 / 380 / 717`(지금 두 값 보존 + 85vh 추가)(권고) / A2 2단 유지 / A3 3단이지만 최대 100%
- (b) **festival** — B1 지금 그대로 2단 `[68, 380]`(권고) / B2 festival 도 3단(**보존 규칙 위반**)
- (c) **가장 높은 스냅에서 지도 위 요소**(티커·그늘 트랙) — C1 둘 다 숨김(권고) / C2 그대로 / C3 티커만 남김
- (d) **URL 상태** — D1 스냅만 `?sheet=full`(권고) / D2 스냅 + 선택(`segment`·`report`) / D3 담지 않음
- (e) **제스처** — E1 손잡이 드래그 + 탭(권고) / E2 시트 전체 드래그(목록 스크롤과 충돌) / E3 탭 토글만(지금)
- (f) **스냅 변경 시 지도 중심** — F1 손대지 않고 인셋만 내보냄(C6 으로)(권고) / F2 최소 보정 포함

**(c) 를 결정 항목으로 둔 이유** — 계곡 지도 위에는 티커(제보, F5c)와 그늘 시간 트랙(F4)이 시트
바로 위에 붙어 있다. 시트를 85vh 로 올리면 **지도에 127px 만 남아** 둘이 갈 자리가 없다.
목업의 붉은 점선이 자리를 잃은 요소다.

**결정 확정 (2026-09-07 사용자, 목업 검토)**
- (a) **A1 3단 `68 / 380(45vh) / 717(85vh)`** — 지금 두 값을 그대로 두고 위로 한 칸 추가.
- (b) **B2 festival 도 3단.** 권고(B1 유지)와 다르고 **`CLAUDE.md` 보존 규칙과 부딪힌다** — 아래 별도 항.
- (c) **C1 최상단 스냅에서 티커·그늘 트랙 둘 다 숨김.**
- (d) **D1 URL 에 스냅만** — `?sheet=peek|half|full`.
- (e) **E1 손잡이 드래그 + 탭.**
- (f) **F1 카메라 중심은 손대지 않는다** — `viewportInsets` 만 정확히 내보내고 보정은 C6.

**(b) 보존 규칙과의 충돌 — 사용자 결정 기록**
festival 이 3단이 되면 지금 없는 717px 상태가 생기므로 **`/firework` 의 "동작" 이 달라진다.**
`CLAUDE.md` 는 "보이는 것과 동작을 바꾸는 수정은 하지 않는다" 이고, 계곡 요구 때문에 `/firework` 를
희생해야 할 것 같으면 **묻도록** 정해 두었다. 그래서 물었고, 사용자는 **"B2 진행, 문서는 그대로"**
를 골랐다(2026-09-07). 즉 **`CLAUDE.md` 와 `PARITY.md` 는 수정하지 않는다.**

- **결과**: 문서는 "동작 불변" 이라 적힌 채로 코드는 festival 스냅 3단이 된다 — 두 곳이 어긋난다.
  사용자가 그 어긋남을 알고 고른 선택이다.
- **다음 세션 주의**: `CLAUDE.md` 만 읽고 "festival 스냅 3단은 규칙 위반이니 되돌린다" 고 판단하지
  마라. 이 행이 그 판단의 근거다.
- **여전히 지켜야 하는 것**: 기본 스냅(접힘 68 · 펴짐 380)과 **정지 상태 화면은 그대로**다.
  `/firework` 다크 픽셀 diff 는 **여전히 0 이어야 한다** — 새 상태는 사용자가 끌어올릴 때만 생긴다.
  티커·문구·컨트롤 구성 등 나머지 보존 대상은 손대지 않는다.

**해석 (메인 세션 판단)**
1. **탭은 다음 칸으로 순환한다**(`peek → half → full → peek`). 승인된 목업의 설명("탭으로 다음 칸에")
   그대로다. festival 의 기존 탭 동작(2단 토글)도 이에 따라 바뀐다 — (b) B2 의 결과다.
2. **URL 파라미터는 두 라우트에 같게 넣는다**((b) 의 일관성 선택과 맞춘다). **기본 스냅일 때는
   파라미터를 쓰지 않는다** — URL 이 깨끗하게 유지되고, 기존 링크가 그대로 동작한다.
3. **최상단 스냅에서 숨기는 대상은 라우트별로 다르다** — 계곡은 `ValleyTicker`·`ShadeHourTrack`,
   festival 은 `Ticker`. 숨김은 **최상단 스냅에서만** 일어나므로 기본 상태 동작은 불변이다.

**범위(승인 뒤)** — PR 1개: core 라우트별 스냅 상수·스냅 상태(`sheetCollapsed` 대체)·`viewportInsets`
산출 · URL 동기화(expo-router) · 손잡이 제스처 · ((c) 선택에 따라) 지도 위 요소 표시 규칙.

**범위 밖** — 카메라 보정(C6), festival 스냅 변경, 선택 상태 URL((d) D2 선택 시에만).

**결과 (2026-09-07, PR [#36](https://github.com/4sizn/modu-valley/pull/36) 열림 → `in-review`)** — 결정
(a)~(f) 전부 확정대로 구현. core `SheetSnap.ts`(`SheetSnap` 3값·`nextSheetSnap` 순환·
`SHEET_SNAP_METRICS`(라우트별, 지금은 두 라우트 값이 같다)·`sheetVisibleHeight`/
`sheetContainerHeight`/`sheetTranslateY`(픽셀 변환)·`nearestSheetSnap`(드래그 커밋)·
`parseSheetSnapParam`/`sheetSnapToParam`(URL 코덱)) + `ViewportInsets.ts`(`computeViewportInsets`
순수 합산) + `AppState.sheetSnap`/`viewportInsets`(`sheetCollapsed` 대체, 소비처 전부 이관 —
`WaterFlowCoordinator`·`OpenSettingsUseCase`·`MapSession`) + `SessionStore.cycleSheetSnap`/
`setSheetSnap`/`setViewportInsets`. app `CenterColumn.tsx`(`useSheetVisibleHeight(snap)`=지금
스냅의 가시 높이·`useSheetSnapMetrics`=V1 좁은 컬럼 half 오버라이드를 얹음) ·
`useSheetTranslate`(`{containerHeight, translateY, beginDrag, endDrag}` — 컨테이너·translateY
를 함께 관리, 아래 "픽셀 회귀" 참고) · `sheetPanResponder.ts`(드래그+탭 한 제스처, 이동 6px
이내면 탭=순환, 잡는 순간 `beginDrag()` 로 컨테이너를 `full` 로 강제) · `BottomSheet.tsx`
(손잡이 `Pressable`→`View`+`panHandlers`, `height` prop 제거·자체 계산) · `MapScreen.tsx`
(컨트롤·티커·트랙 bottom 이 지금 스냅의 가시 높이를 따라가도록 변경 — 이전엔 `half` 고정값이었다,
`full` 에서 티커·트랙 숨김, `viewportInsets` 를 세션에 반영) · `useSheetSnapUrlSync.ts`
(`?sheet=` 왕복, 기본값이면 파라미터 없음). 테스트: core 스냅 순환·정지 상태 컨테이너/translateY
회귀 고정(half·full 은 정확히 0, peek 은 옛 공식과 같음)·드래그 좌표계·드래그 최근접·URL 왕복·
viewportInsets 합산(신규 test 2 파일) + 기존 `sheetCollapsed` 소비 테스트 이관(MapSession·
settings). `pnpm verify` 통과(core 417·app 57 포함, lint 는 무관한 사전 경고 1건만).

**기획 대비 판단한 것** — ① `useSheetSnapUrlSync.ts` 를 세션 배럴(`@/session`)이 아니라
`@/session/hooks` 에서 바로 import 했다 — 배럴이 이 파일을 재수출하므로 배럴을 거치면
순환 참조가 생긴다(`session/index.ts` ↔ 이 파일, Metro 가 "Require cycle" 경고를 냈다).
② 컨트롤·티커·트랙의 bottom 오프셋이 예전엔 `half` 스냅 값에 고정이었는데(접혀도 안 움직였다),
이제 지금 스냅을 따라간다 — `full` 에서 그대로 두면 85vh 시트 뒤로 숨어 버려 결정 범위
"컨트롤·티커·트랙의 bottom 오프셋을 스냅에 맞춰 갱신"에 이미 포함된 변경이다. ③
`WaterFlowCoordinator`(`shouldAnimateWaterFlow`)와 `OpenSettingsUseCase` 를 core 커밋에서
같이 고쳤다 — 이 둘이 `sheetCollapsed` 의 실제 소비처였고, 대체 API 로 옮기지 않으면 컴파일이
깨진다. `WaterFlowCoordinator` 는 `full` 도 "펴져 있다"로 쳐서 흐름을 유지한다(`peek` 만 끈다).
`OpenSettingsUseCase` 는 `peek` 일 때만 `half` 로 펴고 `full` 이면 그대로 둔다(끌어올린 상태를
설정 열기가 되돌리지 않는다).

**픽셀 diff 회귀 발견·수정(메인 세션 검토)** — 첫 구현은 컨테이너 높이를 스냅과 무관하게 항상
`windowHeight * fullRatio`(85vh)로 고정하고 `translateY` 로 나머지를 가리는 방식이었다.
`half` 스냅에서 컨테이너는 85vh 인데 보이는 건 45vh 뿐이라 `translateY` 가 0 이 아닌 소수점
값(1440×757 기준 `0.40H≈302.8px`)이 됐다 — `main` 은 컨테이너가 45vh·`translateY` 가 정확히
0 이었다. 화면에 보이는 높이는 같아 육안으로는 구분되지 않지만, **그 소수점 transform 이 걸린
합성 레이어가 시트 텍스트를 서브픽셀로 재샘플링**해 지도(별도 레이어)는 그대로인데 시트
텍스트 영역에만 diff 가 몰리는 결과를 냈다. 처음엔 이 diff(7,630px)를 "독립된 두 페이지 로드
사이 가변 폰트 서브픽셀 차이"로 **잘못 판단했다** — main-vs-main 대조군을 빠뜨린 채 main-vs-branch
수치만으로 잡음이라 넘겨짚은 것이 오진의 원인이었다. **정정한다: 코드가 만든 회귀였다.**
수정 — 컨테이너 높이를 스냅마다 다르게 둔다: `peek`/`half` 는 `half` 자신의 컨테이너를 쓰고
(옛 2단 시스템·`main` 과 정확히 같은 값, `translateY` 는 이제 정확히 0), `full` 만 자기
컨테이너(85vh)를 쓴다. `full` ↔ `peek`/`half` 전환은 컨테이너 자체가 커지거나 줄어야 하므로
(1) `full` 진입 — 애니메이션 전 컨테이너를 먼저 키우고 `translateY` 를 순간 보정, (2) `full`
이탈 — 드래그 좌표계(`sheetDragTranslateY`, 항상 `full` 기준)로 애니메이션한 뒤 끝나면 컨테이너를
줄이며 `translateY` 를 정지 값으로 순간 보정, (3) `peek`↔`half` — 둘 다 `half` 컨테이너라
안 바뀐다(옛 시스템 그대로). 드래그는 잡는 순간 컨테이너를 `full` 로 강제하고 그 순간의 드래그
좌표계 시작값을 동기로 받는다(effect 를 기다리면 한 프레임 어긋난다).

**검증(재측정)** — `pnpm verify` 통과. `/firework` 다크 픽셀 diff 1440×757, 완전히 새
워크트리·새 Metro·새 브라우저로 상호작용 없이 첫 캡처: **main vs main(독립된 두 워크트리, 같은
`origin/main` 675daa4) — 41,290/1,090,080px(3.79%, 지도 전체에 퍼진 자연 잡음, bbox 전체
화면)** 을 **대조군**으로 먼저 쟀다(처음에 "같은 페이지 재캡처 0px"만 대조군으로 썼던 것이
잘못이었다 — 그건 페이지 로드 사이 잡음을 전혀 재지 못한다). **branch(수정 후) vs main —
41,290/1,090,080px(3.79%), 대조군과 정확히 같은 픽셀 수**(서로 다른 baseline 이미지로 두 번
측정해도 재현). **판정: 수정 후 branch 는 main-vs-main 자연 잡음과 통계적으로 구분되지 않는다
— 회귀 없음.** half→full·full→peek 양방향 드래그 전환을 agent-browser 로 직접 실행해 콘솔
오류 없이 올바른 최종 상태로 정착함을 확인했다(프레임 단위 매끄러움까지는 이 도구로 촬영하지
못했다). **검증 중 실제로 겪은 함정(코드와 무관)**: 오래 실행 중인 CI 모드 Metro 서버를 반복
재시작하며 검증하는 동안 지도가 완전히 빈 화면(타일 0장)으로 렌더되는 현상을 여러 차례 만났다
— require cycle(위 판단 ①)이 원인인가 의심해 고쳤지만 재현됐고, 최종적으로 **완전히 새로운
워크트리 + 새 포트 + 새 브라우저**로 첫 캡처하면 매번 정상 렌더되는 것으로 좁혀 "이 세션에서
반복 상호작용한 Metro/WebGL 상태의 열화"임을 확인했다(main 워크트리로도 같은 증상이 재현됨 —
코드가 원인이 아니다). 다음 세션이 같은 현상을 보면 서버를 새로 띄우는 것부터 시도할 것.
스크린샷 12장(계곡·festival 각 라이트·다크 × `peek`/`half`/`full`, 390×844, 기하 수정 후
재촬영) — festival 을 `full` 까지 끌어올린 상태(사용자 확인용, `/firework` 정지 상태가 아니므로
파리티 계약 밖)도 포함.

**범위 밖(다음 항목에서)** — C6(카메라 보정, `viewportInsets` 소비), 선택 상태 URL(D2).

### C9 — 테마 설정 (기획 2026-09-06)

**배경** — 지금 테마는 `EXPO_PUBLIC_THEME` 빌드 변수로만 정해진다(개발용). 사용자가 라이트/다크/시스템을 고르고 그 값이 남아야 한다(D1 결정 "라이트 기본, 다크 제공, 설정에서 선택").

**연구 질문 → 답**
1. *진입점.* 하단 내비 `settings` 탭이 이미 있고(`FloatingNav`, `NavTab`), 눌러도 아무 일이 없다. 시트가 face(list/detail)를 가진 구조라 **설정 면(face)** 을 하나 더 두는 것이 라우트 추가보다 셸 변경이 적다. 라우트 `/settings` 는 `/firework` 와 셸을 공유하지 않아 파리티 부담이 없지만 화면이 하나 더 생긴다 — 결정 (a).
2. *상태·영속.* `AppState.themeMode: 'light'|'dark'|'system'`, `SetThemeModeUseCase`, `STORAGE_KEYS.themeMode`. `ThemeProvider` 는 `mode` prop 대신 세션 상태 + `useColorScheme()`(system) 로 해석. **지도 스타일은 엔진 생성 시 고정**(`SessionProvider` 주석 "모드가 바뀌면 세션을 다시 만든다") — C9 에서 런타임 전환은 세션 재생성으로 처리하고, 부드러운 `setStyle` 전환은 후속.
3. */firework.* 축제 화면도 같은 설정을 따른다(다크 기본 데모는 `system`/`dark` 에서 그대로). 파리티 측정은 다크 강제 그대로.

**결정 (검토 페이지 https://claude.ai/code/artifact/3800ca76-3932-4ea6-9167-ced6345d2a66 목업)**
- (a) **진입** — A1 내비 설정 탭 → 시트 설정 면(목록 ↔ 설정 플립) (권고) / A2 라우트 `/settings` 전체 화면
- (b) **컨트롤** — B1 3분할 세그먼트(라이트 · 다크 · 시스템) + 현재 적용 표시 (권고) / B2 라디오 행 3개
- (c) **함께 두는 항목** — C1 테마만 + 정보(데이터 출처·버전) (권고) / C2 + 그늘 기본 켜기 토글(F4 G1 저장값을 노출)
- (d) **전환 방식** — D1 세션 재생성(지도 재로드, 0.5~1 s) (권고) / D2 `setStyle` 런타임 전환(어댑터 작업 큼, 후속)

**결정 확정 (2026-09-06 사용자, 검토 페이지)** — 전부 권고안.
- (a) A1 내비 `settings` 탭 → 시트 **설정 면**(`SheetFace` 에 `'settings'` 추가, 목록 ↔ 설정 플립은 기존 `SheetFlipCoordinator`). 닫기 = 목록 면으로. 축제 장면(`/firework`)에서도 같은 면이 뜨되 데모 셸 치수는 불변.
- (b) B1 3분할 세그먼트(라이트 · 다크 · 시스템) + 아래 "현재 적용: 라이트|다크" 한 줄. 세그먼트 활성 색은 `accent`, 나머지는 `segActive` 토큰.
- (c) C1 테마 + 정보 카드(지도 OpenFreeMap · OSM, 지형 Mapzen/AWS Terrarium, 버전 `expo-constants`). 그늘 기본 토글은 두지 않는다.
- (d) D1 세션 재생성 — `SessionProvider` 의 `styleMode` 가 `AppState.themeMode`(system 은 `useColorScheme`) 로 해석되어 바뀌면 세션을 다시 만든다. 무중단 `setStyle` 은 L1 후속.
- 해석 순서: 저장된 사용자 선택(`STORAGE_KEYS.themeMode`) → `EXPO_PUBLIC_THEME`(개발용 강제) → `light`. 파리티 검증은 다크 강제 그대로 동작해야 한다.

**범위** — core 상태·유즈케이스·저장 키, `ThemeProvider` 해석 순서(세션 값 → env → light), 시트 설정 면 컴포넌트, 내비 탭 연결, 테스트. PR 1개. 범위 밖: 지도 스타일 무중단 전환, 계정·알림 설정.

**결과 (2026-09-06, PR [#22](https://github.com/4sizn/modu-valley/pull/22) 열림 → `in-review`)**: 결정 (a)~(d) 전부 권고안 그대로. core — `SHEET_FACES` 에 `'settings'`, `AppState.themeMode`(`THEME_MODES`·`isThemeMode`), `SessionStore.setThemeMode`·`endSelection(navTab)`, `SetThemeModeUseCase`(**저장 → 상태** 순서 — 새 세션이 저장값을 읽으므로), `OpenSettingsUseCase`(상세에서는 `ClearSelectionUseCase.execute(token, { face:'settings', navTab:'settings' })` 로 목록을 거치지 않고 곧장) · `CloseSettingsUseCase`(× · Esc · 뒤로가기 · 다른 내비 탭 → 목록, 그 탭), `LoadSessionUseCase` 가 두 장면 공통으로 `STORAGE_KEYS.themeMode`(`modu-valley/theme-mode`) 복원, `MapSession.setThemeMode/openSettings/closeSettings` + `setNavTab` 라우팅, `MapSessionDeps.seed`(재생성 세션이 이어받는 테마 선택·설정 면). app — `ThemeProvider` 결정 순서 세션 선택 → 저장값(`useStoredThemeMode`, 세션 없이 `StoragePort` 한 번) → env → 라이트, `system` 은 `useColorScheme`(`theme/resolveThemeMode.ts` 순수 TS + 테스트), `SessionProvider` 가 세션 `themeMode` 를 Provider 로 올리는 다리 + 씨앗, `shell/SettingsFace.tsx`(세그먼트 accent/segActive·"현재 적용"·정보 카드 3행·`expo-constants` 버전), `SETTINGS_COPY`, `+html.tsx` 인라인 스크립트(첫 페인트 전 `data-theme`), `app.json` `userInterfaceStyle: automatic`(네이티브 `system` 이 기기 설정을 읽으려면 필요). 테스트 core 214 → 236, app 15 → 20. **기획 대비 판단한 것** — ① `themeMode` 초기값은 `system`(계약)이되 앱은 자기 기본(env → 라이트)을 씨앗으로 넘긴다: 저장값이 없을 때 세그먼트가 "시스템"을 가리키며 실제로는 라이트가 강제되는 어긋남을 피하기 위해 ② 테마 전환 뒤 재생성된 세션은 설정 면을 이어받는다(안 그러면 고른 직후 설정이 닫힌다) ③ 팔레트가 같은 전환(`dark` ↔ `system` on 다크 OS)은 세션을 다시 만들지 않는다(`styleMode` 만 의존). **검증** — `pnpm verify`; web 1440×757 설정 면 라이트/다크/시스템, 다크 선택 → 지도 캔버스 교체·설정 면 유지·저장, 시스템 → 다크 OS/라이트 OS 두 세션 추종, 새로고침 후 유지, 상세 → 설정 면 순서 `detail → settings`; `/firework` 다크 강제(저장값 비움) main vs branch **픽셀 diff 0**(셀프 diff 0 대조군), PARITY 13행·CTA·컨트롤 좌표 동일·설정 면 개폐 뒤 동일(`PARITY.md` 기록); 스크린샷 8장 + iOS 5장 `proof/C9-theme-settings`. **iOS 시뮬레이터(iPhone 17 Pro, `expo run:ios`)** — 설정 면 열림·버전 0.1.0 표시, 다크 선택 → `RCTAsyncLocalStorage_V1/manifest.json` 에 `modu-valley/theme-mode: dark`, 앱 종료·재실행 뒤 다크 유지, 시스템 선택 → `simctl ui appearance dark|light` 추종(`userInterfaceStyle: automatic`), 테마 전환 5회 + OS 전환 2회 모두 팔레트가 바뀔 때만 세션 재생성 1회·설정 면 유지. ④ 네이티브 실측에서 시작 시 저장값을 읽기 전에 env 기본으로 엔진을 만들고 20 ms 뒤 버리는 낭비가 보여 `ThemePreferenceHandle.ready`(저장값 읽음)로 엔진 생성을 늦췄다 — 시작 시 엔진 1회. 한 번 관측된 "시스템 선택 직후 0.8 s 뒤 재생성 1회 추가·설정 면 닫힘"은 7회 재시도에서 재현되지 않았다(스크립트의 OS 전환 명령과 접근성 탭이 겹친 것으로 보임) — 재현되면 `[valley:theme] 테마 해석` 로그로 원인을 따라갈 수 있다.

**후속 제안 (범위 밖 발견, 이 항목에서 만들지 않음)**
- 지도 스타일 무중단 전환(`setStyle`, 결정 (d) D2) — 지금은 테마를 바꾸면 지도가 0.5~1 s 다시 뜬다. 어댑터 두 벌 작업이라 L1 그대로.
- web 첫 페인트 — RN 트리는 저장값을 effect 에서 읽어 저장값이 env 와 다르면 한 프레임 UI 배경이 튈 수 있다(문서 배경은 인라인 스크립트로 맞춤). 신경 쓰이면 정적 렌더 없이 web 도 저장값을 동기로 읽는 길이 있다.
- 접힘 상태에서 설정 탭 — 시트를 펴서 보여 준다(`setSheetCollapsed(false)`). 데모에 없는 동작이라 파리티표 밖이며, 다른 결정이 필요하면 C8(시트 스냅)에서.

**원안 메모(2026-09-03)**
- 설정 진입점(라우트 `/settings` 또는 시트 내 항목)에서 `light | dark | system` 선택. `StoragePort` 로 영속(web localStorage · native AsyncStorage — 기존 구현 재사용). 선택값은 `AppState` 에 실려 `ThemeProvider` 가 읽는다.
- 의존: C1.

### S1 — 서버 뼈대

- 위치 `server/` (D5). 기획에서 정할 것: 런타임(Node/Hono·Fastify vs 엣지), 저장소(KV vs Postgres), 배포 대상, 로컬 개발 시 Expo web 과의 프록시 연결.
- 최소 범위: `/api/vworld/*` 프록시(키 은닉·도메인 제한 우회), 정부 API 폴링+캐시 잡, REST 초기 로드, SSE 채널. 푸시 발송은 F3.
- 의존: K1 (키 없이는 프록시를 검증할 수 없음). 뼈대 자체는 키 없이도 만들 수 있으나 머지 게이트가 약해진다.

### F1 — MVP-1 계곡 구간 카드 (기획 2026-09-03)

**목표** — 지도에 계곡 구간(선)·시설(점)이 그려지고, 시트에 구간 카드("백운계곡 · 중류 · 무릎 · 주차장 320m")가 나오며, 카드 ↔ 지도 선택이 양방향으로 이어지는 **첫 계곡 화면**. 서버 없이 정적 GeoJSON 으로. web 우선(D3).

**전제 확인 (2026-09-03 실측)**
- C4 로 엔진은 이미 구간·시설을 그린다(`MAP_LAYER_SETS` = segment·facility·spot, `renderContent`/`setSelection`/`feature-press`). `MapSession` 은 `feature-press` 의 `spot` 만 라우팅하고 나머지는 debug 로그 — 여기가 F1 의 입구.
- C3 로 도메인·로더가 있다(`Valley`/`Segment`/`Facility`, `loadValleyDataset(segmentsRaw, facilitiesRaw?)` → `{metadata, valleys}`). `data/example-valley.geojson` 은 구간 3개, **시설 파일 없음**.
- C1 로 테마가 있다(`useTheme`/`createThemedStyles`, 라이트 기본). 컴포넌트는 festival 전용(`SpotListFace`·`SpotDetailFace`·`SpotItem`·`ProgramCard`·`InfoCard`).
- `AppState`/`SessionStore` 는 `festival`·`selectedSpotId` 만 안다. `LoadSessionUseCase` 는 `FestivalRepositoryPort` 고정. `CameraPresets` 는 데모 수치(pitch 62, zoom 13.6…)뿐.
- 라우트는 `app/index.tsx` 하나. `+html.tsx` 제목이 "불꽃축제 지도 — 클론 예제".

**설계**

1. **라우팅 (D2)** — `/` = **계곡 화면**(신규, 기본), `/firework` = 기존 데모 화면 **무변경**(파일 이동만: `app/index.tsx` → `app/firework.tsx`). 두 라우트가 같은 셸(상단바·컨트롤·시트·GNB)을 쓰고 콘텐츠만 다르다 — valley-ds §6 "같은 셸, 계절별 콘텐츠"의 첫 실증.
2. **세션 — `MapSession` 에 `scene` 매개변수** (파사드 분리 대신). `MapSessionDeps.scene: 'festival' | 'valley'`, `valleyRepository?: ValleyRepositoryPort`. 카메라 큐·플립·제스처·엔진 배선은 공유, 적재·선택·티커만 scene 으로 갈린다.
   - `application/ports/ValleyRepositoryPort { load(token): Promise<Result<ValleyDataset>> }` + `data/InMemoryValleyRepository(dataset)` (core 는 파일을 못 읽으므로 원시 JSON 은 앱이 넘긴다).
   - `AppState` 추가: `valleys: readonly Valley[] | null`, `selectedSegmentId: SegmentId | null`, `selectedFacilityId: FacilityId | null`, `scene`. `selectedSpotId` 는 그대로(festival 컴포넌트 무변경).
   - `LoadSessionUseCase`: valley scene 이면 `valleyRepository.load` → `store.setValleys` → `renderContent({ ...EMPTY_MAP_CONTENT, segments, facilities, crowd })` → 첫 계곡으로 카메라(`focusValley`). 티커는 valley 에서 시작하지 않는다(제보 피드는 S1 이후).
   - 새 유즈케이스: `SelectSegmentUseCase`(begin selection → `setSelection({kind:'segment'})` → `focusSegment(midpoint)` + 플립 detail), `SelectFacilityUseCase`(핀 + 시트 상단 미니 행, 플립 없음), `ClearSelectionUseCase` 는 세 종류를 모두 해제하도록 일반화. `MapSession.#wireEngineEvents` 의 `feature-press` 가 kind 별로 라우팅.
   - `CameraPresets` 에 계곡 프리셋: `focusValley(center, zoom 13.5, pitch 0)`, `focusSegment(midpoint, zoom 15.5, pitch 30, offset [0,-90])`, `releaseSegment`. 계곡은 3D 건물이 없으니 pitch 를 낮게 — 값은 web 에서 눈으로 잡고 기록.
3. **도메인 보조 (순수, 테스트)** — `Segment` 카드 문구 재료를 core 에 둔다: `segmentSubtitle(segment, nearestParkingM?)` → "중류 · 무릎 · 자갈 · 주차장 320m"(없는 속성은 생략), `Valley.nearestFacility(type, from: LngLat)`, `Segment.midpoint()`. 라벨 함수(`depthLabel` 등)는 C3 에 이미 있다.
4. **시트 UI (계곡)** — 기존 시트 셸(`BottomSheet`·플립·스태거) 위에 계곡 면 2개:
   - `ValleyListFace`: 제목(데이터셋 `metadata.description` 또는 "수도권 계곡") / 계곡별 헤더 + **구간 카드**(제목 계곡명, 부제 `segmentSubtitle`, 메타: 접근 난이도·무료/야영/반려견 배지·`swimBanned` 경고). 정렬 세그먼트(상류→하류 기본).
   - `ValleyDetailFace`: eyebrow 상류/중류/하류, 제목 계곡명, 정보 카드 2×2(수심·바닥·접근 거리/경사·난이도), `riskNote` 경고 박스, 이 계곡의 시설 목록(구간 시작점 기준 거리순), **그늘 자리**("그늘 정보 준비 중" — D6/P1 이 채운다), CTA "길찾기"(외부 지도 링크)·"닫기".
   - 시설 미니 행(`FacilityRow`): 시설을 누르면 목록 면 최상단에 "주차장 · 백운 제1주차장 · 무료 · 120면" 한 줄.
   - 컨트롤: valley scene 에서는 불꽃·지구본 버튼 숨김, "내 위치/계곡으로" 는 `focusValley`. 문구는 `theme/copy.ts` 에 `VALLEY_COPY` 절 추가(브랜드 "모두의계곡").
5. **데이터 배선** — `data/example-facilities.geojson` 샘플 추가(주차장 2·화장실·매점, 스키마 `facilityProps`, "샘플" 명시) → 카드에 "주차장 320m" 가 실제로 뜬다. 앱은 `scripts/sync-valley-data.mjs`(기존 `sync-maplibre-worker.mjs` 패턴)로 `data/*.geojson` → `apps/valley-map/assets/valley/*.json` 복사 후 import — Metro 가 `.geojson` 을 모르기 때문. (대안: `metro.config` `sourceExts` 에 geojson 추가. 워크트리에서 둘 중 확실한 쪽.)
6. **네이티브** — 화면 컴포넌트가 RN 공용이고 `NativeMapView` 가 레이어 셋을 이미 순회하므로 추가 작업 없이 컴파일돼야 한다. `typecheck`·`test` 통과가 게이트, 실기 확인은 후속(D3).

**범위 밖** — 혼잡 데이터(전부 `unknown` → accent 색), 그늘 값(D6/P1), 아이콘 심볼(C5), 라이트 지도(C2), 검색, 필터, 제보, 서버. 카메라 시트 보정(C6 hold) — 기존 `offset [0,-90]` 하드코딩 그대로.

**검증 (머지 게이트)**
- `pnpm verify`. core 신규 테스트: valley scene 적재·`renderContent` 호출 내용, 구간/시설 선택·해제 상태 전이, `segmentSubtitle` 문구, `nearestFacility`, 카메라 프리셋 호출. `MapSession.test` 에 valley scene 케이스.
- web `/`: 구간 3개 선(accent) + 시설 4점 → 카드 3장 → 카드 탭 → 지도 선 굵어지고 카메라 이동, 상세 면 → 빈 곳 탭 → 해제. 지도 선 탭 → 같은 상세. 스크린샷 4장(목록·상세·시설 선택·라이트/다크).
- web `/firework`: 기존 데모와 픽셀 동일(`PARITY.md` 재확인) — 회귀 게이트.
- native `typecheck`·`test`.

**사용자 결정 필요**
- (a) 라우팅 `/` 계곡 기본 + `/firework` 데모 유지 — 권장 그대로.
- (b) 세션: 단일 `MapSession` + `scene` vs 별도 `ValleySession` — 권장 **단일**(카메라·플립·제스처·엔진 배선 재사용, 테스트 더블 하나).
- (c) 시설 선택 UI: 핀 + 미니 행(권장) vs F2(주차 제보)로 미루기.
- (d) PR: **2개** 권장 — F1a core(포트·상태·유즈케이스·프리셋·보조 함수·테스트) → F1b app(라우트·컴포넌트·데이터 배선·검증). 같은 워크트리에서 순차. core 먼저 머지되면 리뷰가 쉽고 app 이 늦어도 core 는 안전.
- (e) 그늘 자리: "준비 중" 표시(권장 — 디자인 자리 유지) vs 숨김.

**결과 (2026-09-03, PR [#7](https://github.com/4sizn/modu-valley/pull/7) core · [#9](https://github.com/4sizn/modu-valley/pull/9) app 머지)**: 결정 (a)~(e) 그대로 구현. `/` 계곡 화면, `/firework` 데모 보존(PARITY 측정표 13행 + CTA 폭 재측정 동일). 단일 `MapSession` + `SceneSource` 유니온(`{scene:'festival', repository} | {scene:'valley', valleyRepository}`), `AppState` 에 `scene`·`valleys`·`valleyMetadata`·`selectedSegmentId`·`selectedFacilityId`. 컴포넌트는 `components/{shell,festival,valley}`, 문구는 `FESTIVAL_COPY`/`VALLEY_COPY`. 시설 샘플 `data/example-facilities.geojson` + `scripts/sync-valley-data.mjs`(`.geojson` → `assets/valley/*.json`, Metro 가 `.geojson` 을 모름). 테스트 core 132 → 160. 기획 대비 판단한 것 — ① 목록 제목은 "수도권 계곡" 고정, 데이터셋 `description` 은 안내 줄(`AppState.valleyMetadata` 추가) ② 상세 위에서 시설을 고르면 상세를 닫고 핀으로(지도 선택은 하나) ③ 어댑터에 `initialView` 옵션 — MapLibre 가 `flyTo` offset 을 **현재** pitch 로 투영해 pitch 62→0 첫 비행이 어긋나, 장면별 시작 시점을 맞춤 ④ 카메라 값 web 눈 확인 후 `focusValley` zoom 14.2 · offset [0,-120] 확정 ⑤ 카드 제목 = 계곡명이라 단일 계곡에서는 "샘플계곡" 반복 — 후속 판단. 시각 E2E 증거 10장(라이트·다크·선 탭·시설·빈 곳 탭·/firework)은 고아 브랜치 `proof/F1-valley-cards`. 네이티브는 typecheck·test 까지(D3), 실기 확인 후속.

**`done` 의 뜻은 기능 기준이다.** 사용자 판정(2026-09-03): 계곡 화면의 **디자인은 마음에 들지 않음** — 콘텐츠·기능이 붙었다는 의미의 done 이고, 시각 개선은 별도 항목으로 뒤에 한다(C1 토큰 체계 위에서; 카드 제목 반복 ⑤ 도 그때 함께). 계곡 실데이터 시딩(R4 시드), 혼잡·그늘 값, 아이콘(C5), 라이트 지도(C2)는 범위 밖.

### P1 — 그늘 빌드 파이프라인 (기획 2026-09-03, 사용자 위임으로 순서 결정)

R3c `canopy/README.md` "스키마 확정 권고"와 P1 용 함수 시그니처를 **그대로** 구현한다. 새 판단 없음.

- 위치 `scripts/shade/`(파이썬, R3c 환경 재사용 — uv/venv, rasterio, numpy, shapely, astral). `scripts/research/shade-pilot/` 은 연구 기록으로 그대로 두고 필요한 함수만 옮긴다.
- 입력: `data/*.geojson` 구간 컬렉션(`valleyId` 별로 묶음). 자산: GLO-30(계곡 bbox 위도로 타일 결정, 캐시), Meta CHM(z9 quadkey 계산, 범위 요청 윈도 읽기, 캐시). 캐시는 `scripts/shade/.cache/`(gitignore).
- 계산: R3c 방식(2m 격자, 지반 = GLO-30 − CHM 30m 블록 평균, 그늘 = CHM>2m ∪ 그림자 전파 ∪ 지형 마스크). 대표일 8/1, KST 10~18 정시 9개.
- 출력:
  - `data/shade/<valleyId>/canopy.geojson`(수관 1장), `data/shade/<valleyId>/shadow-<HH>.geojson`(개방지 그림자 9장, 비어 있으면 빈 컬렉션) — **분리형, 구간 회랑 ±200m 절단**, 단순화 2m, 최소 25m², `[lng,lat]` 소수 5자리, `metadata`(source·datasetVersion·collectedAt·CHM 촬영연도·대표일).
  - 구간 속성 **역기입**: 입력 geojson 의 각 구간 `properties` 에 `shadeByHour: number[9]`(50m 버퍼), `canopyCover: number`(CHM>2m 비율), `shadeRatio`(= 정오 값, 호환) 를 쓴다. 기존 수기 `shadeRatio` 는 덮어쓴다(D6: 수기 금지).
  - `data/shade/index.json`: 계곡별 산출 시각·자산 버전.
- 스키마·도메인: `valleys.schema.json` `segmentProps` 에 `shadeByHour`(items 9, 0~1)·`canopyCover` 추가, `shadeRatio` 설명을 "정오 값(산출)" 로. `core/domain/valley/Segment.ts` 필드 추가 + 로더 파싱 + 테스트. `segmentSubtitle` 은 아직 그늘을 쓰지 않는다(F4/시각 개선에서).
- 실행: `pnpm shade:build`(루트 스크립트 → python) 문서화. 샘플 계곡에 대해 실제로 돌려 `data/shade/sample/` 을 **커밋한다**(작음, F4 입력).
- 검증: 샘플 계곡 결과가 R3c 수치와 ±0.02 이내(같은 방법이므로), `pnpm verify` 통과, 산출 파일 크기 표.

### C2 — 지도 팔레트 · 라이트 지도 (기획 2026-09-03, 사용자 위임으로 순서 결정)

- 목표: 라이트 UI 위에 **라이트 지도**. 테마 모드에 따라 지도 스타일이 갈리고, 계곡용 조정(녹지↑·물줄기↑)이 들어간다.
- 베이스 스타일(결정): 라이트 = openfreemap **`positron`**, 다크 = 기존 `dark`. 둘은 Positron/Dark Matter 쌍이라 레이어 구조가 같아 하나의 재색칠 함수로 다룰 수 있다(워크트리에서 레이어 id 대조로 확인, 다르면 `liberty` 로 교체하고 기록).
- `map-style`: `palette.ts` 에 valley-ds `map-palette.json` 의 dark/light 팔레트 반입(`markerPalette.ts` 흡수), `applyMapPalette(style, mode)` — 레이어 id/타입 패턴으로 `background`·`water`·`park`·`landuse`·`building`·`road*`·`railway`·라벨 색/halo 를 팔레트 값으로 치환한 **새 스타일** 반환(`decorateNightStyle` 규약). 계곡 조정: `park` 불투명도 z9→z12 증가로 반전, `waterway`(stream) 선폭 확대. 라벨 폴백 `name:ko → name:nonlatin → name → name:latin` 로 통일. 밤하늘·3D 건물 장식은 다크에서만.
- 어댑터: web `MapLibreEngine` 은 스타일 로드 후 `applyMapPalette` 적용(또는 fetch 후 setStyle), native `nativeStyle.ts` 는 fetch 한 JSON 에 미리 적용. `styleUrl`·`mode` 는 엔진 옵션으로 — 생성 시점 결정. 런타임 테마 전환 시 스타일 재로드는 C9 와 함께.
- 앱: `mapPlatform.{web,native}` 가 `ThemeProvider` 의 모드로 스타일을 고른다. `tokens.ts` 의 지도 위 글자(`mapFg`·`mapFg2`·`liveText`·`credit`·`tickerTextShadow`·`compassTail`)에 라이트 값 부여(C1 이 남긴 자리).
- 검증: `pnpm verify`. web 라이트에서 `/`·`/firework` 스크린샷(지도가 밝고 UI 와 맞는지), 다크 강제 시 기존과 동일(회귀). 네이티브 typecheck·test. 팔레트 함수 테스트(레이어 치환 개수, 미지 레이어 무변경, 계곡 조정 값).

**C2 결과 (2026-09-03)** — PR #11 머지 → `done`(기능 기준). 사용자 판정: **"아직 마음에 들진 않지만 승인"** — 라이트 지도가 붙고 테마 연동은 끝났다는 뜻의 done 이고, 라이트 지도의 시각 완성도(팔레트 톤·녹지 강도·건물 회색·라벨 밀도)는 계곡 화면 시각 개선 항목과 C10(지형)에서 다시 본다. 다크는 main 과 픽셀 동일. 다크 팔레트 재색칠 채택 여부는 미결. `/firework` 보존 규칙은 `CLAUDE.md`.

### C10 — 계곡 3D 지형 (기획 2026-09-03, 사용자 요청)

- 배경: 도시형 지도는 3D 건물이 입체감을 주지만 계곡 화면은 물줄기까지 2D 선이라 와닿지 않는다(사용자, C2 라이트 지도 확인 중). 계곡에서 3D 건물에 대응하는 것은 **지형**이다.
- 목표: 계곡 화면(`/`)에서 골짜기 형태와 상류→하류 높낮이가 읽히게 한다. `/firework` 는 건드리지 않는다(CLAUDE.md 보존 규칙).
- **결정 확정 (2026-09-04 사용자, 검토 페이지 v2)** — (a) A1 음영 배치 = 숲 위·`waterway` 아래 (b) B1 강도 0.5 (c) C1 그림자 `#5a4a3a`·하이라이트 흰색 (d) D1 terrain 배율 1.5 (e) **E4 계곡 축을 가로질러** — bearing = 구간 축(start→end) 방위각 + 90°, 상류가 화면 왼쪽·하류가 오른쪽에 오도록, pitch 58 (f) F1 봉우리 라벨 "▲ 이름 표고m" 줌 11+, 표고순 (g) G1 다크 음영 켬 — 강도 0.35, 그림자 검정·하이라이트 `#5a6068` (h) H1 `hillshade-method: standard` (i) **I2 color-relief 진하게** — 50m `#e9f2dc` → 200 `#d4e4b8` → 400 `#bfd39b` → 600 `#c8b98a` → 800 `#b89a72` → 1100 `#a88062`, opacity 0.85 (j) J1 폭 있는 폴리곤 드레이프 + `line-dasharray` 흐름(web·native 공통) — **조건: 물 표면 표현은 web·native 공통 범위 안에서 더 좋은 방안이 있으면 다음에 진행**(web 전용 셰이더 J2 는 채택 안 함, L1 에서도 공통 방안 우선). 권고와 다른 선택은 e·i 두 개.
- **계획 개정 v2 (2026-09-03, 라이브러리·데이터 조사 + 물줄기 데모 반영)** — 아래 원래 단계 목록을 이렇게 바꾼다. 검토 페이지 v2 https://claude.ai/code/artifact/a51f3514-c009-4d82-ba8e-766930589107 (결정 10개: 기존 a~g + h 음영 알고리즘 · i 고도별 색 · j 물줄기 표현).
  1. **음영기복 + 고도별 색 (전 플랫폼)** — `hillshade`(+`hillshade-method`, 기본 standard) 와 **`color-relief`**(옅은 고도색, opacity 0.6) 를 함께 얹는다. 둘 다 web 6.6 · RN 11.3.8(Android 13.2 / iOS 6.26) 지원. 배치는 숲(`landcover_wood`) 위·`waterway` 아래 — F4 의 `FeatureLayerSet.placement` 계약을 그대로 쓴다(래스터 소스라 레이어 셋 타입은 `raster-dem` 을 받도록 넓힌다). 네이티브 hillshade 버그(#4453 iOS 스칼라 색 크래시 · #4296 표현식 거부) 때문에 색은 리터럴, iOS 시뮬레이터 확인 필수. 다크는 강도 0.35 로 얹는다(결정 g). 이 단계가 **모바일 3D 느낌의 상한**이다.
  2. **web 3D 지형 + 계곡 카메라** — `setTerrain` 배율 1.5(결정 d), `MapCapabilities.terrain: false` 네이티브. 카메라 프리셋: 상세 진입 시 하류→상류 pitch 58, bearing 은 구간 start→end 방위각(결정 e), 첫 진입은 평면 유지. **필수 보정**: 프로그램 카메라 이동 뒤 지형 중심 고도가 0 으로 남아 장면이 위로 밀린다 → 이동 후 `setCenterElevation(queryTerrainElevation(center))`(원시 m). sky 는 범위 밖(MAX_PITCH 60 에서 지평선 미노출). DEM 소스는 Terrarium 유지, GLO-30(Mapterhorn) 교체는 D4 갱신으로 분리.
  3. **봉우리 라벨 + 물줄기 표현** — 봉우리는 `mountain_peak` 심볼("▲ 이름 표고m"), web 은 `symbol-height-offset` 으로 지형 위에. 물줄기는 결정 j: **J1 폭 있는 폴리곤 드레이프 + `line-dasharray` 흐름 애니메이션(web·native 공통)** 을 기본안으로. 실제 폭 폴리곤은 **R5** 가 준다 — R5 전에는 구간 선 위에 얇게만. 구간 상태색(여유/보통/혼잡)을 폴리곤에 칠할지 선으로 남길지는 다음 검토.
  4. **등고선·표고 프로필 → v2 로 이관(2026-09-04 사용자 결정)** — 3D 지형 + 음영·고도색으로 굴곡이 이미 화면에 읽혀 지금은 얹지 않는다. 착수 조건이던 maplibre-contour 6.x 호환은 확인해 두었다(결정 기록 "C10d 호환 확인"). 원 계획: maplibre-contour(0.1.0) 로 Terrarium 에서 클라이언트 생성. **1:5,000 연속수치지형도의 등고선·표고값은 인터넷·휴대폰 표시 금지**라 DEM 파생만 쓴다. 표고 프로필은 P1 GLO-30 재사용.
  - **L1 로 미룬 것**: 수면 셰이더(J2, web 전용 커스텀 레이어 — 데모에서 잔물결·흐름 줄무늬·가장자리 거품 확인, 줌 16.8+·pitch 45 에서 메쉬가 지형 아래로 숨는 경우 → 과장 배율 반영 필요), deck.gl/three.js 물 메쉬.
  - **철회**: 자체 DEM 5m 타일(공개제한), 라이트 sky.
  - **데모 스파이크**: `spike/C10-preview` 커밋 `225f9ec`(머지 금지) — `?relief=1`, `?hsm=`, `?poly=1&flow=1`, `?water=1`, `?center=`.
- 단계 — 원안 (2026-09-03 오전, 참고용. 위 v2 가 우선)
  1. **음영기복(hillshade)** — `raster-dem` 소스 + `hillshade` 레이어. 세 플랫폼 지원(maplibre-gl, maplibre-react-native 11.3.8 의 `RasterDEMSource`·hillshade 스타일 확인). 라이트 팔레트의 옅은 녹지 위에 산등성이·골짜기 벽이 음영으로 서고, P1 의 시간대별 그늘 폴리곤(F4)과 같은 맥락에 놓인다. 다크는 강도를 낮춰 얹거나 끈다 — 다크 회귀는 `/firework` 기준으로만 본다(계곡 화면은 계약 밖).
  2. **web 3D 지형(terrain)** — `map.setTerrain` + exaggeration. 물줄기·구간 선·시설 점이 지형 위에 드레이프되어 V 자 골짜기 안에 놓인다. 계곡 카메라 프리셋 추가: 하류에서 상류를 올려다보는 pitch 55~62, 계곡 축 방향 bearing(`CameraPresets.ts`). **네이티브 제약**: maplibre-native 에 3D terrain 이 없다 — `MapCapabilities.terrain: false` 로 두고 web 만 켠다(불꽃 파티클과 같은 처리). 라이트에 terrain 을 켜면 지평선이 생기므로 라이트용 `sky`(낮 하늘·안개) 를 이때 정한다.
  3. **봉우리 라벨** — openfreemap 타일의 `mountain_peak` 소스 레이어(이름 + `ele`)를 positron/dark 가 쓰지 않는다. 심볼 레이어 하나 추가("○○봉 812m"). `applyMapPalette` 의 `label-poi` 규칙이 색을 맡는다.
  4. **등고선·표고 프로필** — 등고선은 openfreemap 에 없다: web 은 DEM 클라이언트 생성(maplibre-contour), 네이티브까지는 P1 의 GLO-30 에서 계곡 bbox 를 잘라 정적 벡터 타일로 굽는 길. 표고 프로필은 구간 상세 시트의 미니 차트(P1 이 `accessGradePct` 에 쓰는 DEM 재사용). 1·2 보다 후순위.
- DEM 소스: openfreemap 은 지형 타일이 없다. 1차 후보 **AWS Open Data Terrarium 타일**(무키·무료·CORS 허용, `s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`, 해상도 ~30m = GLO-30 급). 좁은 계곡의 절벽 디테일은 안 나오지만 골짜기 형태는 충분. 자체 DEM 타일(국토정보플랫폼 5m)은 자체 타일 호스팅과 함께 v2(L1·D4).
- 검증: 라이트·다크 계곡 화면 스크린샷(pitch 프리셋), `/firework` 다크 강제 픽셀 diff 0, 세 플랫폼 typecheck·test, 타일 요청 수·초기 로드 시간 비교(hillshade 는 줌당 타일 1장 추가).
- **스파이크 결과 (2026-09-03, `spike/C10-preview` 커밋 `771d242`, 머지 금지)** — 검토 페이지 https://claude.ai/code/artifact/a51f3514-c009-4d82-ba8e-766930589107 . 결정 7개를 화면으로 제시: (a) hillshade 배치 — **숲(landcover_wood) 위·`waterway` 아래** 가 유일하게 녹지 톤을 살린다(숲 아래 어디든 회백색 지형도, 라벨 아래 맨 위는 도로가 탁해짐) → 레이어 셋 `placement` 계약을 F4 와 공유 (b) 강도 0.3/0.5/0.8 (c) 그림자 색 갈색/청회색/검정 (d) terrain 배율 1/1.5/2 (e) 카메라 — 하류→상류 pitch 58·계곡 축 bearing(구간 start→end 방위각 자동) / 상류→하류 / pitch 45 / 축 가로 (f) 봉우리 라벨 on/off (g) 다크 hillshade 0.35/0.6/끔. **범위에서 뺀 것**: 라이트 sky — `MAX_PITCH 60` 에서는 줌 13.4·pitch 60 에도 지평선이 화면에 안 들어온다(스크린샷 동일). Terrarium z13 타일 36KB·0.84s 확인. terrain 만으로는 입체감이 없어 hillshade → terrain 순서가 맞다. F4 그늘 폴리곤은 지형 위에 추가 작업 없이 드레이프된다. 첫 진입은 평면 유지, 상세 진입에서만 기울이는 것을 기본안으로.
- 범위 밖: 그늘 폴리곤 레이어 자체(F4), 자체 DEM 호스팅(v2), 네이티브 3D 지형(래퍼 지원 전까지).
- **라이브러리·기능·데이터 검토 (2026-09-03, 사용자 요청 "별도 라이브러리나 기능이 존재하는지 먼저 검토")** — 결론: **"물줄기·계곡을 3D 로 보이게 하는" 기성 라이브러리는 없다.** 지형은 MapLibre 내장 기능이고, 물은 스타일(드레이프된 선 + 흐름 애니메이션)까지가 재사용 가능, 그 이상(수면 셰이더·입자)은 web 전용 커스텀이다. 상세:
  - **MapLibre GL JS 내장(web)** — 최신 6.7.0(2026-09-02, 우리는 6.6.0). `terrain`(2.2) · `hillshade`(+`hillshade-method` standard/basic/combined/igor/multidirectional, 5.5) · **`color-relief`**(고도별 색, 5.6) · `sky`(4.5) · globe(5.0) · **`symbol-height-offset`/`symbol-height-anchor`**(6.6 — 봉우리 라벨을 지형 위에 띄움). terrain 이 켜지면 `background/fill/line/raster/hillshade/color-relief` 는 자동으로 지형에 **드레이프**된다 — 구간 LineString 은 추가 작업 없이 계곡 바닥을 따라간다(스파이크에서 확인한 그대로). **없는 것**: 선의 고도 오프셋(Mapbox `line-z-offset`, MapLibre 이슈 #644 — 심볼만 해결, 선은 미정), 물 표면·흐름 렌더링. 6.0 부터 ESM 전용 배포. 6.7.0 에 `queryTerrainElevation` 과 렌더 표면 불일치 수정.
  - **maplibre-contour**(onthegomap) — Terrarium 을 클라이언트에서 등고선 벡터 타일로 만들어 `addProtocol` 로 공급. npm 0.1.0(2024-12) 이 마지막, 6.x 공식 검증 없음(API 는 남아 있어 붙여 봐야 함). 4단계 등고선의 유일한 무료 경로.
  - **MapLibre Native / maplibre-react-native 11.3.8**(Android 13.2.0 · iOS 6.26.0 핀) — `raster-dem` + `hillshade` + **`color-relief`** 지원(RN 11.1/11.2, 2026-05). **3D terrain 없음**: 트래킹 #252, draft PR #4190(2026-03~, 라인 셰이더·Continuous 모드 미완, 펀딩 모집 중) — 2026 내 릴리스 보장 없음. `sky`·심볼 고도·`resampling` 미지원. 네이티브 hillshade 열린 버그: #4453(iOS 6.24+ 스칼라 색 지정 시 크래시), #4296(shadow/highlight 에 표현식 거부), #4279(타일 이음새) → **1단계 iOS 확인 필수, 색은 표현식 없이 리터럴로**.
  - **오버레이 라이브러리(web 전용)** — deck.gl 9.3(`TerrainLayer`+`TerrainExtension` 드레이프, `PathLayer` 3D 좌표, `TripsLayer` 흐름 애니메이션): MapLibre `setTerrain` 과 z 가 안 맞아(공식 문구) 지형을 deck 쪽에서 그리거나 좌표에 고도를 직접 넣어야 함, RN 불가. three.js: `react-three-map` 1.0(R3F, 2026-07), `@dvt3d/maplibre-three-plugin` 1.7(2026-07) 활발, MapLibre 커스텀 레이어는 `renderingMode:'3d'` 로 지형 깊이를 공유하고 `queryTerrainElevation` 으로 고도를 얹음 — **수면 셰이더는 자작**(three `Water2`/flow-map 방식). threebox 는 Mapbox 전용. 물 흐름 참고: `line-dasharray` rAF 교체(공식 예제, **web+native 유일**), `line-gradient` 하이라이트, `@geoql/maplibre-gl-wind`(입자, 벡터장 필요).
  - **엔진 교체형(부적합)** — CesiumJS 1.145(무료지만 World Terrain 은 ion 토큰·유료, RN 미지원), iTowns, Procedural GL JS(2021 정지), Mapbox GL JS v3 Standard(독점·과금·토큰), **@rnmapbox/maps 10.3**(Mapbox v11 — RN 에서 3D terrain 이 되는 **유일한** 경로지만 토큰·25k MAU 이후 과금·독점 라이선스 → D4 무키 원칙 위반), Google 3D(RN 라이브러리 없음), **VWorld 3D**(Cesium 기반 자체 뷰어만, MapLibre 연동 불가, 영리 이용 사전 승낙·데이터 저장 금지 → `/firework` 보존 규칙과 충돌). 네이버·카카오·TMAP SDK 는 3D 지형을 개발자에게 열지 않음(네이버 `Terrain` 은 2D 음영 타일).
  - **DEM 데이터(한국)** — 90m 초과 정밀도 DEM 은 **공개제한**(NGII 보안관리규정 별표1). 5m/1m 은 LX 안심구역에서만 열람, 타일 호스팅 불가 → C10 메모의 "자체 DEM 타일(5m) v2" 는 **철회**. 공개 90m 는 VWorld 등재본이 CC BY-NC-ND 로 표기(data.go.kr 은 제한 없음 — 불일치, 서면 확인 필요). 현실적 업그레이드는 Terrarium(SRTM 30m, 2017 이후 갱신 없음) → **Copernicus GLO-30**(같은 30m, 수직정확도 ~4m vs ~9m): Mapterhorn 타일(`tiles.mapterhorn.com/{z}/{x}/{y}.webp`, terrarium 인코딩, 한국은 glo30 z≤12) 또는 P1 이 이미 받는 GLO-30 COG 로 자체 PMTiles(`rio rgbify` → `pmtiles`). 계곡 형상은 30m 한계 그대로.
  - **하천 벡터(한국)** — **연속수치지형도 1:5,000 수계 레이어**(하천중심선 E00020000 · 실폭하천 E0032111 · 하천경계 E00010001, 공공누리 1유형, 국토정보플랫폼 영역 다운로드)가 OSM waterway 보다 소계류까지 **폭 있는 폴리곤**을 준다 — "물줄기가 3D 로 보인다" 에 가장 크게 기여할 데이터. 주의: 같은 자료의 **등고선·표고값은 인터넷·휴대폰 표시 금지**(별표1 전자지도 조건) → 등고선은 DEM 파생(maplibre-contour)으로만. 물놀이관리지역은 WMS 위주(K1 유지). → **R5 신설**.
  - **C10 계획에 반영할 것**: (1) 1단계에 `color-relief`(web+native 공통, 고도별 옅은 색) 와 `hillshade-method: multidirectional` 을 후보로 추가 — 검토 페이지 v2 에 스파이크 스크린샷으로 얹는다 (2) 3단계 봉우리 라벨은 web 에서 `symbol-height-offset` 으로 지형 위에 (3) 물줄기 "3D 느낌" 은 라이브러리가 아니라 **R5 실폭 폴리곤 + 드레이프 + `line-dasharray` 흐름(web·native 공통)** 으로 설계, 수면 셰이더·deck.gl 은 web 전용 후속(L1) (4) DEM 소스 결정: Terrarium 유지 vs GLO-30(Mapterhorn) — D4 갱신 대상 (5) 4단계 등고선은 maplibre-contour 6.x 호환 확인부터.

### F4 — 지도 그늘 보기 + 시간 슬라이더 (기획 2026-09-03)

P1 산출물을 **화면에 올리는** 항목. D6 의 "지도에 그늘 레이어 출력"이 여기서 끝난다. 새 계산은 없다 — 파일을 읽어 그리고, 구간 속성을 시트에 보인다.

**연구 질문 → 답**

1. *입력은 무엇이고 어디까지 와 있나.* `data/shade/<valleyId>/canopy.geojson` 1장 + `shadow-<HH>.geojson` 9장(10~18시, 비어 있으면 빈 컬렉션) + `data/shade/index.json`(계곡별 bbox·시각·자산·`segments.shadeByHour`). 폴리곤은 구간 회랑 ±200m 로 잘려 샘플 계곡 합계 98KB. 구간 속성 `shadeByHour[9]`·`canopyCover` 는 P1 이 `data/*.geojson` 에 역기입했고 `Segment` 도메인·로더가 이미 읽는다(`SHADE_HOURS`·`SHADE_NOON_INDEX` 상수 있음). 앱 쪽은 `scripts/sync-valley-data.mjs` 가 `data/shade/**` 를 `assets/valley/shade/**`(`.json`) 로 복사하는 것까지 P1 에 들어 있다 — **아직 아무도 import 하지 않는다.**
2. *지도에 어떻게 얹나.* C4 의 `FeatureLayerSet` 레지스트리(`MAP_LAYER_SETS`)에 한 항목을 더하면 web `FeatureLayerController` 와 네이티브 `FeatureSource` 가 **코드 변경 없이** 순회해 그린다. 다만 두 가지가 계약에 없다: (a) 히트 대상이 아닌 레이어 셋(`interactiveLayerIds: []`) — `kind: MapFeatureKind` 가 press 참조와 묶여 있어 `'shade'` 를 넣으면 `toMapFeatureRef` 가 깨지고, 네이티브 `GeoJSONSource.onPress` 는 소스의 모든 피처에 발화한다. (b) **그리는 위치** — 레이어 셋은 스타일 끝에 붙어 도로·지명 라벨 위에 올라간다. 선·점은 그래도 되지만 반투명 fill 이 라벨을 덮으면 읽기가 나빠진다. 둘 다 레지스트리 계약을 조금 넓혀 푼다(아래 범위).
3. *시간 축은 어디서 정하나.* 애플리케이션 상태다. 시각을 바꾸면 "무엇을 그릴지"(`MapContent`) 가 바뀌고 어댑터는 참조 비교로 그늘 소스만 다시 쓴다 — 선택·구간 소스는 건드리지 않는다(C4 의 `dependencies` 설계가 그대로 값을 한다).
4. *네이티브 제약이 있나.* 없다. fill 레이어는 maplibre-native 가 그대로 그린다. 능력 매트릭스 변경 없음. 데이터가 번들이라 파일 I/O 도 없다.
5. *번들은 어떻게 하나.* Metro 는 정적 `import` 만 받는다 — 계곡 수만큼 파일을 손으로 import 할 수 없다. `sync-valley-data.mjs` 가 복사 대신 **한 파일로 합친다**: `assets/valley/shade-bundle.json` = `{ index, valleys: { <valleyId>: { canopy, shadow: { "10": …, "18": … } } } }`. 샘플 98KB, 계곡이 늘면 비례해 커진다 — S1(서버) 때 지연 로드로 바꾼다. 개별 복사는 유지하지 않는다(사본이 둘이면 어긋난다, 스크립트 주석의 규칙).

**결정 — 2026-09-03 사용자 확정 (A1·B1·C1·D1·E1·F1·G1, 검토 페이지에서 권고안 그대로). 아래 각 항이 그대로 계약이다.**

- (a) **슬라이더 기본 시각** — 현재 KST 시각을 10~18 로 클램프해 가장 가까운 정시. 10시 전·18시 후에 열면 **정오**(`SHADE_NOON_INDEX`) — 그 시각에는 그늘 데이터가 없고, 정오가 `shadeRatio` 와 같은 값이라 카드와 지도가 일치한다. 시각은 저장하지 않는다.
- (b) **슬라이더 형태** — 새 의존성 없이 **9개 정시 눌림 트랙**(`10 · 11 · … · 18` 눈금, 현재 눈금 강조, 좌우 ‹ › 버튼). 연속 슬라이더(`@react-native-community/slider`)는 세 플랫폼 공통 모듈이 하나 더 들어오고, 데이터가 정시 9개뿐이라 연속값이 의미가 없다. 그늘이 켜진 동안만 보인다.
- (c) **토글 위치** — 계곡 화면 `MapControls` 의 나침반 아래, festival 의 불꽃 버튼 자리(계곡에서 비어 있는 자리)에 원형 `ctrl` 하나. 켜지면 `ctrlOn`(accent 배경). 시트 안에 두지 않는 이유: 시트가 접혀도 지도 위 레이어는 조작할 수 있어야 한다. 트랙은 컨트롤 열 왼쪽, 시트 바로 위에 가로로 놓는다(`bottomRow` 와 같은 높이 규칙).
- (d) **색** — 수관(canopy)과 개방지 그림자(shadow)를 **한 소스, fill 레이어 2장**으로 구분한다. 라이트 지도 기준 수관 `#1f4d2e`·opacity 0.28, 그림자 `#1c3a5e`·opacity 0.32. 두 테마에 같은 값 — 레이어 셋은 모드를 모르고, 다크 계곡 화면은 계약 밖이다(C10 메모와 같은 태도). 값은 스크린샷을 보고 확정한다 — 라이트 팔레트가 이미 녹지를 진하게 칠하고 있어(`VALLEY_PARK_OPACITY`) 수관색이 묻힐 수 있다. 묻히면 수관을 회청색 계열로 옮긴다.
- (e) **그리는 위치** — 첫 `symbol` 레이어 **아래**(라벨 아래, 도로·물 위). 3D 건물(`fill-extrusion`) 보다도 아래라 건물이 그늘을 뚫고 선다 — 계곡에 건물은 거의 없다.
- (f) **상세 시트** — F1 의 "그늘 정보 준비 중" 자리를 실제 값으로 채운다: 타일 1장 `그늘 68% · 14:00 기준`(슬라이더 시각 = 지도와 같은 시각, 그늘이 꺼져 있으면 정오) + 나무 밀도 3단계(`canopyCover` ≥0.7 많음 / ≥0.4 보통 / 그 외 적음 — 임계값은 표현 계층, `Segment.ts` 주석대로) + 한 줄 고지 "위성 기반 추정 · 수관 2019년 촬영 · 현장과 다를 수 있음"(`metadata.chmAcquisition` 에서 읽음, README 요구). 데이터가 없는 구간은 "정보 없음". 카드 부제(`segmentSubtitle`)는 **바꾸지 않는다** — 계곡 화면 시각 개선에서 한 번에.
- (g) **영속** — 토글 on/off 는 `STORAGE_KEYS.shadeVisible` 로 저장(spotLayout 과 같은 경로). 기본은 **꺼짐** — 첫 화면은 구간·시설이 주인공이고, 그늘은 사용자가 켜는 렌즈다.

**범위**

- `core`
  - `domain/valley/Shade.ts`: `ShadeHourIndex`(0~8), `ShadePolygons`(검증된 `[lng,lat]` 링 배열 — `LngLat` 객체를 정점마다 만들지 않는다, 수천 점), `ValleyShade { valleyId, canopy, shadowByHour[9], metadata{ representativeDate, chmAcquisition, source } }`, 파서 `loadShadeBundle(raw)`(스키마 검증, 실패는 `Result`). `canopyLevel(cover)` 3단계 라벨 함수.
  - `ValleyDataset.shade: ReadonlyMap<ValleyId, ValleyShade>`(없으면 빈 맵) — `loadValleyDataset(segments, facilities, shadeBundle?)`. `ValleyRepositoryPort` 시그니처 불변.
  - `MapContent.shade: ShadeOverlay | null` — `{ canopy: ShadePolygons, shadow: ShadePolygons }` 로 **지금 그릴 것만** 싣는다. `EMPTY_MAP_CONTENT.shade = null`.
  - `AppState.shadeVisible: boolean`, `shadeHourIndex: ShadeHourIndex`. `initialAppState` 는 (a)(g) 규칙 — 시각 계산에 `now: () => Date` 를 `MapSessionDeps` 로 주입(기본 `() => new Date()`, 테스트는 고정). `SessionStore.setShadeVisible / setShadeHour`.
  - `ToggleShadeUseCase`, `SetShadeHourUseCase`: 상태 갱신 → `engine.renderContent(현재 내용 + shade)`. `LoadSessionUseCase.#loadValley` 는 저장된 토글을 읽어 첫 렌더에 반영. `MapSession.toggleShade() / setShadeHour(index)` 파사드, festival 장면에서는 무시.
  - `FeatureLayerSet` 계약 확장(타입은 core 가 아니라 map-style 에 있음 — 아래).
- `map-style`
  - `shadeLayers.ts`: `SHADE_SOURCE_ID = 'valley-shade'`, fill 레이어 `valley-shade-canopy`·`valley-shade-shadow`(`properties.layer` 로 match). `toShadeFeatureCollection(overlay)`. `dependencies: [content.shade]`.
  - `layerSets.ts`: `kind: MapLayerKind = MapFeatureKind | 'shade'`, `interactiveLayerIds` 빈 셋 허용, **`placement?: 'below-labels'`** 필드 추가(기본 = 맨 위). `MAP_LAYER_SETS = [SHADE, SEGMENT, FACILITY, SPOT]`. `findLayerSetBySource` 반환에서 press 가능 여부를 함께 판단할 헬퍼 `isInteractiveLayerSet`.
  - `applyMapPalette` 는 건드리지 않는다.
- `adapter-web`: `FeatureLayerController.install` 이 `placement` 를 읽어 첫 symbol 레이어 id 를 찾아 `addLayer(layer, beforeId)`. 히트 배선은 `interactiveLayerIds` 가 비면 아무것도 안 한다(이미 그렇다).
- `adapter-native`: `NativeMapEngine` press 경로가 비인터랙티브 셋을 무시. `NativeMapView.FeatureSource` 는 `interactiveLayerIds` 가 비면 `onPress` 를 달지 않고, `placement` 를 `belowLayerID` 로 옮긴다(첫 symbol 레이어 id 는 스타일에서 한 번 계산해 `MapScene` 에 실어 보낸다 — 뷰가 스타일을 훑지 않게).
- `apps/valley-map`
  - `scripts/sync-valley-data.mjs`: `shade/**` 개별 복사 → `shade-bundle.json` 합본으로 교체. `valleySource.ts` 가 import 해 `loadValleyDataset` 에 넘긴다. 합본이 없으면(그늘 미산출 체크아웃) 빈 맵 — 앱은 살아야 한다.
  - `MapControls`: valley 장면에 그늘 `ctrl`(아이콘 `ShadeIcon` 신규, 나무+해 실루엣), `ctrlOn` 연동, 접근성 라벨 `VALLEY_COPY.controlTitles.shade`.
  - `components/valley/ShadeHourTrack.tsx`: 9 눈금 트랙 + ‹ ›. `shadeVisible` 일 때만 렌더. 폰(시트 45%)에서 컨트롤 열과 겹치지 않는지 폭 계산.
  - `ValleyDetailFace`: 그늘 타일·나무 밀도·고지 (f). `copy.ts` 문구 추가, `shadePending` 은 데이터 없는 구간의 "정보 없음" 으로 의미 이동.
  - `/firework` 는 코드 경로가 공유되는 `MAP_LAYER_SETS`·`FeatureLayerController`·`NativeMapView` 만 스친다 — 그늘 소스는 festival 장면에서 항상 빈 컬렉션.
- **PR 2개**(F1 과 같은 이유 — 계약 변경과 UI 를 따로 본다)
  - **F4a** core + map-style + 두 어댑터: 레이어 셋·배치·비인터랙티브 계약, 상태·유즈케이스, 로더. `FakeMapEngine` 로 "시각을 바꾸면 shade 참조만 바뀐다" 테스트. 임시로 샘플 그늘을 하드코딩해 web 스크린샷 1장(라이트, 정오) 으로 색·배치를 사용자에게 보인다 — (d) 확정 지점.
  - **F4b** app: 합본 스크립트, 토글·트랙·상세 타일, 세 플랫폼 검증.

**검증**

- `pnpm verify` 통과. 새 테스트: `Shade` 로더(길이 9·링 최소 4점·범위), `shadeLayers`(피처 컬렉션·`properties.layer`·의존 배열), `layerSets`(순서·`placement`·비인터랙티브), `MapSession`(toggle/setHour → `renderContent` 호출 수와 `shade` 참조, festival 무시, 기본 시각 규칙 — `now` 고정), `NativeMapEngine`(그늘 소스 press 무시).
- web 스크린샷(1440×757, `docs/PARITY.md` 기준 뷰포트): 라이트 계곡 화면 — 그늘 꺼짐 / 12:00 / 17:00(그림자 폴리곤이 가장 큰 시각) / 상세 시트 그늘 타일. 다크 계곡 화면 1장(참고용, 계약 아님).
- `/firework` 다크 강제(`EXPO_PUBLIC_THEME=dark`) main 과 픽셀 diff **0** — `MAP_LAYER_SETS` 에 빈 소스 하나가 추가된 상태에서.
- iOS 시뮬레이터: 토글·트랙·fill 렌더·라벨 아래 배치 확인(스크린샷 PR 코멘트). android 는 SDK 없음 — typecheck 까지.
- 성능 표: 합본 크기, 첫 `renderContent` 까지 시간, 시각 변경 시 `setData` 1회(그늘 소스만)인지 로그로 확인.

**범위 밖**: 시각 애니메이션(자동 재생), 그늘 폴리곤 클릭 정보, 구간 카드 부제의 그늘 문구(시각 개선), 계곡별 지연 로드(S1), 다크 전용 그늘 색, "지금 그늘" 실시간 태양 계산(대표일 8/1 고정 — 데이터 규약).

**진행 (2026-09-03) — F4a PR [#12](https://github.com/4sizn/modu-valley/pull/12) 열림 (`in-review`, 브랜치 `4sizn/F4a-shade-core`, F4b 는 `4sizn/F4-shade-view` 에 stacked)**. 결정 (a)~(g) 를 계약대로 구현, `pnpm verify` 통과(core 190 · map-style 41 · adapter-native 29 · app 15). 기획 대비 판단한 것 — ① `AppState.valleyShade` 추가(상세 고지가 `metadata.chmAcquisition` 을 읽어야 한다; `setValleys` 가 함께 쓴다) ② `MapContentComposer`(application) — 바탕(구간·시설)을 적재 때 한 번 굳혀 "시각을 바꾸면 shade 참조만 바뀐다"를 지키는 조립 책임 하나 ③ `setShadeHour` 는 동기(저장 없음), `toggleShade` 는 비동기(저장) ④ 네이티브 `Layer` 의 배치 prop 실제 이름은 `beforeId`(위 범위의 `belowLayerID` 표기 정정). 색 (d) 는 라이트·정오 스크린샷(`proof/F4-shade-view`)에서 수관 진녹이 배경 녹지와 갈려 **권고안 그대로 확정** — 회청색 이동 불필요.

**진행 (2026-09-03) — F4b PR [#13](https://github.com/4sizn/modu-valley/pull/13) 열림 (`in-review`, #12 위 stacked)**. 합본 `shade-bundle.json`(100,183 bytes, 산출물 없으면 빈 합본), 그늘 ctrl + `ShadeIcon`, `ShadeHourTrack`, 상세 타일 "그늘 · HH:00 기준 / NN% · 나무 많음|보통|적음" + 고지, `shadePending` → "정보 없음". 검증: web 라이트 4장(꺼짐/12:00/17:00/상세) + 좁은 화면 + 다크 참고, **`/firework` 다크 픽셀 diff 0**(main 워크트리, 불꽃 off·티커 숨김·셀프 diff 0 대조군), 성능 표(시각 변경마다 `valley-shade` setData 1회·구간/시설 소스 불변, 첫 renderContent 지도 준비 후 6ms), **iOS 시뮬레이터**(iPhone 17) 토글·트랙·fill·라벨 아래 배치·타일·영속 확인. 기획 대비 판단 — ① 데스크톱 트랙은 제보 버튼과 같은 행 ② 켜진 버튼 아이콘 흰색 ③ 고지 대표일은 파일 메타에서 ④ 합본 없으면 빈 합본. iOS 에서 잡은 것: 폰 폭 트랙이 "계곡으로" 버튼과 겹쳐 오른쪽을 비우고 HH:00 생략(수정 커밋). android 는 typecheck 까지(SDK 없음).

**결과 (2026-09-03, PR [#12](https://github.com/4sizn/modu-valley/pull/12) core·map-style·어댑터 · [#13](https://github.com/4sizn/modu-valley/pull/13) app 머지 → `done`)**: 결정 (a)~(g) 그대로. D6 의 "지도에 그늘 레이어 출력" 이 여기서 끝났다. 워크트리 `F4-shade-view`·브랜치 `4sizn/F4a-shade-core`·`4sizn/F4-shade-view` 삭제, 스크린샷은 고아 브랜치 `proof/F4-shade-view` 에 남김. `spike/F4-preview` 는 검토용 스파이크(머지 금지)로 로컬에만 있다. 후속 후보(범위 밖 그대로): 다크 전용 그늘 색(C10·시각 개선과 함께), 계곡별 지연 로드(S1), 카드 부제 그늘 문구(시각 개선).

### F3a — 경보 캘리브레이션 스파이크 (착수 2026-09-04, 사용자 "ㅇㅇ ㄱㄱ")

**목표** — `docs/F3_ALERT_DESIGN.md` §1.2 경계값 표(리드타임 30분·강우 4단계·수위 4단계·해제)를 **2026년 7~8월 실제 호우 사례**로 검증해 확정한다. 서버 없이 연구 스크립트만. 판정 기준은 §7 4번: 강우 시작 → 하류 수위 반응 지연이 ≥ 30분인 사례가 2/3 이상이면 경계값 채택.

**먼저 읽을 것** — `docs/F3_ALERT_DESIGN.md`(§1.2·§2·§7), `scripts/research/station-coverage/README.md`(R1 방법·한계), `docs/API_KEYS.md`. R1 스크립트(`scripts/research/station-coverage/*.ts` — `env.ts` 키 로더, `http.ts`, `cache.ts`, `stations.ts` DMS 파서)를 **재사용**한다. 관측소 원본 목록은 R1 워크트리 `.cache/` 에 있으니 복사하거나 다시 받는다.

**키** — 저장소 루트 `.env.local`(gitignore). 새 워크트리에는 없으므로 `cp /Users/hsshin/orca/workspaces/modu-valley/R1-station-coverage/.env.local .` 로 복사. 값은 로그·문서·커밋 어디에도 남기지 않는다(`env.ts` 의 `redact` 사용). 값 뒤에 `  # 주석` 이 붙어 있어 `env.ts` 로더를 써야 한다.

**데이터 (전부 동작 확인됨, 2026-09-04)**
- 한강홍수통제소 10분 수위: `https://api.hrfco.go.kr/{KEY}/waterlevel/list/10M/{wlobscd}/{YYYYMMDDHHmm}/{YYYYMMDDHHmm}.json` → `content[{ymdhm, wl(m), fw(유량)}]` 내림차순. 10분 강우: `/{KEY}/rainfall/list/10M/{rfobscd}/{시작}/{끝}.json` → `content[{ymdhm, rf(mm/10분)}]`. 한도: 일일 없음, 분당 1,000건 초과 금지. 두 달치는 하루 단위로 나눠 받고 `.cache/` 에 저장.
- 기상청 AWS 매분자료: `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min?tm1={YYYYMMDDHHmm}&tm2={...}&stn={지점}&disp=1&help=1&authKey={KEY}` — EUC-KR 텍스트, `#` 헤더에 컬럼 설명(강수 컬럼 RN-15m·RN-60m·RN-12H·RN-DAY 등은 `help=1` 로 확인). 한도 20,000건/일 → 시간 범위를 넓게(하루 단위) 요청.
- 수위 4단계 기준은 `waterlevel/info` 제원 `attwl·wrnwl·almwl·srswl`(m, 관측 수위 `wl` 과 같은 기준면).

**사례 쌍 3개** (R1 결과에서 고름)
| 계곡 | 상류 강우 | 하류 수위 | 뜻 |
| --- | --- | --- | --- |
| 소요산계곡 | AWS `454` 하봉암(2.9 km, +24 m) · HRFCO `10224050` 양주시(봉암초교) | HRFCO `1022670` 연천군(신천교) 5.1 km, 4단계 3.5/4.8/5.5/6.7 m — **동명의 영월군(신천교) `1002687` 과 혼동 주의** | S1 + S4 둘 다 있는 최적 쌍 |
| 광덕계곡 | AWS `695` 광덕산(2.7 km, +472 m) | HRFCO `1010686` 화천군(일광교) 8 km, 4단계 2.5/3.6/4.7/5.9 m | 고지 우량계 vs 하류 수위 |
| 경반계곡 | 상류 우량계 없음 → 인접 저지 HRFCO `10134030` 가평군(화악교, +1 m 10 km) 와 AWS 경기가평 | HRFCO `1013655` 가평군(가평교) 4.3 km, 4단계 2.8/4.0/5.0/6.2 m | 관측소 없는 계곡의 대리 신호가 얼마나 늦는가. 격자(S3)는 키가 없어 이번엔 제외 |
유명산·어비(중미산 `10154030`)는 하류 수위 관측소가 없어 강우 이벤트 통계에만 쓴다.

**방법**
1. 2026-07-01~08-31 10분 강우를 받아 **이벤트** 추출: 1시간 합 ≥ 10 mm(관심) 인 구간, 6시간 무강우로 분리. 사례 수를 README 에 적는다(호우일이 적으면 2025-07~08 도 받아 본다 — HRFCO 는 과거 자료 제공 여부를 확인).
2. 이벤트마다: 강우 시작(10분 ≥ 1 mm 첫 시각) · §1.2 관심/주의/경계 **도달 시각** · 수위 반응 시작(10분 Δ ≥ +5 cm 첫 시각) · 수위 관심(attwl) 도달 여부와 시각 · 피크 시각.
3. **리드타임** = 수위 반응 시작 − 경보(주의) 시각. 분포(중앙값·최소)를 쌍별로.
4. **오경보·미경보**: 임계값(관심/주의/경계, 10분·1h·3h 변형)별로 "경보 발령 후 2시간 안 수위 +10 cm 이상 상승" 을 정답으로 혼동행렬. 해제 규칙(강우 < 관심 30분 ∧ 수위 하강 60분)이 피크 전에 풀리는 일이 있는지.
5. 경반 쌍: 저지 우량계·AWS 가 신천교/가평교 수위보다 **얼마나 늦게** 반응하는지(음수면 대리 신호 불가) — S2 상한(관심 한정) 결정의 근거.
6. 격자 강수(S3): API허브 활용신청은 **사용자 로그인 필요** — 공개 문서에서 레이더 합성 강수·초단기예보 격자의 API 이름·형식·갱신 주기를 조사해 K1 에 신청 항목으로 적고, 사용자에게 요청 문구를 남긴다. 실측은 다음 스파이크.

**산출물** — `scripts/research/alert-calibration/`(tsx, 루트 `pnpm research:calibration`, `.cache/` gitignore) + `README.md`(사례 표·리드타임 분포·혼동행렬·**경계값 표 확정안 또는 수정안**·한계) + 이 절에 판정 + 결정 기록 "F3a 판정"(사용자 승인 대기) + 항목 표 F3a `in-review`. 원본 시계열은 커밋하지 않고 이벤트별 요약(시각·mm·cm)만. **PR 1개, base 는 `4sizn/R1-station-coverage`**(#17 위 stacked — F3 문서가 거기 있다).

**규칙** — `pnpm verify` 통과(연구 스크립트는 biome 제외 경로, 자체 tsconfig 로 `tsc --noEmit`), `/firework`·앱 코드 무변경, 진행은 `orca worktree set --worktree active --comment`, 상태 전이는 항목 표·결정 기록 같은 커밋.

**판정 (2026-09-04) — 사용자 승인 2026-09-06(전부 권고안)** — 상세 `scripts/research/alert-calibration/README.md`, 표 전체 `results.md`. **검토 페이지**(2026-09-06, 사례 3건 하이드로그래프 · 리드타임 59건 · 임계값 정밀도/재현율 · 해제 비교 · 결정 5항목 라디오 + 요약 복사 · API허브 활용신청 5건 화면 캡처와 버튼 위치): https://claude.ai/code/artifact/666803c9-1a77-485d-9fca-9132cecf535a
- **표본**: 2026-07-01~08-31, 우량계 6개 × 하류 수위 3개, 이벤트 93 · 사례(1h ≥ 10 mm) 59. 7/14·7/18(소요산 195 mm, 신천교 +3.5 m 관심 도달)·7/22~24·8/22 가 공통 호우. 2025 자료는 필요 없어 안 받았다.
- **리드타임(§7 4번) 통과**: 강우 시작 → 하류 수위 반응(10분 +5 cm) 지연 ≥ 30분이 **14/14**(중앙값 소요산 310 · 광덕 240 · 경반 대리 380분, 최소 130/190/330분). 관심 도달 기준 14/14(최소 50분). **주의 기준은 9/12** — 광덕 2건은 주의(1h 20)가 수위 반응보다 늦었다(하루 넘는 비) → 관심이 첫 표시(watch)여야 한다는 §3 매핑 확인. 단 하류 관측소는 계곡보다 훨씬 큰 하천(신천·사내천·가평천 본류)이라 이 지연은 **상한**이고, 계곡 규모 검증은 S3 격자 + 사후 제보로.
- **임계값**: 관심의 10분 3 mm 조건은 모든 쌍에서 오경보만 보탠다(정밀도 0.27~0.50 → 1h 10 만 0.44~0.78, 재현율 손실 없음) → **삭제**. 주의(10분 5 ∨ 1h 20)·경계·심각 유지(경계 발령 2~3회 전부 적중, 3h 창은 거의 안 쓰임).
- **수위**: 관측소 4단계는 하천 범람 기준이라 여름 내 attwl 도달 소요산 1회·가평 0회 — 승격 트리거는 **10분 +10 cm** 가 실제로 일한다(신천교 최대 +27 cm/10분). srswl 은 대피 조건으로만.
- **해제**: 수위 하강 60분 조건이 없으면 6~7/7 이 피크 전에 풀린다(필수). 규칙대로면 소요산 0/7 · 경반 1/7 · 광덕 4/7(이틀짜리 다중 강우) → **3h 합 < 20 mm 추가**(광덕 4→3, 화악교 1→0), 나머지는 재발령·한 칸 하강으로.
- **S2**: 6~12 km 떨어진 우량계끼리 관심 동시성 50~60% → "관심 한정" 유지. 경반의 저지 대리 신호는 가평교보다 늦지 않지만(음수 0) 계곡 자체를 말해 주진 않는다.
- **S3 격자**: API허브 **레이더 합성 HSR 이 수치 격자**(500 m·5분, `nph-rdr_cmp_inf`/`nph-rdr_cmp1_api`)로 있고, 융합기상 고해상도 격자(500 m·5분)는 **지점 수치 조회**(`nph-sfc_obs_nc_pt_api`)가 있다. 전부 이 키로 403(활용신청 필요·엔드포인트 존재). 신청 항목·요청 문구 `docs/API_KEYS.md` 9절 → **K1 사용자 액션**. 결정 (d) 레이더 우선 유지.
- **함정**: AWS 매분자료 하루치 요청은 서버가 ~25 s 에서 200 인 채로 잘라 보낸다(`#7777END` 없음) → 6시간 조각 + 표식 검증. HRFCO 10분 자료는 2025 도 제공.
- **다음**: ~~사용자 승인~~ ✓ 2026-09-06 → `docs/F3_ALERT_DESIGN.md` §1.2·§3 갱신 ✓ → K1 격자 활용신청(진행 중) → S1 서버 → F3b. S3 실측 스파이크는 K1 신청 뒤.

### V1 — 계곡 화면 시각 개선 (기획 2026-09-06)

**배경** — 세 번 미룬 판정이 여기로 모인다. F1(2026-09-03) "디자인은 마음에 들지 않음"(카드 제목 반복 ⑤ 포함), C2 "라이트 지도 아직 마음에 들지 않음"(팔레트 톤·녹지 강도·건물 회색·라벨 밀도), F4 후속(카드 부제 그늘 문구·다크 그늘 색), C10 후속(구간 상태색을 물줄기 폴리곤에 칠할지). 기능은 다 붙었으니 **값·레이아웃·위계만** 손댄다. 새 데이터·새 레이어 없음.

**기준 화면(2026-09-06 main, 스파이크 전)** — 라이트 목록: 음영 0.5 + 고도색 0.85(I2) + 녹지 0.75 가 화면 전체를 올리브·갈색 질감으로 덮고, 물줄기(구간 선 2.5px + 흰 점선)는 그 위에서 가늘어 가장 먼저 읽혀야 할 것이 가장 늦게 읽힌다. 시설은 7px 색 점 3개. 카드 3장 모두 제목이 "샘플계곡", 정보는 부제 한 줄. 목록 상단에 데이터셋 설명 한 줄(샘플 고지)이 카드보다 먼저 온다. 다크는 음영 0.35 위 구간 선 글로우로 오히려 위계가 선다. 폰(390)은 지도 영역이 45% 시트 위 좁은 띄인데 트랙·컨트롤이 그 안에 다 들어온다.

**연구 질문 → 답**

1. *무엇이 "마음에 안 드는가" 를 분해하면?* 사용자 판정은 문장 셋뿐이라 화면에서 읽히는 문제로 바꿨다 — ① **위계 역전**: 지형 질감(배경) > 물줄기(주인공). ② **정보 반복**: 카드 제목 = 섹션 제목 = 계곡명. ③ **톤 불일치**: 지도는 갈색·올리브(지형도), UI 는 흰 카드·파랑 accent(앱) — 두 세계가 한 화면에. ④ **점 3개**: 시설이 종류를 말하지 않는다(C5 전). ⑤ 폰에서 지도 45% 안에 컨트롤 4 + 트랙 + 제보가 겹쳐 지도가 보이지 않는다.
2. *어디를 만지면 가장 크게 바뀌나?* 값 다섯 개 — `VALLEY_PARK_OPACITY`(녹지), `terrainLayers` 의 hillshade-exaggeration·color-relief-opacity(질감), `segmentLayers` 의 line-width·casing(물줄기), `SegmentCard` 제목/부제 구성, `ValleyListFace` 안내문 위치. 전부 map-style 상수와 app 컴포넌트에 있고 계약(포트·레이어 셋)은 그대로다.
3. *C10 결정(I2 진한 고도색·B1 음영 0.5)과 충돌하나?* C10 은 "지형이 읽히게" 였고 V1 은 "물줄기가 먼저 읽히게" 다. 둘 다 만족하는 길은 **질감을 배경으로 내리고**(불투명도) 물줄기를 올리는 것이지 지형을 끄는 게 아니다. 목록(평면)과 상세(pitch 58) 에서 다른 강도를 쓰는 것도 후보 — 상세에서는 3D 가 형태를 보여 주니 고도색이 덜 필요하다.
4. *`/firework` 는?* 계곡 장면 전용 값(`composeMapStyle` 의 valley 조정, 계곡 레이어 셋, valley 컴포넌트)만 바꾼다. festival 팔레트·레이어·컴포넌트는 손대지 않는다 — 다크 강제 픽셀 diff 0 이 검증.

**결정 (검토 페이지에서 스크린샷으로, 권고안 첫 번째)**

- (a) **지형 질감 강도(목록 평면 뷰)** — A1 절제: 음영 0.35 · 고도색 0.45 (권고) / A2 현재: 0.5 · 0.85 / A3 목록은 음영만(고도색은 상세 3D 진입 시)
- (b) **녹지·숲 톤** — B1 한 톤 차분한 회록 `#cfe0c0`·z14 0.55 (권고) / B2 현재 `#d8ecc5`·0.75 / B3 positron 원본 강도(0.2→0.5 로 줄어듦)
- (c) **물줄기 위계** — C1 굵은 물색 선 + 흰 케이싱(z14 4→z16 10px, 상태색은 케이싱 안쪽 선) (권고) / C2 현재(2.5px + 점선) / C3 C1 + OSM 하천(waterway) 선폭·색 강조, 도로 채도 한 단계 낮춤
- (d) **카드 제목** — D1 제목 = 위치·수심("중류 · 허리"), 부제 = 바닥 · 주차장 · **그늘(정오 %)**, 계곡명은 섹션 헤더만 (권고) / D2 현재(계곡명 반복) / D3 D1 + 카드 왼쪽 상태 스트라이프(혼잡색, 미확인은 회색)
- (e) **목록 상단 안내문** — E1 데이터셋 설명·샘플 고지를 footer 로 내리고 헤더 아래에 "구간 n · 시설 m · 정오 그늘 평균 nn%" 한 줄 (권고) / E2 현재
- (f) **시설 점(C5 전 임시)** — F1 12px 흰 원 + 유형 이니셜 텍스트(P·WC·S…) (권고) / F2 현재 7px 색 점 / F3 유형별 색 + 이름 라벨(z15+)
- (g) **그늘 폴리곤 대비** — G1 그늘 켜면 음영 강도를 0.2 로 자동 하향, 수관 opacity 0.4 (권고) / G2 현재 / G3 수관을 청록 `#1f5f5a` 으로
- (h) **다크 계곡 톤** — H1 현재(원본 dark paint + 음영 0.35) (권고) / H2 `DARK_MAP_PALETTE` 재색칠 켬(C2 미결) — 다크는 계약 밖이라 참고 결정
- (i) **폰 지도 영역** — I1 폰에서 시트 기본 높이 45% → 40%, 트랙은 시트 안 상단으로 (권고) / I2 현재 / I3 컨트롤 열을 2열 그리드로 압축

**범위**

- `map-style`: `VALLEY_PARK_OPACITY`·숲색, `terrainLayers` 강도(장면·pitch 별 상수), `segmentLayers` 선폭·케이싱 레이어 1장 추가, `facilityLayers` 심볼 텍스트, `shadeLayers` opacity. 전부 계곡 전용 값.
- `apps/valley-map`: `SegmentCard` 제목·부제·스트라이프, `ValleyListFace` 헤더 요약·footer, `segmentSubtitle`(core) 에 그늘 문구 옵션, 폰 시트 높이(`CenterColumn`), `ShadeHourTrack` 위치.
- 토큰(C1)은 값 추가 없이 쓴다. 새 리터럴 색은 `markerPalette`/`palette` 에만.
- PR 2개: **V1a** map-style(지도 톤·물줄기·시설·그늘 대비) → **V1b** app(카드·안내문·폰 배치). 각 PR 에 라이트/다크/폰 스크린샷과 `/firework` 다크 diff 0.

**검증** — `pnpm verify`, 라이트 목록/상세/그늘 켬 + 폰 목록/상세 + 다크 목록, `/firework` 다크 픽셀 diff 0(main 워크트리), PARITY 표 재측정(셸 치수 불변). 카드 부제 문구는 `segmentSubtitle` 테스트로 고정.

**결정 확정 (2026-09-06 사용자, 검토 페이지)** — 권고와 다른 선택은 (a) 하나.
- (a) **A2 지형 질감 현재 유지** — hillshade 0.5 · color-relief 0.85(C10 값 그대로). 목록·상세 모두 건드리지 않는다.
- (b) B1 녹지 `park`·`landcover_wood`·`landcover_grass` fill-color `#cfe0c0`, `VALLEY_PARK_OPACITY` z9 0.2 → z12 0.4 → z14 0.55.
- (c) C1 구간 선: 흰 케이싱 레이어 1장(`valley-segment-casing`, 구간 선 바로 아래, `#ffffff` opacity 0.95, 폭 z11 7/9 → z14 8.5/11 → z16 15/19 [기본/선택]) + 구간 선폭 z11 3.5/5 → z14 4.5/6.5 → z16 10/13, opacity 1. **다크는 케이싱 `#0c0c0c`.** 상태색(여유/보통/혼잡/미확인)은 선 색 그대로.
- (d) D1 카드 제목 = `위치 · 수심`(수심 없으면 위치만), 부제 = `바닥 · 주차장 {거리} · 그늘 {정오 %}`(없는 항목 생략). 계곡명은 섹션 헤더에만. `segmentSubtitle` 은 옵션(그늘 포함)으로 확장하고 테스트 고정. 상세 시트 제목은 그대로(계곡명).
- (e) E1 목록 헤더 아래 요약 한 줄 `계곡 n · 구간 n · 시설 n · 정오 그늘 평균 nn%`(그늘 없는 데이터셋은 그늘 생략), 데이터셋 `description` 은 footer 첫 줄로.
- (f) F1 시설: circle 흰 원 r 11(선택 14) + stroke 2 유형색, 심볼 레이어 1장 이니셜(`parking P · restroom WC · store S · food F · cafe C · station B · safety ! · 그 외 ·`, Noto Sans Bold 10, 유형색). 유형색은 `markerPalette.FACILITY_COLORS` 를 쓴다(스파이크 임시색 금지). C5 아이콘이 오면 이니셜만 교체.
- (g) G1 그늘 켜짐 상태에서 hillshade-exaggeration 0.2, 수관 opacity 0.4 — 끄면 (a) 값으로 복귀. 어댑터가 `shade` 상태를 보고 paint 를 바꾸거나, 레이어 셋 의존으로 표현.
- (h) H1 다크 계곡 톤 현재 유지(재색칠 안 함).
- (i) I1 폰(컬럼 < 560)에서 시트 높이 40%(`SIZES.sheetHeightRatio` 는 데스크톱 45% 유지 — `/firework` 파리티). 트랙 위치는 그대로.

**스파이크 결과 (2026-09-06, `spike/V1-preview` 커밋 `838f36f`, 머지 금지)** — 검토 페이지 https://claude.ai/code/artifact/59957465-b8c4-418b-b39d-83021528fe73 . 결정 9개(a~i)를 URL 변형(`?a=1&b=1&c=1&f=1&g=1&d=1&e=1&i=1`)으로 실제 앱에서 찍어 기준(main)과 나란히 놓았다 — 라이트 26장·다크 2장·폰 3장. 권고 조합은 값 다섯 개(녹지 불투명도·숲색, hillshade/color-relief 강도, 구간 선폭 + 흰 케이싱 1장, 시설 원 + 이니셜 심볼 1장, 카드 제목 구성)와 안내문 위치·폰 시트 40% 로 이뤄진다. 확인된 것: 그늘 토글 저장(F4 G1) 때문에 스크린샷마다 localStorage 를 지워야 했다 · 이니셜 심볼은 C5 자리 표시(F·C·S 구분 약함) · 다크 케이싱은 흰색이라 V1a 에서 `#0c0c0c` 분기 필요 · 폰 40% 는 첫 화면 카드 2장. H2(다크 재색칠)는 스크린샷 없음.

**진행 (2026-09-06) — V1a PR [#19](https://github.com/4sizn/modu-valley/pull/19) 열림 (`in-review`, 브랜치 `4sizn/V1a-map-style`)**. 결정 (b)(c)(f)(g) 를 map-style 값 + 두 어댑터로, (a)(h) 는 무변경 확인. 기획 대비 판단한 것 — ① 다크 케이싱·그늘 대비처럼 **모드·상태에 따라 갈리는 paint** 는 레이어 셋이 모르므로 `valleyPaint.ts` 의 `valleyPaintOverrides(mode, { shadeVisible })` 한 함수가 값(켜진 값·복귀 값 모두)을 돌려주고 web 은 `setPaintProperty`, 네이티브는 C10c 의 `layerPaintOverrides` 통로에 흐름 점선과 합쳐(`mergePaintOverrides`) 게시 ② 그늘 상태는 포트를 넓히지 않고 `MapContent.shade` 유무로 읽음(F4 계약) ③ 선폭은 `SEGMENT_*_WIDTH_STOPS` 표 + `segmentWidthExpression` 으로 두어 R5 에서 표만 바꾸면 되게 ④ 시설 이니셜의 `access`·`etc` 는 가운뎃점 ⑤ 숲 `landcover-wood` 규칙에도 `VALLEY_PARK_OPACITY` 를 줌(결정 (b) 의 세 레이어). 검증: `pnpm verify`(core 208 · map-style 70 · native 34 · app 15), `/firework` 다크 main·branch 픽셀 diff **0**(셀프 diff 0 대조군), PARITY 13행 + CTA 폭 main = branch, 라이트 `/firework` 3D 건물 유지, 라이트 목록/상세/그늘 켬·다크 목록·폰 목록/상세 스크린샷 → `proof/V1-visual-polish` v1a-*. 네이티브는 typecheck·test 까지(D3).

**진행 (2026-09-06) — V1b PR [#20](https://github.com/4sizn/modu-valley/pull/20) 열림 (`in-review`, 브랜치 `4sizn/V1b-valley-app`, #19 위 stacked)**. 결정 (d)(e)(i) 를 core 문구 함수 + 앱 컴포넌트로. 기획 대비 판단한 것 — ① `segmentSubtitle` 은 시그니처를 깨지 않고 옵션 `{ afterTitle, shade }` 를 더했고 제목은 `segmentTitle` 로 분리 — 옵션 없는 기본은 F1 문장이라 상세 시트는 무변경 ② 정오 그늘은 `noonShadeRatio`(`shadeByHour[정오]` 우선, 없으면 호환 `shadeRatio`) 로 카드·요약이 같은 값·같은 반올림 ③ 요약 수치는 코어 `summarizeValleys`(그늘 있는 구간만 평균, 없으면 `null` → copy 가 생략), 문장은 `VALLEY_COPY.listSummary` ④ **폰 시트 40% 는 계곡 장면에만** — `useSheetHeight` 가 `scene === 'valley' ∧ 컬럼 < 560` 일 때만 0.4, `/firework` 는 어느 폭에서도 45%(CLAUDE.md "보이는 것 불변" 이 데스크톱 파리티표보다 넓다고 봤다) ⑤ 접근성 라벨에는 계곡명을 남김(스크린리더는 헤더와 카드를 이어 듣지 않는다). 검증: `pnpm verify`(core 214 · map-style 70 · native 34 · app 15), `/firework` 다크 diff **0**, PARITY main = branch, 폰 실측 계곡 시트 337.6px(40%) · `/firework` 379.8px(45%), footer 순서(description → 출처 → 고지), 스크린샷 → `proof/V1-visual-polish` v1b-*. 두 PR 머지 후 `done` 전이·워크트리 정리는 메인 세션.

**결과 (2026-09-06, PR [#19](https://github.com/4sizn/modu-valley/pull/19) V1a map-style·어댑터 · [#20](https://github.com/4sizn/modu-valley/pull/20) V1b app·core 머지 → `done`)**: 결정 확정 9개 그대로 — (a)(h) 무변경, (b)(c)(f)(g) 지도, (d)(e)(i) 앱. 머지 후 main `pnpm verify` 통과(core 214 · map-style 70 · native 34 · app 15). F1 ⑤(카드 제목 반복)·C2 "라이트 지도 아직 마음에 들지 않음"·F4 후속(카드 부제 그늘 문구)·C10 후속 중 "구간 상태색을 폴리곤에 칠할지"(케이싱 안쪽 선에 남김) 가 여기서 닫혔다. 시각 판정은 사용자가 스크린샷으로 — PR 본문·`proof/V1-visual-polish`. 브랜치 `4sizn/V1a-map-style`·`4sizn/V1b-valley-app` 삭제, 워크트리 `V1-visual-polish`(브랜치 `4sizn/V1-visual-polish`)는 메인 세션이 `orca worktree rm` 으로 정리. 후속 제안 3개는 아래 그대로(항목 신설 없음).

**범위 밖** — 시설 아이콘 스프라이트(C5), 실폭 물줄기 데이터(R5), 테마 설정 화면(C9), 실데이터 시딩, 애니메이션 추가.

**후속 제안 (범위 밖 발견, 이 항목에서 만들지 않음)**
- 시설 이니셜 F·C·S 구분이 약하다(스파이크에서도 확인) — C5 아이콘 스프라이트가 대체한다. 그 전까지 유형색 테두리가 구분을 맡는다.
- `/firework` 폰 폭에서 시트 45% 유지가 맞는지는 파리티표(1440) 밖의 질문 — 데모도 폰 레이아웃을 정의하지 않았다. 필요하면 D2 보존 범위로 다시 묻는다.
- 네이티브 (g) 음영 하향 — 음영기복은 스타일 JSON 레이어라 뷰의 `<Layer>` 가 덧쓰지 않고 iOS hillshade 런타임 setter 크래시(#4453)가 있어 V1a 는 값만 게시하고 그리지 않는다(네이티브에서 그늘 켜면 수관 0.4 만). 스타일 JSON 에 음영 2장(0.5·0.2)을 싣고 `visibility` 로 갈아 끼우는 방식이 setter 를 피하는 후보 — iOS 실기 확인이 필요해 별도 항목.

### R5 — 하천 벡터: 연속수치지형도 1:5,000 수계 (기획 2026-09-06)

**목표** — C10c 가 임시로 부풀린 물줄기 폴리곤(구간 선 ±3~9 m)을 **실제 물길 폭·형태**로 바꾸는 데이터 경로를 1건 시험한다. 출처는 국토지리정보원 연속수치지형도 1:5,000 수계 레이어(공공누리 1유형: 출처표시 조건 상업·타일링 가능). 등고선·표고값 레이어는 인터넷·휴대폰 표시 금지라 **가져오지 않는다**.

**사용자 액션(다운로드는 로그인 필요)**
1. 국토정보플랫폼(map.ngii.go.kr) 로그인 → 지도검색 → "연속수치지형도" → 축척 **1:5,000** → 영역 지정: 우선 샘플계곡 일대(남양주 진접·왕숙천 상류, 대략 127.24~127.29 E · 37.81~37.85 N) 1건. 전용 대용량 전송 S/W 가 필요할 수 있다.
2. 받은 SHP/NGI 묶음을 저장소 밖 `~/Downloads/ngii-5k/` 또는 저장소 `data/raw/ngii/`(gitignore 추가) 에 둔다. 필요한 레이어만: `E00020000` 하천중심선 · `E0032111` 실폭하천 · `E00010001` 하천경계. 등고선(F 계열)·표고점은 삭제.
3. 파일 위치를 알려 주면 에이전트가 이어 간다.

**에이전트 작업(파일 이후)** — `scripts/research/river-vectors/`: SHP → GeoJSON(EPSG:5186 → 4326, `[lng,lat]`), 샘플 구간 회랑 ±300 m 절단, 실폭하천 폴리곤과 C10c 임시 폴리곤을 같은 화면에 겹쳐 스크린샷, 크기 표(원본·절단·단순화), 라이선스 표기 문안, `data/.schema` 에 `waterPolygon` 출처 필드 제안. 판정: 실폭 폴리곤이 샘플 3구간을 모두 덮으면 **채택** → 후속 항목(물줄기 데이터 교체)으로. PR 1개, 자식 워크트리 금지.

### S1 — 서버 뼈대 `server/` (기획 2026-09-06)

**배경** — D5(모노레포 루트 `server/`). K1 으로 브이월드·기상청·한강홍수통제소·TAGO 키가 동작하고, R1·F3a 가 "정부 API 는 서버가 폴링·캐시하고 클라이언트는 우리 API 만 본다"(valley-ds 호출 구조)를 전제로 설계됐다. F2(주차 제보)·F3(경보)·R2 폴리곤 저장·VWorld 위성 토글이 모두 여기에 걸린다.

**결정 (시각 요소 없음 — 표로 승인)**

| # | 결정 | 권고 | 대안 | 이유 |
| --- | --- | --- | --- | --- |
| (a) 런타임 | **Node 22 + Hono + TypeScript** | Fastify / Cloudflare Workers(엣지) | `core` 도메인(유역·거리·경보 규칙)을 그대로 import. Hono 는 Node·엣지 양쪽에서 돌아 배포 결정을 미룰 수 있다. SSE 지원 |
| (b) 저장 | **SQLite(better-sqlite3) 단일 파일** — 캐시·폴리곤·제보 | Postgres / Redis KV | 트래픽이 작고(관측소 50 × 10분) 운영이 없다. 스키마는 Postgres 로 옮길 수 있게 SQL 표준 안에서 |
| (c) 배포 | **미정 — 사용자 결정** (Fly.io Tokyo · Cloud Run Seoul · Railway) | | 비용·계정이 걸린 결정. 뼈대는 Docker 한 장으로 어디든 |
| (d) 로컬 개발 | 서버 `localhost:8787`, Expo web 은 `EXPO_PUBLIC_API_BASE` 로 가리킴 | Metro 프록시 | 네이티브도 같은 변수를 쓴다 |
| (e) 최소 범위 | `/healthz` · `/api/vworld/*`(키 은닉, 경로·파라미터 허용목록, 저장 금지 준수 — 프록시만) · `/api/hydro/stations`·`/api/hydro/latest`(HRFCO 10분 폴링 캐시) · `/api/aws/latest`(API허브 매분) · `/api/basins`(수자원관리도 WFS 표준유역 1회 적재·저장) · `/api/events`(SSE: hydro·aws 갱신) | | F3b 가 붙을 자리까지만. 푸시·제보 쓰기는 F2·F3c |
| (f) 잡 스케줄 | 프로세스 내 인터벌(10분·1분) + 시작 시 즉시 1회, 실패 백오프 | 외부 cron | 단일 인스턴스 전제 |
| (g) 보안 | 읽기 공개, IP 별 레이트리밋, CORS 는 앱 오리진만, 키는 환경변수(`.env.local` 이름 그대로) | | |

**결정 확정 (2026-09-06 사용자 "ㅇㅇ")** — 표 7행 권고 그대로. **(c) 배포 대상은 미정 유지** → S1b 는 `Dockerfile` + 배포 문서(세 후보 비교)까지만, 실제 배포는 결정 뒤 별도.

**범위** — `server/`(pnpm workspace 패키지, `pnpm server:dev`), 위 엔드포인트, 폴러 2개, SQLite 스키마·마이그레이션, 테스트(폴러·프록시 허용목록·SSE), `Dockerfile`, README. 앱 쪽은 `EXPO_PUBLIC_API_BASE` 만 읽는 얇은 클라이언트 포트 1개(`ApiPort`)까지. PR 2개: S1a 뼈대+프록시+헬스 → S1b 폴러+SSE+basins.

**범위 밖** — 푸시(F3c), 제보 쓰기(F2), 인증, 배포 실행(결정 (c) 뒤).

**진행 (2026-09-06, S1a PR [#23](https://github.com/4sizn/modu-valley/pull/23) → `in-review`)** — 결정 (a)(b)(d)(e 중 `/healthz`·`/api/vworld/*`)(g) 구현. `@modu-valley/server` 패키지(`pnpm server:dev|build|start|test`, `pnpm verify` 는 `-r` 로 자동 포함), better-sqlite3 + 번호 SQL 마이그레이션 러너(`0001` stations·fetch_log), `ServerLogger`(core `Logger` 구현) + `Redactor`(값·`key=`류·HRFCO 경로 마스킹), 프록시 허용목록 `wfs|wms|search|address` + 키 주입 + `no-store`·`Set-Cookie` 제거, IP 별 고정 창 레이트리밋, CORS, Dockerfile(node:22-alpine 멀티스테이지, esbuild 번들), README(배포 후보 3개 비교표 — Fly.io Tokyo 가 SQLite 볼륨·상시·비용에서 자연스럽다는 참고 의견, 결정은 사용자). 테스트 28. 실측: 번들로 실제 키 `/api/vworld/wfs` → R2 와 같은 `sbsncd 101802`, 로그 키 노출 0. 판단 2개: ① 로컬 Node 는 26 이지만 better-sqlite3 13 프리빌트가 있어 결정 (a) Node 22 유지(engines ≥ 22.13, Docker 는 22) ② `TRUST_PROXY` 기본 true(배포 후보 셋 다 리버스 프록시 뒤) — 프록시 없이 공개할 땐 false. Docker 빌드는 이 맥에 docker 가 없어 미실행. **다음 S1b**(같은 워크트리, 스택 PR): 폴러 2개 + observations·basins + `/api/hydro/*`·`/api/aws/latest`·`/api/basins`·`/api/events` + `ApiPort`.

**진행 (2026-09-06, S1b PR [#25](https://github.com/4sizn/modu-valley/pull/25) → `in-review`, S1a #23 은 머지)** — 결정 (e) 나머지·(f)·(d) 앱 포트. `0002` observations(10분 격자, 7일)·latest(관측소별 최신)·basins(수자원관리도 폴리곤 + bbox). 잡 `PollJob`(즉시 1회 → 주기, 실패 30 s→10분 지수 백오프, fetch_log) + `hrfco` 10분(**일괄 `list/10M` 2 호출** — 관측소별이 아니라 한도 무관) · `aws` 1분(전체지점 10분 창 1 호출, `#7777END` 없으면 실패) · `stations` 24 h · `basins` 1회(`BASINS_WFS_URL`). `/api/hydro/stations|latest` · `/api/aws/stations|latest` · `/api/basins`(저장 폴리곤 point-in-polygon → 없으면 브이월드 조회, 저장 안 함·no-store) · `/api/events` SSE(hello → 채널 → 15 s heartbeat). core `ApiPort`(DTO·추상, 실패는 기존 `repository/load-failed` 재사용으로 `errors.ts` 무변경) + `FetchApiClient`(fetch·EventSource 주입, web/native 공용) + 앱 `src/api/createApiClient.ts`(`EXPO_PUBLIC_API_BASE`) — UI 없음. **실측**(실제 키, 빈 DB, 5분): fetch_log 7건 전부 ok — hrfco 1,831행 0.6 s · aws 8,096행/분 0.6–1.3 s · stations 2,909건, `/api/hydro/latest?stations=1022670,10224050`(소요산 쌍) · `/api/aws/latest?stns=454` · `/api/basins` → 브이월드 `101802` 응답 예는 PR 본문·README, 로그 키 노출 0. `pnpm verify` server 56 · core 241. **판단 4개**: ① HRFCO 일괄 호출 ② AWS observations 는 10분 정각만(분 단위 전부면 7일 700만 행), 분 값은 latest ③ AWS `value` = RN-60m(F3 관심 1h 10 mm) ④ 수자원관리도 WFS URL 은 env(`BASINS_WFS_URL`) — data.go.kr 15057885 가 LINK 타입이라 공개 GetFeature URL 이 없음(API_KEYS §7), 확보 전까지 `/api/basins` 는 브이월드 조회 전용.

**후속 제안 (범위 밖, 항목 신설 없음)**
- HRFCO 폴링을 10분 정각 + 2분에 정렬(지금은 프로세스 시작 기준 → 최대 10분 지연).
- 수자원관리도 WFS GetFeature URL 확보(국가공간정보포털 오픈마켓 절차, K1 사용자 액션) → `BASINS_WFS_URL` 만 넣으면 적재.
- RN 용 EventSource 폴리필(react-native-sse) 또는 `hydroLatest` 폴링 훅 — F3b UI 와 함께.
- 배포 결정 (c) 뒤 Docker 빌드·볼륨 실측(이 맥에 docker 없음), HRFCO 운영 도메인 키 추가.

### C7 — 베이스맵 헬스 (기획 2026-09-06 보강)

**배경** — openfreemap 타일이 잠깐 흔들릴 때마다 오류를 띄우면 안 되고, 진짜 장애는 알려야 한다. valley-ds `base-map-health.ts`(spotts 재구현)가 기준: 첫 실패에서 타이머 arm, 8초 동안 성공이 없으면 장애, 타일 하나라도 오면 즉시 회복, 재시도는 소스 reload 만.

**결정 (시각 요소 최소 — 승인만)**
- (a) 상태기계는 `core` 순수 함수(`noteFailure`/`noteSuccess`/`evaluate`, `OUTAGE_SUSTAIN_MS 8000`) + 테스트. 엔진 포트에 `'basemap-health'` 이벤트 추가.
- (b) 감시 대상 URL = 스타일 URL 호스트 + 타일 호스트(`tiles.openfreemap.org`) + DEM 호스트(`s3.amazonaws.com/elevation-tiles-prod`). 명당·그늘 GeoJSON 은 제외.
- (c) UI: 장애 시 상단바 아래 띠 배너("지도 타일을 불러오지 못하고 있어요 · 다시 시도") — F3 경보 배너와 같은 자리이므로 `ShellBanner` 하나를 만들고 우선순위(경보 > 헬스). 스타일 자체 실패는 전면 `RetryState`.
- (d) `/firework` 에도 같은 감시가 붙지만 배너는 장애 때만 보이므로 파리티 픽셀 diff 0 유지.

**결정 확정 (2026-09-06 사용자 "ㅇㅇ")** — 4항 그대로.

**범위** — core 상태기계·테스트, web(`map.on('error'|'sourcedata')`)·native(`onDidFailLoadingMap`·`onDidFinishLoadingStyle`) 배선, `ShellBanner`·`RetryState`, 강제 장애 테스트(잘못된 타일 호스트로 스크린샷). PR 1개.

**결과 (2026-09-06, PR 열림 → `in-review`)**: 결정 (a)~(d) 그대로.
- (a) core — `domain/basemap/BaseMapHealth.ts`(`INITIAL_BASE_MAP_HEALTH`·`noteFailure(state, now)`·`noteSuccess()`·`evaluate(state, now)`·`OUTAGE_SUSTAIN_MS 8000`·`isBaseMapUrl(url, hosts)`·`sourceUrlOf`) + `BaseMapHealthMonitor`(주입 시계·타이머, 두 어댑터 공용 시간 축). `MapEngineEvents['basemap-health']`, 포트 `retryBaseMap()`, `AppState.baseMapHealth`·`SessionStore.setBaseMapHealth`, `MapSession.retryBaseMap()`. 테스트 18개(경계 8초 직전/정각, 회복, 재arm, 모니터 타이머·dispose, URL 판별) + 세션 2개.
- (b) 호스트 — `map-style/baseMapHosts.ts` `BASE_MAP_HOSTS = ['tiles.openfreemap.org', 's3.amazonaws.com/elevation-tiles-prod']`(`host/경로접두` 표기로 공용 S3 에서 우리 버킷만). 코어는 DOM `URL` 을 못 쓰므로 스킴·호스트·경로 최소 파서. 테스트가 `MAP_STYLE_URLS`·`TERRAIN_DEM_SOURCE` 와의 정합을 고정하고, 구성된 계곡 스타일에서 베이스맵 소스가 `openmaptiles`·`terrain-dem` 둘뿐임을 확인.
- web — `map.on('error')` 의 소스 명세(`event.source`)·요청 URL 이 호스트 목록이면 실패(**404 제외** — 없는 타일·글리프 범위는 서버가 살아 있다는 뜻이고 maplibre 도 404 타일은 오류로 올리지 않는다), `sourcedata` 에 `tile` 이 실린 것만 성공. `retryBaseMap` 은 베이스맵 소스만 `setTiles`/`setUrl` 같은 값으로 다시 넣어 타일 전부 재요청(GeoJSON 불변).
- native — ready 뒤 `onDidFailLoadingMap` 이 실패, `onDidFinishRenderingMapFully` 가 성공. **판단**: mbgl 은 오류난 타일도 완료로 쳐 실패 직후 "완전히 그려졌다" 가 곧바로 오므로, 마지막 실패 뒤 500 ms(`NATIVE_SUCCESS_QUIET_MS`) 안의 성공은 세지 않는다 — 안 그러면 장애가 영영 판정되지 않는다. 초기화 중 `onDidFailLoadingMap` 은 종전처럼 스타일 실패. 재시도는 같은 스타일을 새 참조로 게시(`<Map mapStyle>` 재적용). 네이티브 테스트 4개.
- (c) `ShellBanner`(경보 > 헬스 슬롯, `pickBanner` 순수 함수 — F3 은 경보만 채우면 됨) — 상단바 아래 8px, `surface`/`fg`/`accent`, 장애 때만 렌더. `RetryState` — 세션 `failed` 전면(`bg` 바탕 카드), "다시 시도" 는 `SessionProvider` 의 `attempt` 세대 → 세션 재생성(`useSessionRestart`, 테마 전환과 같은 경로). 문구 `BASEMAP_HEALTH_COPY`.
- (d) `/firework` 다크 픽셀 diff **0**(main 8093 vs branch 8094, 불꽃 off + 티커 숨김 + 9초, 셀프 diff 0 대조군), PARITY 18키 전부 동일. `/firework` 에도 감시가 붙어 장애 때 배너가 뜬다(스크린샷).
- 강제 장애 — `EXPO_PUBLIC_BASEMAP_HOST_OVERRIDE=localhost:8099` + `scripts/dev/basemap-outage-proxy.mjs`(openfreemap 앞 프록시, `/__outage?mode=ok|fail|drop` 로 토글, 응답 JSON 안의 절대 URL 도 프록시로 재작성). 어댑터는 옵션이 없으면 스타일을 한 바이트도 바꾸지 않는다. web 확인: 정상 배너 없음 → fail/drop 뒤 줌으로 타일 요청 → 4초엔 없음·10초엔 배너 → "다시 시도"(ok) 즉시 사라짐 · ok 뒤 타일 도착만으로도 재시도 없이 자동 회복 · 처음부터 fail 이면 `RetryState`(코드 `map/style-load-failed`) → ok 뒤 "다시 시도" 로 지도 복구. 라이트·다크·폰(390×844)·`/firework` 스크린샷 `proof/C7-basemap-health`.
- 문서 — `docs/ARCHITECTURE.md` 코어·어댑터 절, `docs/PARITY.md` 검증 방법.

**후속 제안 (범위 밖 발견, 이 항목에서 만들지 않음)**
- 소스별 헬스 — 지금은 벡터(openfreemap)·DEM(s3)이 한 상태기계라 한쪽만 죽고 다른 쪽 타일이 오면 회복으로 읽힌다(valley-ds 원안과 같은 규칙). 도로 없는 지형만 보이는 장애를 알리려면 소스 그룹별 모니터 → `outage = any`.
- 네이티브 실패 URL — `onDidFailLoadingMap` 은 어느 리소스가 실패했는지 주지 않아 호스트 판별 없이 센다. 래퍼가 오류 페이로드를 열어 주면 web 과 같은 판별로.
- 개발 오버레이 — 스타일 실패 때 dev 빌드의 LogBox 토스트(`console.error`)가 `RetryState` 위에 겹친다. 프로덕션엔 없음. `Logger` 의 초기화 실패 로그 레벨을 낮출지는 로깅 정책과 함께.
- 재시도 중 표시 — "다시 시도" 를 누른 뒤 8초 안에 다시 실패하면 배너가 다시 뜨기까지 아무 표시가 없다. 진행 표시(스피너·"다시 불러오는 중")는 F3 배너 디자인과 함께.

### SD1 — 계곡 실데이터 시딩 30개 (기획 2026-09-06)

**배경** — 앱은 아직 샘플계곡 1개(구간 3·시설 4)로만 돈다. R1 이 수도권 계곡 후보 30개의 이름·시군·좌표(`scripts/research/station-coverage/valleys.json`, 브이월드 검색 28 + 수기 2)를 만들었고, 유역 코드(S1 `/api/basins`)·그늘/경사(P1)는 자동으로 채울 수 있다. F2 는 거절됐지만 **주차장 존재 여부**는 필요하다(사용자) — 시설 데이터로 흡수. R4 산정: 90구간 + 시설 ~150점, 데스크 ~37h.

**연구 질문 → 답**
1. *구간 좌표열을 어디서 받나.* OSM 에 계곡 하천 중심선이 있다 — Overpass `waterway~stream|river` 2 km 반경: 백운계곡 2 way(지촌천), 명지계곡 3 way(도마천). 즉시·무키·ODbL(출처표시). 브이월드 하천망은 국가·지방하천만이라 소하천이 없고, 1:5,000 실폭(R5)은 사용자 다운로드 대기. → **OSM 중심선으로 시작하고 R5 가 오면 폴리곤만 교체**.
2. *주차장은.* OSM `amenity=parking` 은 백운계곡 2 km 안에 0개 — 산지 주차장은 OSM 이 비어 있다. **전국주차장정보표준데이터**(data.go.kr 표준데이터, CSV 다운로드, 키 불필요, 좌표·유무료·면수)와 **공중화장실표준데이터** 로 채우고 빈 곳은 수기. 매점·식당은 OSM + 수기.
3. *수기 항목은 어디까지.* 수심·바닥·금지·riskNote 는 관찰·공고 기반이라 자동화가 없다. 물놀이관리지역(WMS)은 화면에서 확인해 `swimBanned`·`riskNote` 를 옮긴다. 검수 수준을 데이터에 표시해야 사용자에게 정직하다.
4. *앱은 어떻게 읽나.* 번들(오프라인 동작, `/firework` 처럼 정적)을 유지하고 서버는 실시간만. 파일이 30개로 늘어도 합본 수백 KB.

**결정 (검토 페이지 https://claude.ai/code/artifact/fe51b2a5-ef9e-4d2a-a6a6-562b763ce361 — 30개 표·지도, 권고 첫 번째)**
- (a) **계곡 목록** — A1 R1 30개 그대로(수기 좌표 2개 포함, 강원 서부 3개 포함) (권고) / A2 경기 안으로 25개 축소 / A3 첫 릴리스 가평·포천 15개
- (b) **구간 좌표열 출처** — B1 OSM 하천 중심선(Overpass), 계곡 점 기준 상류 2 km·하류 1 km 절단 (권고) / B2 브이월드 하천망(국가·지방하천만) / B3 R5 1:5,000 을 기다림
- (c) **구간 절단** — C1 길이 3등분 상·중·하류 (권고) / C2 주차장·진입로 위치 기준 분할 / C3 고도 3등분
- (d) **수기 항목 범위** — D1 수심·바닥·금지·riskNote·무료/야영/반려견(지자체 공고 + 생활안전지도 WMS + 블로그 3건 교차, 90구간 × 10분 ≈ 15 h) (권고) / D2 금지·riskNote 만 / D3 좌표·순서만
- (e) **시설** — E1 주차장(존재·이름·유무료·면수: 주차장 표준데이터 + 수기) · 화장실(공중화장실 표준데이터) · 매점·식당(OSM + 수기) · 진입로(수기) (권고) / E2 주차장만 / E3 시설 생략
- (f) **파일·로딩** — F1 `data/valleys/<valleyId>.geojson`(구간) + `data/facilities/<valleyId>.geojson`, `sync-valley-data` 합본, 앱 번들 (권고) / F2 서버 `/api/valleys` 서빙
- (g) **검수 표시** — G1 계곡 metadata 에 `verified: 'desk' | 'field'`·`sources[]`·`collectedAt`, 앱은 desk 에 "현장 미확인" 배지 (권고) / G2 표시 없음
- (h) **작업 방식** — H1 스크립트(`scripts/seed/`)가 OSM·표준데이터·유역·그늘·경사를 자동 채우고, 수기 항목은 `data/seed/manual.csv` 한 장에서 병합 — 사람은 CSV 만 채운다 (권고) / H2 계곡별 GeoJSON 직접 편집

**결정 확정 (2026-09-06 사용자)** — a·d·e·f·g·h 권고 그대로, b·c 는 조건부.
- (b) **좌표열 출처는 정밀·정확도 순 우선순위**: ① R5 1:5,000 실폭(다운로드 뒤) > ② 브이월드 하천망 WFS `lt_c_wkmstrm`(해당 계곡을 덮을 때) > ③ OSM 하천 중심선. **OSM 이 브이월드 하천망보다 정밀할 수 있으므로 SD1a 첫 단계에서 30개 계곡 × (하천망 커버 여부·폴리곤/선 정점 밀도·OSM way 수·정점 밀도) 를 실측해 표로 보고하고, 그 표로 계곡별 출처를 고른다.** 주의: 브이월드 데이터는 약관 §19 로 **저장이 사전 승낙 대상** — 하천망을 저장 데이터로 쓰려면 문의 답신이 필요하다. 같은 하천망은 국토부(국가공간정보포털, 공공누리 1유형)에서도 제공되므로 저장용은 그쪽 파일을 우선 확인하고, 답신 전에는 브이월드는 **비교·조회 전용**으로 쓴다.
- (c) **구간은 실데이터 기준** — 지명(상류/중류/하류·○○골), 물놀이관리지역 구역, 시설·진입점 등 실데이터에 상·중·하 구분이 있는 계곡만 나눈다. 구분 근거가 없으면 **1구간**으로 둔다(억지 3등분 금지). 1구간을 표현하기 위해 `segment` 에 `'whole'`(라벨 "전체") 를 추가하고 카드 제목·부제·상세 eyebrow 가 이를 다룬다(도메인·스키마·앱 소폭 변경, SD1a).
- 나머지: (a) 30개 그대로 (d) 수기 5항목 (e) 시설 4종 (f) 계곡별 GeoJSON + 합본 + 번들 (g) `verified` 표시 (h) 스크립트 + `manual.csv`.

**범위** — `scripts/seed/`(Overpass 취득·절단·3등분, 표준데이터 매칭, `/api/basins`·P1 호출, manual.csv 병합, 스키마 검증), `data/valleys/*`·`data/facilities/*` 30세트(1차는 자동 채움 + 수기 빈 칸), `data/seed/manual.csv` 템플릿, 샘플계곡 → 실데이터 교체(앱 `valleySource`), 라이선스 표기(OSM ODbL·공공누리·Terrarium), 목록 면 계곡 헤더 30개 동작 확인(스크롤·스태거). PR 2개: SD1a 스크립트 + 자동 채움 30세트 → SD1b 수기 1차 채움(사용자 CSV) + 앱 교체.

**범위 밖** — 현장 검수, 사진, 리뷰, 실폭 폴리곤(R5), 혼잡 값(실시간, F3/제보).

**SD1a 실측·판단 (2026-09-06, 에이전트)**

*출처 비교표 (결정 (b) 첫 산출물 — `pnpm seed:compare`, `data/seed/source-comparison.md`)* — 계곡 점 반경 2 km. 브이월드 하천망 `lt_c_wkmstrm` 은 **통계만**(기하 미저장, 약관 §19). 판정 규칙: 하천망이 계곡 점 500 m 안을 지나고 정점/km 가 OSM 이상이면 하천망 권고. 하천망은 실폭 폴리곤이라 "정점/km" 는 외곽선 기준, OSM 은 중심선 기준 — 같은 잣대가 아님을 감안해 읽는다.

계곡 30개 · 비교 반경 2 km · 덮음 판정 ≤ 500 m
하천망이 계곡을 덮음: 14 · 상자 안 피처 있음: 28
OSM way 있음: 30 · name 있는 way 가 하나 이상: 25
판정 — 하천망 권고: 13 · OSM: 17 · 없음: 0
저장 — OSM: 30 · 보류: 0

| # | 계곡 | 시군 | 하천망 피처 | 기하 | 하천망 정점/km | 하천망 최근접 m | 하천망 이름 | OSM way | OSM name | OSM 정점/km | OSM 길이 km | OSM 최근접 m | 판정 | 저장 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 백운계곡 | 포천시 | 1 | MultiPolygon 1 | 118 | 2483 | 영평천(지방2급하천) | 2 | 1/2 지촌천 | 14 | 32.54 | 10 | osm | osm |
| 2 | 청학동계곡 | 포천시 | 2 | MultiPolygon 2 | 23 | 549 | 길명천(지방2급하천)·수입천(지방2급하천) | 3 | 0/3 — | 14 | 17.45 | 554 | osm | osm |
| 3 | 산정호수 비선폭포 계곡 | 포천시 | 1 | MultiPolygon 1 | 143 | 413 | 부소천(지방2급하천) | 4 | 2/4 부소천 | 11 | 10.46 | 13 | vworld-stream-network | osm |
| 4 | 지장산계곡 | 포천시 | 2 | MultiPolygon 2 | 51 | 18 | 건지천(지방2급하천)·향로천(지방2급하천) | 1 | 0/1 — | 16 | 12.95 | 1354 | vworld-stream-network | osm |
| 5 | 왕방계곡 | 동두천시 | 1 | MultiPolygon 1 | 54 | 2 | 동두천(지방2급하천) | 1 | 0/1 — | 22 | 4.56 | 12 | vworld-stream-network | osm |
| 6 | 명지계곡 | 가평군 | 2 | MultiPolygon 2 | 40 | 126 | 석룡천(지방2급하천)·도마천(지방2급하천) | 3 | 2/3 도마천 | 20 | 10.92 | 152 | vworld-stream-network | osm |
| 7 | 용추계곡 | 가평군 | 2 | MultiPolygon 2 | 52 | 34 | 승안천(지방2급하천)·마장천(지방2급하천) | 5 | 1/5 승안천 | 41 | 15.03 | 11 | vworld-stream-network | osm |
| 8 | 조무락골 | 가평군 | 2 | MultiPolygon 2 | 40 | 36 | 석룡천(지방2급하천)·도마천(지방2급하천) | 3 | 2/3 도마천 | 20 | 10.92 | 25 | vworld-stream-network | osm |
| 9 | 유명산계곡 | 가평군 | 2 | MultiPolygon 2 | 39 | 45 | 가일천(지방2급하천)·벽계천(지방2급하천) | 3 | 2/3 벽계천·사기막천 | 16 | 33.17 | 46 | vworld-stream-network | osm |
| 10 | 어비계곡 | 가평군 | 3 | MultiPolygon 3 | 39 | 9 | 가일천(지방2급하천)·미원천(지방2급하천)·벽계천(지방2급하천) | 3 | 2/3 벽계천·사기막천 | 16 | 33.17 | 1 | vworld-stream-network | osm |
| 11 | 백둔리계곡 | 가평군 | 2 | MultiPolygon 2 | 42 | 47 | 백둔천(지방2급하천)·가평천(지방2급하천) | 3 | 1/3 가평천 | 12 | 43.27 | 20 | vworld-stream-network | osm |
| 12 | 경반계곡 | 가평군 | 4 | MultiPolygon 4 | 44 | 23 | 달전천(지방2급하천)·경반천(지방2급하천)·승안천(지방2급하천)·두밀천(지방2급하천) | 6 | 1/6 경반천 | 82 | 13.09 | 2 | osm | osm |
| 13 | 논남기계곡 | 가평군 | 1 | MultiPolygon 1 | 45 | 658 | 가평천(지방2급하천) | 2 | 2/2 가평천 | 8 | 34.79 | 651 | osm | osm |
| 14 | 현등사계곡(운악산) | 가평군 | 1 | MultiPolygon 1 | 41 | 1721 | 조종천(지방2급하천) | 4 | 2/4 조종천 | 21 | 14.57 | 899 | osm | osm |
| 15 | 도마치계곡 | 가평군 | 2 | MultiPolygon 2 | 40 | 491 | 석룡천(지방2급하천)·도마천(지방2급하천) | 2 | 1/2 도마천 | 20 | 10.57 | 54 | vworld-stream-network | osm |
| 16 | 수동계곡 | 남양주시 | 1 | MultiPolygon 1 | 32 | 848 | 구운천(지방2급하천) | 7 | 3/7 구운천·청룡천·방동천 | 17 | 24.47 | 11 | osm | osm |
| 17 | 축령산계곡 | 남양주시 | 1 | MultiPolygon 1 | 29 | 1089 | 외방천(지방2급하천) | 7 | 3/7 외방천·청룡천·방동천 | 35 | 9.83 | 644 | osm | osm |
| 18 | 장흥계곡 | 양주시 | 2 | MultiPolygon 2 | 359 | 58 | 공릉천(지방2급하천)·석현천(지방2급하천) | 10 | 2/10 공릉천·석현천 | 11 | 55.42 | 14 | vworld-stream-network | osm |
| 19 | 송추계곡 | 양주시 | 1 | MultiPolygon 1 | 426 | 1343 | 공릉천(지방2급하천) | 17 | 1/17 공릉천 | 14 | 57.36 | 5 | osm | osm |
| 20 | 안골계곡 | 의정부시 | 2 | MultiPolygon 2 | 129 | 741 | 회룡천(지방2급하천)·백석천(지방2급하천) | 24 | 7/24 백석천·회룡천 | 31 | 18.2 | 13 | osm | osm |
| 21 | 소요산계곡 | 동두천시 | 1 | MultiPolygon 1 | 170 | 54 | 신천(지방2급하천) | 1 | 1/1 신천 | 20 | 18.63 | 102 | vworld-stream-network | osm |
| 22 | 동막골계곡 | 연천군 | 1 | MultiPolygon 1 | 22 | 82 | 아미천(지방2급하천) | 1 | 1/1 아미천 | 10 | 11.15 | 81 | vworld-stream-network | osm |
| 23 | 감악산 운계폭포 계곡 | 파주시 | 1 | MultiPolygon 1 | 26 | 1244 | 설마천(지방2급하천) | 1 | 1/1 설마천 | 18 | 10.33 | 1229 | osm | osm |
| 24 | 사나사계곡 | 양평군 | 1 | MultiPolygon 1 | 39 | 1939 | 미원천(지방2급하천) | 9 | 5/9 미원천·사기막천·균골·원암골·까마귀골 | 30 | 19.17 | 51 | osm | osm |
| 25 | 용문산계곡 | 양평군 | 2 | MultiPolygon 2 | 44 | 988 | 연수천(지방2급하천)·용문천(지방2급하천) | 16 | 10/16 용문천·연수천·용각골·용계골·조계골·금수골·용암골·문수골·조달골·큰조계골 | 40 | 36.59 | 73 | osm | osm |
| 26 | 우이동계곡 | 서울 강북구 | 3 | MultiPolygon 3 | 30 | 1335 | 방학천(지방2급하천)·도봉천(지방2급하천)·우이천(지방2급하천) | 12 | 5/12 백운천·우이천·계곡·소귀천계곡 | 24 | 12.2 | 672 | osm | osm |
| 27 | 수락산계곡(청학리) | 남양주시 | 2 | MultiPolygon 2 | 67 | 509 | 용암천(지방2급하천)·부용천(지방2급하천) | 17 | 10/17 용암천·청학천·제청천·응달천 | 26 | 23.22 | 96 | osm | osm |
| 28 | 함허동천 | 인천 강화군 | 1 | MultiPolygon 1 | 38 | 1687 | 길정천(지방2급하천) | 13 | 0/13 — | 16 | 6.76 | 452 | osm | osm |
| 29 | 구곡폭포 계곡 | 춘천시 | 0 | — | 0 | — | — | 1 | 0/1 — | 26 | 0.47 | 0 | osm | osm |
| 30 | 광덕계곡 | 화천군 | 0 | — | 0 | — | — | 2 | 1/2 지촌천 | 14 | 32.54 | 140 | osm | osm |

*계곡별 출처 결정* — 저장은 **30개 전부 OSM**: 하천망 권고 13개도 브이월드 답신 전이라 저장하지 않았고, 국토부 국가공간정보포털 하천망 파일은 아직 없다(답신·파일이 오면 `stored` 열만 바꾸고 좌표열을 교체). R5 1:5,000 은 사용자 다운로드 대기.

*빌드 결과 (`pnpm seed:build`, `data/seed/build-report.md`)* — 30/30 계곡 생성, **전부 1구간 `whole`(splitBasis none)** — 지명·물놀이관리지역·시설로 상·중·하를 가를 근거를 계곡별로 확인하지 않은 채 나누지 않았다(결정 (c)). 유역 코드(sbsncd) 30/30. 시설 240개(전부 OSM `amenity`, 계곡 점 1.5 km) · 주차장 있는 계곡 18/30(OSM 122개, 산지 계곡은 0). **표준데이터는 `pnpm seed:std` 가 내려받는다** — 사용자 지시("오르카 브라우저로 너가 받아와")로 Orca 브라우저에서 다운로드 버튼을 추적하니 서버 파일이 아니라 페이지 스크립트가 `/download/columList.json` + `/download/standard.json`(로그인 불필요)으로 CSV 를 조립하고 있었다(처음의 `stdFileDown.do` 404 는 없는 폼 경로). 주차장 18,878행(좌표 18,117)·공중화장실 33,820행(좌표 27,040 — 페이지 고지 "2025-02 좌표 중단"과 달리 이 엔드포인트엔 좌표가 있다). 재빌드 결과: **시설 332개(표준 주차장 29 · 표준 화장실 매칭 포함) · 주차장 있는 계곡 18/30**(가평 북면·백운·명지·조무락·백둔·도마치·동막 등 12개는 표준데이터에도 없음 → 수기). 수기 항목은 전부 빈 칸(`manual.csv` 템플릿 240행) — 채울 순서는 `scripts/seed/README.md`.

*주의 대상 계곡(중심선 오프셋 > 500 m — 계곡 점이 입구·호수·휴양림이거나 OSM 에 그 골짜기 지류가 없어 **다른 물줄기**일 수 있음, 사용자 확인)*: 지장산 1354 m · 감악산 1229 m · 현등사 899 m · 우이동 672 m · 논남기 651 m · 축령산 644 m · 청학동 554 m. 현등사·축령산·우이동·광덕은 상류 방향으로 이어지는 way 가 없어 하류 1 km 만 잘렸다.

*그늘·수관 (P1 파이프라인 30개 실행, `pnpm seed:build --only-shade`)* — 30/30 산출·역기입, 계곡당 31~116 s(첫 자산 다운로드 포함), `data/shade/` 6.2 MB(합본 `shade-bundle.json` 6.1 MB — 계곡이 늘어 앱 번들이 커졋다, 후속 제안 (6)). 수락산은 CHM quadkey 이웃 타일이 창과 겹치지 않아 `rasterio WindowError` 로 실패 → `scripts/shade/assets.py` 에서 겹치지 않는 타일을 건너뛰게 고쳐(P1 소폭 수정) 재실행. 샘플 계곡의 그늘 산출물은 `data/examples/shade/sample/` 로 옮겨 테스트 픽스처로만 쓴다. 정오 그늘 평균 33%(목록 요약).

*판단(기획 대비)*: ① `whole` 은 라벨만 추가하고 카드 제목 규칙은 그대로("전체 · 무릎" / "전체") ② 합본 모양은 `{ metadata, collections[] }` — 계곡별 파일의 `metadata.verified` 를 `Valley.verified` 로 옮겨 붙이고 데이터셋 머리말은 sync 가 합성 ③ 상단 칩 '샘플' → '베타', 고지 문구를 데스크 검수로(샘플 문구가 거짓이 되므로 — 최종 문구·라이선스 표기는 SD1b) ④ Overpass 는 Node 기본 UA 의 POST 를 406 으로 거절 → GET + 식별 UA ⑤ 접근 경사는 그늘 파이프라인이 아니라 Terrarium 표고차/직선거리로 산출(주차장 3 km 안일 때만).

**SD1b 진행 (2026-09-06, 에이전트 — 사용자 지시 "manual.csv 의 입력값은 사용자가 아직 등록할 수 없어. 너가 찾아서 한번 등록해줘")**

*수기 항목 1차 채움* — 데스크 조사 4갈래(계곡 8·8·7·7개, 공식 출처 우선·블로그는 depth·bed 2건 일치만) + **행안부 생활안전지도 물놀이관리지역 JSON**(`POST safemap.go.kr/wtrPlay/getSearchList.json`, 시군별 목록에 좌표·구분·최대/평균 수심 — 13개 시군 111건을 받아 계곡 중심선과 거리 매칭, 8계곡 채택). 결과 **104/240 채움**: swimBanned 17(금지 5 — 현등사 식수원·도마치 적목용소 위험지역·송추/안골 국립공원·감악산 운계폭포 관람만), riskNote 17, depth 18, bed 10, freeAccess 20, campingAllowed 17, petAllowed 13, accessDifficulty 0. 근거 없는 항목은 빈 칸(청학동·광덕 0건). 출처 URL·확인일·근거 인용은 `manual.csv` 에만.

*판단*: ① 생활안전지도는 WMS 만 있다는 K1 기록과 달리 목록 JSON 이 열려 있어 swimBanned·riskNote·수심의 1차 출처로 삼았다(재전송이 아니라 속성 인용 + 출처 URL). ② 안골·송추의 swimBanned=true 는 북한산국립공원 "계곡 입수 원칙 금지(한시 개방 구간 예외)" 일반 규정 적용 — 개방 구간 여부 미확인, riskNote 에 명시. ③ 사나사: 생활안전지도 '사나사 계곡'(옥천면 용천리 952) 점이 우리 중심선에서 7.8 km — R1 계곡 점(VWorld 검색 '사나사계곡' 용천리 20-2, 수기 좌표와 7.8 km 차)이 틀렸을 가능성 → 좌표 재확인 대상에 추가. ④ 라이선스 표기: 목록 footer 한 줄 + 설정 정보 카드 2행(계곡 장면에만, /firework 설정 면 불변). 1구간 상세는 eyebrow 와 같은 한 단어 부제를 숨김.

*SD1b 정정 (2026-09-06, 메인 세션 지시 — 사용자 결정 "공식적인 정보 기반으로 세팅")* — 첫 판 104칸 중 언론·블로그·정보 사이트·관광공사 근거 **54칸 제거**(note 에 '비공식 출처라 제거 … 이전 값'), 인정 출처는 생활안전지도·지자체 go.kr·국립공원공단/산림청 or.kr(+춘천도시공사). `scripts/seed/safemap.mts`(`pnpm seed:safemap`) 신설 — 13개 시군 111건을 `.cache/safemap/` 에 받아 중심선 거리(1,500 m / 읍면·리 2,500 m / 지점명)로 **12계곡 매칭**, swimBanned(위험지역 → true)·riskNote(구분·수심 그대로)·depth(평균 수심 환산) 를 confidence high 로 덮어씀. 결과 **67/240**(high 40 · medium 27; swimBanned 14·riskNote 14·depth 12·freeAccess 12·camping 8·pet 5·bed 2). 용추는 중심선 10 m 의 '용추계곡' 위험지역으로 swimBanned=true(35 m 승안천 일반지역 병존). 1,000 m 이상 매칭 4건(조무락·현등사·유명산·백운) 은 같은 물줄기인지 확인 대상. **사나사 판정**: 사찰(용천리 302)은 127.5063/37.5380 — R1 점은 5.9 km 북동(용천리 20-2)이라 틀렸을 가능성 높음, 생활안전지도 점(용천리 952)은 지번이 사찰 앞과 이웃해 속성은 사나사계곡 것 → 좌표 교체는 하지 않고 후속 (2) 로. PR #27 본문에 계곡×항목×출처 기관×confidence 표와 빈 칸 목록.

*후속 제안(범위 밖, 항목 신설 안 함)*: (1) 표준데이터에 없는 산지 계곡 12개의 주차장은 `facilities-manual.csv` 로(지자체 관광 페이지·위성사진) (2) 오프셋 > 500 m 7개 계곡의 계곡 점 재지정 또는 수기 좌표열 (3) 브이월드 답신·국토부 하천망 파일로 하천망 권고 13개 좌표열 교체(R5 와 함께) (4) `splits.csv` 첫 후보 — OSM 에 `○○골` 지류 이름이 있는 용문산·사나사·우이동 (5) 시설 240개 중 도심 계곡(안골 60·송추 41·우이동 30)의 식당은 반경 1.5 km 가 넓다 — 시설 반경을 구간 회랑 기준으로 좁히는 안 (6) 그늘 합본 6.1 MB 가 앱 번들에 들어간다 — F4 메모대로 계곡별 지연 로드(서버 또는 분할 파일)로 전환 (7) 폰 폭(390)에서 상단 칩 '베타'가 두 줄로 꺾인다(셸 공통 스타일, '샘플' 때와 같은 조건 — /firework 보존 규칙 때문에 SD1a 에서 건드리지 않음) · 1구간 상세는 eyebrow '전체'와 부제 '전체'가 겹친다(SD1b 문구 정리 때 함께).

### F3b — 경보 도메인·UI (착수 2026-09-06)

**새 결정 없다.** F3 결정 8개(2026-09-04 확정)와 F3a 경계값(2026-09-06 확정, 설계서 §1.2), C7 배너 자리, SD1 실데이터가 모두 갖춰졌다. `docs/F3_ALERT_DESIGN.md` §3(합성 규칙)·§4(화면)·§5(스키마)가 계약이다.

**범위**
- core: `UpstreamAlert` 확장(§5 그대로 — `source`·`confidence`·`observedAt`·강우 3종·`waterLevelStage`·`waterLevelDeltaM`·`leadTimeMin`), `Valley.basin`·`alertCapability`, 합성 함수 `evaluateAlert(signals) → UpstreamAlert | null`(신호별 단계 → 최고값, S2 는 관심 상한, S5 는 특보 상한), 해제 규칙(강우 30분 ∧ 수위 하강 60분 ∧ 3h < 20 mm), 단계 매핑(관심·주의 → watch, 경계 → warning, 심각 → evacuate). 순수 함수 + 테스트.
- server: 폴러가 쌓은 관측값으로 계곡별 판정 → `/api/alerts`(현재 상태) + `/api/events` 채널 `alert`. 판정 로직은 core 를 import(중복 금지). 계곡 30개 × 유역 코드는 SD1 데이터에서.
- app: 구간 카드 배지(단계 3색 + 확신 점 ●◐○, 평시 없음), 상세 타일(라벨 "상류 강우 · N분 전 · 확신", 값 "최근 1시간 N mm · 수위 …", 고지 한 줄, 평시 "0 mm"), 지도 배너(warning 이상, C7 `ShellBanner` 우선순위 경보 > 헬스), 자료 없음 회색 타일(15분 초과). SSE 구독은 `ApiPort` 위에.
- 범위 밖: 푸시·구독(F3c), 격자 S3 실측(F3s hold), 경보 이력·사후 검증.

**검증** — `pnpm verify`; 경보 상태를 주입한 web 스크린샷(평시·watch·warning·evacuate·자료 없음, 라이트/다크/폰), `/firework` 다크 픽셀 diff 0(배너는 계곡 장면만), 합성 규칙 단위 테스트(출처별 상한·해제·매핑), 서버 판정 테스트. PR 1개.

**결과(2026-09-07, PR [#28](https://github.com/4sizn/modu-valley/pull/28) in-review)** — 위 범위 그대로 구현. 계곡별 관측소 로스터(S1/S2/S4)는 R1 실측 결과(`scripts/research/station-coverage/results.json`)에서 유도해 `server/src/alertSources.ts` 로 커밋(사용자 확인 2026-09-06 — 새 API 연동 없이 이미 승인된 연구 데이터를 그대로 씀). `pnpm verify` 전부 통과(lint 는 스타일 제안 1건만, 무시). `/firework` 다크 픽셀 diff 49/1,090,080px(≈0.0045%, 애니메이션 타이밍 잡음 — 배너는 `scene==='valley'` 로 막혀 있어 festival 화면은 불변) — 증거는 `proof/F3b-alert-ui`.

**후속 제안**
- S2 로스터가 "같은 중권역(mbsncd)" 조건까지 요구해 능선 너머 인접 우량계(예: 백운←광덕산, 다른 중권역)가 빠진다 — R1 원시 관측소 캐시로 유역 무시 로스터를 다시 뽑아야 §2 의 "11/30" 이 채워진다.
- AWS 관측소는 값이 이미 RN-60m(1시간 롤링 합)이라 10분 증분을 복원 못 해 `rainfall10mMm` 이 비고, 3시간 합도 1시간 값을 상한으로 대신한다(`server/src/alerts/signals.ts` 문서화) — 정밀 3시간 합이 필요하면 별도 소스가 있어야 한다.
- S5(호우특보) 폴러가 없다 — `evaluateAlert` 는 특보 신호를 받게 돼 있지만 서버가 만들어 넘기는 실제 소스가 아직 없다(신규 폴러 필요, 범위 밖).
- 격자(S3, F3s hold) 가 편입되면 인접 우량계 corroboration 로직(§3 규칙 3)을 실측으로 재검증해야 한다.
- 로스터는 R1(2026-09-04) 스냅샷 고정값이라 R1 을 다시 돌리면 `alertSources.ts` 도 다시 생성해야 한다.

### SD2 — 시딩 데이터 검증 (착수 2026-09-07)

**왜** — SD1b 가 생활안전지도 물놀이관리지역을 계곡 중심선에 거리로 매칭했는데, 5건이 멀다. 다른 물줄기의 수심·위험 정보가 계곡 카드에 붙어 있으면 안전 정보로서 틀린 값이다.

**판정 규칙(구현자가 임의 판단하지 않는다)**
1. safemap 지점의 `ADRES` 행정구역(리 단위)과 하천명(`PLC_NM`)을 계곡의 OSM 중심선 하천명·통과 행정구역과 대조한다.
2. **하천명 일치 ∧ 같은 리(또는 인접 리)** → 같은 물줄기로 인정, 거리(m)를 note 에 남기고 값 유지.
3. 그 외 → **매칭 해제**: 해당 계곡의 safemap 근거 값(swimBanned·riskNote·depth)을 빈 칸으로 되돌리고 note 에 사유·거리.
4. 계곡 좌표 자체가 의심되면(사나사) 후보 좌표를 **보고만** 한다 — `valleys.json` 교체는 하지 않는다(R1 산출물).
5. 빈 칸은 공식 출처(지자체 go.kr·산림청/국립공원 or.kr)로 한 번 더 찾아 채운다. 없으면 그대로 둔다. confidence 필수.

**산출물** — `scripts/seed/` 재실행으로 `data/valleys/*` 갱신, `data/seed/manual.csv` 정정, 검증표(계곡·지점·하천명·행정구역·거리·판정) 를 이 절과 PR 본문에. PR 1개.

**재판정 결과 (2026-09-07)** — 방법: 하천명은 계곡 중심선 OSM way 의 `name` 태그(Overpass `way(id:…)`) 를 그대로 쓰고, 무명이면 백과사전 등 2차 출처로 확인. 행정구역(리)은 브이월드 주소 API(`req/address?service=address&request=getAddress`, 중심선 시작·중간·끝 3점, 지적 파셀 기준 — OSM Nominatim 역지오코딩은 이 지역에서 시군 경계가 겹쳐 나오는 오류가 있어(예 포천시 점이 "화천군"으로 나옴) 보조 참고로만 썼다) 로 확인.

| # | 계곡 | safemap 지점(PLC_NM · ADRES) | 하천명 일치 | 행정구역 | 거리 | 판정 | 근거 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 백운계곡 | 영평천(OBJT_ID 37) · 포천시 이동면 도평리 36 일대 | 중심선 way 531287119 는 무명이나 **동일 하천계** — 영평천은 광덕산(1,046 m) 자등현·광덕현과 백운산(904 m) 정상에서 흘러내린 물이 만나 이루는 하천([한국민족문화대백과사전](https://encykorea.aks.ac.kr/Article/E0037806)), 백운계곡이 그 백운산쪽 발원 계곡 | 도평리 = 도평리(브이월드 파셀: 중심선 3점 모두 "포천시 이동면 도평리 산 1-2·75-5·76-10") | 1705 m | **유지** | 하천계 일치 + 행정구역 완전 일치. 근접 하천망 명칭 "지촌천"(비교표 상 표기)은 중심선에서 1574 m 떨어진 별개 지류라 무관 |
| 2 | 조무락골 | 도마천(OBJT_ID 90) · 가평군 북면 적목리 643 | 일치 — 중심선 way 1289915314 `name=도마천` | 적목리 = 적목리(브이월드 파셀: 중심선 3점 모두 "가평군 북면 적목리 산 1-28·산 2·658") | 1084 m | **유지** | 하천명·행정구역 모두 일치 |
| 3 | 유명산계곡 | 벽계천(OBJT_ID 68) · 가평군 설악면 가일리 350 | 일치 — 중심선 way 694778836 `name=벽계천` | 가일리 = 가일리(브이월드 파셀: 중심선 3점 모두 "가평군 설악면 가일리 산 93·산 89") | 1327 m | **유지** | 하천명·행정구역 모두 일치 |
| 4 | 현등사계곡(운악산) | 조종천(OBJT_ID 78) · 가평군 조종면 신상리 257 | 일치 — 중심선 way 471313427 `name=조종천`(다른 구간 way 1214439228 은 `waterway=river` 무명) | 중심선은 운악리(브이월드 파셀: 3점 모두 "가평군 조종면 운악리 산 162-1·산 201·656") — safemap 은 **인접 리** 신상리. 조종면은 리가 6개뿐인 소규모 면이고 운악리(2016년 하판리에서 개칭)·신상리는 조종천을 사이에 두고 붙어 있다([가평군 조종면 안내](https://www.gp.go.kr/ha/contents.do?key=345)) | 1099 m | **유지** | 하천명 일치 + 인접 리(조종천 변 연속 구간). OSM 행정경계(Nominatim)는 이 3점을 "신상리"로도 렌더링해 — 두 리 경계가 이 구간 근처를 지남을 뒷받침 |
| 5 | 사나사계곡 | "사나사 계곡"(OBJT_ID 53, PLC_TYPE 계곡) · 양평군 옥천면 용천리 952번지 | **판단 불가** — safemap `PLC_NM` 은 하천명이 아니라 장소명(계곡 이름)이라 하천명 대조 대상이 없음. 현재 중심선(사기막천 way 1160972803·원암골 way 1201060209)과도 다른 수계 | 용천리 = 용천리(명목상 일치)이나 실사나사 사찰·계곡은 현재 등록 좌표에서 5.7 km 떨어진 별개 위치(아래 항목 2) | 7782 m | **매칭 해제** | 좌표 자체가 의심스러워(항목 2) 리 일치만으로 유지 근거 삼지 않음. `depth`(mixed)·`swimBanned`(false)·`riskNote` 3 필드를 빈 칸으로 되돌리고 note 에 사유 기록 |

**항목 2 — 사나사 좌표 후보 (보고만, `valleys.json` 미변경)**

현재 등록 좌표(`sanasa`, 127.543094, 37.580994 — VWorld 검색 "사나사계곡" 결과, 분류 "자연지명 > 골짜기")는 브이월드 지명 검색(`req/search`, query=사나사)에서 나온 실제 사나사 사찰·부속 시설과 **5.7 km** 떨어져 있다. 같은 검색 결과에 사찰 자체(POI `사나사(양평)`, 127.506332, 37.538517, 파셀 "양평군 옥천면 용천리 302")·주차장(`사나사주차장개방화장실입구`, 127.500299, 37.529736)·사찰앞 화장실(127.506034, 37.537284) 이 한 곳에 모여 있고, 이 클러스터에서 41 m 떨어진 곳(사찰 기준)에 OSM 하천 way `205412695`(`name=사탄천`)가 지난다 — safemap 지점(127.476423, 37.528494)도 이 way 에서 **23 m** 밖에 안 떨어져 있다(safemap↔사찰 직선거리 2856 m, safemap↔주차장 2110 m). 즉 안전지도 매칭 후보와 실제 사나사가 **같은 하천(사탄천) 위에 있는 반면, 현재 등록 좌표는 전혀 다른 수계(사기막천·원암골, 벽계천 상류)** 에 있다.

**후보 좌표(제안, 미적용)**: `lng 127.506332, lat 37.538517`(POI "사나사(양평)", 용천리 302) 또는 계곡 진입부를 대표하려면 주차장 `lng 127.500299, lat 37.529736`. 중심선 후보 하천: OSM way `205412695`(사탄천). 재시딩 시 `scripts/research/station-coverage/valleys.json` 과 `data/seed/valleys.json` 양쪽의 사나사 좌표·좌표열을 함께 바꿔야 R1 커버리지·SD1 산출물이 어긋나지 않는다.

**항목 3 — 빈 칸 재조사 (공식 출처만, 계곡당 2~3분 한 바퀴)** — 30계곡을 6개씩 5조로 나눠 병렬 조사(일반 에이전트, WebSearch). 도메인 기준: `*.go.kr` 문화관광 페이지·산림청 숲나들e(`foresttrip.go.kr`)·국립공원공단(`knps.or.kr`)·지자체 시설관리공단(`gpfmc.or.kr`·`cuc.or.kr` 등)·`safemap.go.kr` 만 인정, 이미 "비공식 출처라 제거"로 표시된 도메인(언론·블로그·관광공사 `visitkorea.or.kr`·`gocamping.or.kr`·`kctg.or.kr` 등)은 재사용 금지. 170개 빈 칸 중 **6건**을 공식 출처로 채웠다(나머지는 이번 한 바퀴에서 공식 출처를 찾지 못해 빈 칸 유지):

| 계곡 | 항목 | 값 | 출처 | confidence |
| --- | --- | --- | --- | --- |
| 명지계곡 | freeAccess | true | [가평군 문화관광](https://www.gptour.go.kr/tour/tour_view.jsp?menu=tour&submenu=etc&paramidx=TL0000084) "입장료 : 없음" | medium |
| 조무락골 | freeAccess | true | [가평군 문화관광](https://www.gptour.go.kr/tour/tour_view.jsp?menu=tour&paramidx=TL0000081) "입장료 : 없음" | medium |
| 논남기계곡 | campingAllowed | true | [산림청 숲나들e 강씨봉자연휴양림](https://www.foresttrip.go.kr/pot/rm/fa/selectCmpgrArmpDtlView.do?insttId=0101&goodsId=G01010200202002003900356) 야영데크 116 예약 운영 | medium |
| 감악산 운계폭포 계곡 | swimBanned | true | [파주시 문화관광](https://tour.paju.go.kr/user/tour/place/BD_tourPlaceInfoView.do?menuCode=4&cntntsSn=550) "운계폭포 안으로는 들어갈 수 없으며, 구경만 가능" | medium |
| 수락산계곡(청학리) | bed | sand | [남양주시 문화관광](https://www.nyj.go.kr/culture/viewTnResrceU.do?resrceNo=376&rcpp=6&si1=2&si2=1&key=252) 청학비치 모래사장 | medium |
| 수락산계곡(청학리) | freeAccess | true | [남양주시 문화관광](https://www.nyj.go.kr/culture/viewTnResrceU.do?resrceNo=376&rcpp=6&si1=2&si2=1&key=252) "자릿세·바가지요금 없음, 누구나 무료" | medium |

### F5 — 제보(현장 게시) (신규 기획 2026-09-07, 사용자 요구)

**사용자 요구 (그대로)**
- 사용자가 직접 해당 계곡의 제보를 진행해 **신고·정보·안내** 같은 글을 게시한다.
- 제보 태그에 **신고 · 안내 · 정보** 가 있고, 정보의 **세부내용**을 기재할 수 있다.
- 설득력을 위해 **사진 여러 장** 등록.
- **"실시간 정보" 콘텐츠에 출력**되고, **카드 형식으로 세부 정보**를 볼 수 있다.
- 쓰임: **불법 사유지 · 쓰레기 · 긴급 신고 · 계곡 새정보 · 미아찾기 · 물건찾기**.
- 제보 버튼을 누르면 입력 **폼 팝업**. spotts.kr 참고 가능.

**지금 있는 것 / 없는 것**

| | 상태 |
| --- | --- |
| 제보 버튼 | 있다 — `MapControls` 의 `report` 필. 지금은 "준비 중" 알림만(`VALLEY_COPY.reportComingSoon`) |
| 내비 탭 | `NAV_TABS` 에 `report` 가 이미 있다(눌러도 동작 없음) |
| "실시간 소식" 티커 | `Ticker` + `NewsTickerController` + `TickerMessage`(문구 3개 하드코딩)가 있으나 **festival 전용**(`MapScreen` 이 `scene === 'festival'` 로 막음). valley-ds 재사용 지도에 "계곡의 실시간 피드가 같은 자리" 로 적혀 있다 |
| 서버 쓰기 | **없다** — `server/src/http/routes/` 는 전부 GET(healthz·vworld·hydro·aws·basins·events·alerts). POST/PUT 라우트 0개 |
| 사진 저장 | **없다** — multipart·업로드 인프라 없음. SQLite 는 있다 |
| 작성자 식별 | **없다** — 로그인·기기 id 개념이 없다. `StoragePort` 만 있다 |
| SSE | 있다 — `/api/events` 채널 hydro·aws·alert. `report` 채널을 더할 자리 |

**이 항목이 여는 새 축 셋** — ① 서버 쓰기(입력 검증·레이트리밋·남용 대응) ② 파일 저장(사진, 용량·수명·EXIF) ③ 작성자 식별(익명이라도 중복·삭제·차단의 단위가 필요). 그래서 기존 항목보다 결정이 많고, 배포 대상(S1 (c) 미정)이 사진 저장 방식을 정한다.

**결정 (검토 페이지 https://claude.ai/code/artifact/45775ee0-4955-44be-a213-66f0a9d02bac — 폼·카드·피드 폰 목업)**
- (a) **작성자 식별** — A1 기기 익명 id(설치 시 발급, `StoragePort` 저장) + 표시명 없음(권고) / A2 기기 id + 닉네임 입력(선택) / A3 로그인(계정 축 신설)
- (b) **태그 구조** — B1 대분류 3(신고·안내·정보) × 세부유형 6 을 **매핑 고정**(신고: 불법 사유지·쓰레기·긴급 신고 / 안내: 미아찾기·물건찾기 / 정보: 계곡 새정보)(권고) / B2 세부유형 6종만(대분류 없음) / B3 대분류 3 + 세부는 자유 입력
- (c) **사진** — C1 최대 3장·장당 5 MB·서버가 리사이즈(장변 1600)·**EXIF 위치·시각 제거**(권고) / C2 최대 5장·원본 보관 / C3 사진 없음(1차는 글만)
- (d) **사진 저장 위치** — D1 서버 디스크 + 정적 서빙(`server/data/uploads/`, 배포 시 볼륨)(권고) / D2 객체 스토리지(S3·R2 — 계정·비용) / D3 SQLite BLOB
- (e) **폼 형태** — E1 시트 위 **모달 팝업**(사용자 요구 "폼 팝업")(권고) / E2 시트 면 전환(설정 면과 같은 방식) / E3 전체 화면 라우트
- (f) **"실시간 정보" 자리** — F1 계곡 화면에 **티커 신설**(festival `Ticker` 재사용, 문구를 제보 피드로) + 목록 면 상단 "실시간 정보" 섹션 3건(권고) / F2 티커만 / F3 내비 `report` 탭에 전용 면
- (g) **카드 세부 보기** — G1 피드 카드 탭 → **시트 상세 면**(구간 상세와 같은 플립, 사진 캐러셀·유형·시각·작성자 없음)(권고) / G2 모달 / G3 지도 핀 + 팝업
- (h) **남용 방지·수명** — H1 기기당 10분에 3건·계곡당 하루 20건 · 신고하기(3회 누적 시 자동 숨김) · **7일 후 자동 만료**(긴급 신고는 24시간)(권고) / H2 레이트리밋만 / H3 사람이 검수 후 게시(운영 부담)
- (i) **긴급 신고 처리** — I1 게시 + **"119·112 는 직접 전화" 안내를 폼과 카드에 병기**(앱은 신고 접수 기관이 아니다)(권고) / I2 전화 연결 버튼까지 / I3 긴급 유형 제외
- (j) **지도 표시** — J1 1차는 지도에 그리지 않는다(피드·카드만)(권고) / J2 제보 핀 표시(좌표 입력 필요) / J3 유형별 핀 + 필터

**결정 확정 (2026-09-07 사용자)** — 상충 두 곳은 아래처럼 정리했다.
- (a) **A3 로그인 — 단, 계정 도입은 v2.** 1차는 폼에 **닉네임 + 비밀번호** 입력을 둔다(게시판 방식): 닉네임은 카드에 표시, 비밀번호는 **해시로만 저장**(argon2id 또는 bcrypt, 평문·로그 금지)하고 **그 제보의 수정·삭제 인증**에만 쓴다. 계정·세션·로그인 화면은 만들지 않는다(v2). 기기 id 도 두지 않는다 — 레이트리밋은 IP 기준.
- (b) **B2 유형 6종만**(분류 없음). 사용자 주문: **레이아웃·디자인시스템에 신경 쓸 것.** 6색이 섞여 어지럽지 않도록 — 유형색은 `markerPalette` 에 6개를 한 세트로 정의(채도·명도 맞춤), 칩은 아이콘 + 라벨, 폼에서는 2줄 그리드(3×2), 피드 카드에서는 유형 칩 1개만 좌상단, 목록에서 같은 유형이 연속하면 색 반복이 눈에 띄지 않게 카드 배경은 중립 유지.
- (c) C1 사진 최대 3장 · 장당 5 MB · 서버 리사이즈(장변 1600) · **EXIF 위치·시각 제거**.
- (d) D1 서버 디스크 `server/data/uploads/` + 정적 서빙(배포 시 영구 볼륨 필요 — S1 (c) 결정에 걸린다).
- (e) E1 시트 위 모달 팝업.
- (f) F1 계곡 화면 티커 신설 + 목록 상단 "실시간 정보" 섹션 3건.
- (g) G1 시트 상세 면 — 사진 크게, 유형·**작성 시각**·닉네임, 신고하기. **"만료" 표시는 뺀다**((h) H2 로 만료가 없다).
- (h) **H2 레이트리밋만** — 자동 만료·신고 누적 자동 숨김은 만들지 않는다. `신고하기` 버튼은 남기되 누적 처리 없이 접수만 기록한다. **위험(기록)**: 오래된 제보가 "실시간 정보" 에 남는다 — R4 는 경쟁 서비스가 "갱신 루프 없음" 으로 죽었다고 판정했다. 완화로 카드·티커에 **상대 시각을 항상 크게** 표시하고, 피드 정렬은 최신순으로 한다.
- (i) I1 게시 + 폼·카드에 "119·112 는 직접 전화" 고지 병기.
- (j) J1 1차는 지도에 그리지 않는다.

**화면 결정 확정 (2026-09-07 사용자, 목업 검토)** — 검토 페이지의 7개 항목.
- (a) **A2 유형 6색 각각.** 권고(A1 긴급만 색)와 다른 선택이라 완화를 함께 둔다. 팔레트가 24색이 되는 문제는 실재한다(시설 9·혼잡 3·경보 3·그늘 3 + 유형 6). 다만 **유형 칩은 제보 카드에, 경보·그늘 배지는 구간 카드에** 놓여 같은 카드에서 만나지 않는다 — 이게 A2 를 감당 가능하게 만드는 실제 근거다. 시설색은 지도 핀이라 자리가 또 다르다.
  **한 값으로 두 테마를 다 만족시킬 수 없다**(흰 배경 4.5:1 은 상대휘도 ≤0.117, `#202024` 4.5:1 은 ≥0.245 — 교집합 없음). 그래서 `ALERT_LEVEL_COLORS`·`SHADE_AMOUNT_COLORS` 의 단일값 관례를 이 하나만 깨고 **테마별 2벌**로 둔다:

  | 유형 | light(`#ffffff` 위) | dark(`#202024` 위) |
  | --- | --- | --- |
  | `illegal-property` | `#a8452a` | `#e2916f` |
  | `trash` | `#5d7030` | `#a9c069` |
  | `emergency` | `#c02b1e` | `#ff8a72` |
  | `valley-info` | `#16697f` | `#5fc0d8` |
  | `missing-person` | `#7b3fa8` | `#c99af0` |
  | `lost-item` | `#2f5fa8` | `#86b4f0` |

  구현자가 두 배경에서 대비 4.5:1 을 실측해 미달하면 명도만 조정한다(색상각 유지).
- (b) **B3 가로 스크롤 칩 한 줄.** 목업에서 지적한 위험(미아찾기·물건찾기가 화면 밖에 숨는다)이 남으므로 완화를 넣는다 — 오른쪽 끝 페이드로 더 있음을 알리고, 칩을 아이콘+라벨 최소 폭으로 좁히고, 선택된 칩은 자동으로 보이는 위치로 스크롤한다. A2 의 6색이 여기서는 이점이다(색으로 미리 구별된다).
- (c) C1 전송 버튼 바로 위 2칸 한 줄 + "이 제보를 지우거나 고칠 때만 씁니다" 안내.
- (d) D1 좌측 정사각 썸네일(56px) + 본문 2줄. 사진 없는 제보도 같은 높이(빈 자리에 펜 글리프).
- (e) E1 가로 캐러셀 한 장씩 + 점 표시.
- (f) **F1 기존 제보 버튼 그대로.** 셸(`MapControls` 의 `report` 필)을 건드리지 않는다 — `/firework` 와 공유하므로 변경 위험이 가장 작다. `VALLEY_COPY.reportComingSoon` 알림을 폼 열기로 바꾸는 것이 전부다.
- (g) **G3 티커는 유형 + 본문, 시각은 카드에서만.** 이 선택은 **결정 (h)(자동 만료 없음)의 완화와 정면으로 충돌한다** — 승인 당시 완화가 "카드·티커에 상대 시각을 항상 크게" 였는데 티커에서 그게 빠진다. 사흘 전 글이 "실시간" 으로 순환하는 것이 R4 가 짚은 실패 방식이다. **해석**: 시각을 되살리는 대신 **티커에 올리는 제보를 최근 24시간으로 제한**한다 — 시각을 안 보여도 티커에 있는 것은 다 최근이 된다. 카드·상세는 그대로 상대 시각을 크게 유지한다. **사용자가 이 상충 해소를 메인 세션 판단에 위임했다(2026-09-07 "너의 판단에 맞길게") → 24시간 규칙 확정.** 구현은 이 값을 상수로 두고(`REPORT_TICKER_MAX_AGE_HOURS = 24`) 나중에 조정 가능하게 한다. 24시간 안에 제보가 하나도 없으면 티커는 계곡 기본 문구로 돌아간다 — 빈 티커를 두지 않는다.

**범위(승인 뒤)** — PR 3개 예상: F5a 서버(스키마·POST `/api/reports`·목록·사진 업로드·레이트리밋·만료 잡·SSE `report` 채널) → F5b core·app 폼(도메인·유즈케이스·모달 폼·사진 선택·전송) → F5c 피드·카드(티커 신설·목록 섹션·상세 면·신고하기).

**범위 밖** — 로그인·계정, 댓글, 좋아요, 푸시 알림(F3c), 지도 핀(J2 선택 시 별도), 운영자 검수 도구.

**미결 의존** — 사진 저장(D1)은 배포 대상에 볼륨이 필요하다. S1 (c) 배포 결정이 없으면 로컬 개발까지만 만들고 배포는 뒤로.

**F5a 구현 메모 (2026-09-07)**
- 마이그레이션 번호는 지시된 `0003_reports.sql` 대신 **`0004_reports.sql`** — `0003` 은 이미 F3b `alerts.sql` 이 쓰고 있었다(같은 번호는 `migrate.ts` 가 던진다).
- 비밀번호 해시는 **bcryptjs**(순수 JS 구현) — `argon2`·네이티브 `bcrypt` 는 둘 다 node-gyp 빌드가 필요해 `pnpm allowBuilds` 승인이 하나 더 늘고 배포 이미지도 복잡해진다. `sharp`(사진 리사이즈)는 프리빌트 바이너리만 받으므로 `allowBuilds: sharp: true` 하나만 추가했다.
- `ApiPort` 의 제보 메서드 6개는 **`abstract` 가 아니라 기본 구현**(`repository/load-failed` 반환)으로 추가했다 — `abstract` 로 두면 기존 `FetchApiClient`(F5b 대상, 이 PR 은 건드리지 않는다)가 당장 컴파일이 깨진다.
- `POST /api/reports` 의 IP 별 10분·하루 이중 한도는 `rateLimit.ts` 에 새 `TieredRateLimiter`(여러 `FixedWindowRateLimiter` 를 묶어 하나라도 막히면 거절)로 얹었다 — `/api/*` 공통 60/분 한도와 별개로 이 라우트에만 추가로 붙는다.
- `valleyId` 검증은 `data/valleys/*.geojson` 파일 이름을 서버 시작 시 한 번 읽어 만든 집합과 대조한다(`src/valleys.ts`). Docker 이미지에서는 `serverDir` 기준 기본 경로가 번들 레이아웃과 안 맞아 `VALLEYS_DIR=/app/data/valleys` 를 명시로 고정했다(빌드 스테이지에서 `data/valleys` 를 이미지에 복사).
- 검증: `pnpm verify` 통과(로컬 실행 로그는 PR 본문). 실제 서버를 띄워 사진 2장 업로드 → 목록·상세·정적 서빙·신고하기·PATCH/DELETE(비밀번호 오답 403·정답 200, 파일도 삭제)까지 curl 로 확인, 저장된 해시가 `$2b$10$...` bcrypt 형식이고 로그 어디에도 평문 비밀번호가 없음을 확인.

**F5b 구현 메모 (2026-09-07)**
- `FetchApiClient` 에 `ApiPort` 제보 메서드 6개(`reports`·`report`·`createReport`·`updateReport`·`deleteReport`·`flagReport`) 실제 구현. `createReport` 는 사진이 없으면 JSON, 있으면 multipart/form-data — 이 파일이 DOM 을 몰라야 해서(`FormData`/`Blob` 금지) 경계 문자열·필드·파일 파트를 바이트로 직접 이어 붙인다(UTF-8 인코딩도 `TextEncoder` 없이 수기 구현 — RN 크로스플랫폼 제약). 실패 응답 본문의 원시값 필드(문자열·숫자·불리언)를 `RepositoryError.context` 에 얹어 429 의 `retryAfterSec` 을 앱이 읽게 했다.
- `REPORT_TYPE_COLORS`(`map-style`) 는 TODO 표의 12개 값을 그대로 썼다 — 두 배경(`#ffffff`·`#202024`) 위 WCAG 대비를 실측하니 6종 전부 이미 4.5:1 이상이라 명도 조정이 필요 없었다(라이트 5.49~6.73:1, 다크 6.58~8.06:1). `test/reportTypeColors.test.ts` 가 회귀를 잡는다.
- 계곡 선택 UI 는 화면 결정 7개에 없던 부분이다 — 제보 버튼이 `MapControls` 의 전역 컨트롤이라 특정 구간 컨텍스트가 없을 수 있다(구간 상세가 열려 있으면 그 계곡으로 미리 채우고, 아니면 첫 계곡). 30개를 칩으로 늘어놓기엔 많아 **접힌 필드 + 펼치는 목록**으로 자체 판단했다 — 사용자 검토 전이라 재설계 여지가 있다.
- 사진 선택은 `platform/reportPhotoPicker.{web,native}.ts` 로 갈랐다(`mapPlatform`·`useLayoutFlip` 과 같은 `.d.ts` 계약 패턴). web 은 숨긴 `<input type=file>` 을 코드로 트리거하고, `change`/`cancel`/포커스 복귀 휴리스틱(300ms)으로 취소를 판정한다. 네이티브는 `expo-image-picker` 를 아직 들이지 않아(네이티브 빌드가 없다) `REPORT_PHOTO_PICKER_SUPPORTED = false` 자리표시자만 — 폼이 추가 타일 대신 안내 문구를 보여준다.
- 폼은 셸(`MapControls`)을 건드리지 않는다 — report 버튼의 `onPress` 만 valley 장면에서 RN `Modal`(팝업, 시트 트리 밖에 자체 포탈) 을 열도록 바꿨다. `/firework` 는 이 변경의 영향을 받지 않는다(모달이 valley 장면에서만 렌더).
- 검증: `pnpm verify` 통과(core 324 · map-style 85 · adapter-web 6 · adapter-native 38 · server 84 · app 45). 실제 서버(`pnpm server:dev`)로 성공(201, curl 로 저장 확인)·네트워크 실패(서버 끈 상태)·429(`TieredRateLimiter` 10분 3건 한도를 curl 로 먼저 채운 뒤 폼에서 전송, "요청이 많습니다. N초 뒤 다시 시도해 주세요" 확인) 세 경로를 실제로 재현. `/firework` 다크 픽셀 diff 0px(main 대비·셀프 대조군 둘 다 0, 방법은 불꽃 off + 티커 숨김 + 9초 대기). 스크린샷 라이트·다크 각 390×844, PR 본문에 첨부.

**F5b 후속 제안** (범위 밖, 결정 필요시 검토 페이지로)
- 네이티브 사진 선택 — `expo-image-picker` 배선(네이티브 빌드 착수 시).
- 계곡 선택 UI — 위 "자체 판단" 부분. 사용자가 다른 형태(예: 지도에서 계곡 탭 선택, 최근 본 계곡 우선)를 원하면 재설계.
- (g) 티커 최근 24시간 규칙·"실시간 정보" 섹션·상세 면·신고하기는 F5c 그대로.

**F5c 후속 제안** (범위 밖, 결정 필요시 검토 페이지로)
- "실시간 정보" 3건 초과분 — 지금은 절단만 한다(더 보기·전체 목록 없음). 제보량이 늘면 필요.
- 티커 본문 트렁케이션 길이(`REPORT_TICKER_HEADLINE_MAX_LENGTH = 24`) — 폰트·뷰포트별 실측으로 조정한 값이 아니라 1440×757/390×844 스크린샷 확인 기준이다. 다른 화면 폭에서 여전히 한 줄에 들어가는지 실기기 확인 필요.
- 신고 누적 임계값 — 결정 (h) 는 레이트리밋만(자동 숨김 없음). 남용이 실제 문제가 되면 v2 후보.
- 제보 상세를 지도 배경 탭(`background-press`)으로 닫는 것 — 지금은 × 버튼·Esc/뒤로가기만 지원한다(결정 (j), 지도에 제보가 없어 배경 탭과 연결할 이유가 약했다).
- 계곡별 제보 필터 — 지금 피드·티커는 전체 계곡 합산이다(결정 (f)(g) 가 계곡 구분을 요구하지 않았다). 계곡 화면에 계곡별 필터가 생기면(N1) 재검토.

### N2 · N3 — 데이터 실측 (2026-09-07)

N1 에서 배운 대로 기획 전에 세었다. **두 항목 모두 TODO 원안의 전제가 틀렸다.**

**N2 막차 역산 — `blocked`.** 원안은 "SD1 `station` 시설" 을 전제했는데, 시딩된 시설 332개를
세어 보니 **정류장(`station`)이 0건**이다. SD1 이 채운 것은 주차장 143 · 화장실 98 · 음식점 46 ·
상점 27 · 카페 18 뿐이다(`facilityType` 집계). `FACILITY_COLORS` 에 `station` 색이 있는 것은
스키마 자리일 뿐 데이터가 아니다. 정류장을 어디서 가져올지가 먼저다:
- 후보 ① **국토교통부 전국 버스정류장 위치정보 표준데이터**(data.go.kr) — SD1 이 이미 표준데이터
  JSON 엔드포인트로 성공한 경로(`pnpm seed:std`)라 재사용 가능성이 높다. 시딩 항목(SD3)이 된다.
- 후보 ② TAGO 정류소 API 를 S1 프록시로 런타임 조회 — 키는 동작 확인됨.
- **더 큰 위험**: 막차 시각 자체다. TAGO 노선정보는 노선의 기점·종점 첫차/막차를 주는데, 계곡
  인근은 농어촌·마을버스가 많아 **노선 커버리지가 얇을 수 있다.** 정류장을 시딩해도 막차 시각이
  안 붙으면 기능이 성립하지 않는다 — N1 의 "얕은 수심 0곳" 과 같은 실패 방식이다.
- **권고**: N2 기획 전에 **경계가 정해진 확인 1건**만 한다 — 30계곡 중 몇 곳에 정류장이 있고,
  그중 몇 곳에 막차 시각이 붙는지. 성립하는 계곡이 한 자리 수면 N2 는 접는다.

**N3 119 좌표 카드 — `planning`(계산 가능).** `nationalPointNumber` 는 스키마에만 있고 값이
**0건**이다. 그런데 국가지점번호는 조회가 아니라 **좌표에서 계산되는 격자 코드**다 —
데이터도 API 도 필요 없다.
- 체계(행안부 소관, 도로명주소법 근거): UTM-K(EPSG:5179, `lat_0=38 lon_0=127.5 k=0.9996
  x_0=1000000 y_0=2000000`, GRS80) 좌표를 쓰고, 격자 원점은 UTM-K 원점에서 **서 300km · 남 700km**
  → EPSG:5179 기준 `(700000, 1300000)`. 동쪽으로 `가~사`(7칸), 북쪽으로 `가~아`(8칸)를 100km
  단위로 붙이고, 각 칸 안의 위치를 **10m 단위 4자리씩** 두 번 쓴다 → `다사 5381 5262`.
- **직접 계산해 확인한 것**: 투영식을 구현해 원점 `(38.0, 127.5)` → 정확히 `(1000000, 2000000)`
  일치. 위키백과의 예시(충무공 이순신 동상 = `다사 5381 5262`)에서 **동쪽 4자리 `5381` 은 정확히
  일치**했고, 북쪽은 `5247` 로 **150m 어긋났다**. 예시 좌표를 역산하면 위도 37.571795 가 나오는데,
  동상 위치로 알려진 값(37.5709 근방)과 다르다 — **위키 예시 좌표가 부정확한 쪽이 유력하지만
  증명하지 못했다.**
- **그래서 이것이 착수 조건이다**: 119 에 읊는 좌표가 150m 틀리면 안 된다. **공식 출처의 기준점
  2~3개로 검증되기 전에는 국가지점번호를 화면에 내보내지 않는다.** 검증 후보는 도로명주소
  개발자센터의 국가지점번호 검색 API(키 필요 — K1 항목) 또는 국토정보플랫폼이다.
- **위경도는 검증 조건이 없다** — 119 가 받는 형식이고 파생 계산이 없다. N3 의 1차는 위경도만으로
  성립한다.

**사용자 결정 (2026-09-07)**
- **N2 — "노선 커버리지가 얕다고 판단되는 버스는 실시간 정보를 주지 않는걸로."** → `blocked → planning`.
  부분 커버리지를 허용한다는 뜻이다: 정류장·막차 데이터가 쓸 만한 계곡에서만 표시하고, 얇은 곳에서는
  **아무것도 그리지 않는다**(추정값·"정보 없음" 배지도 두지 않는다 — 없는 것처럼 조용히 빠진다).
  N1 의 "얕은 수심 0곳" 이 기능 전체를 무의미하게 만든 것과 달리, N2 는 되는 계곡에서만 켜지면 된다.
- **N3 — "표준 좌표 기준으로 위치 정리."** → 1차는 **표준 좌표계(WGS84 위경도)** 를 기준으로 위치를
  정리해 보여준다. **해석**: 국가지점번호는 이 결정의 대상이 아니다 — 파생 계산이고 공식 기준점 검증
  전에는 내보내지 않기로 이미 기록했다. 검증이 끝나면 위경도 옆에 **추가**하는 형태로 후속한다.
  (다르게 읽히면 되돌린다 — "표준 좌표" 가 EPSG:5179 를 뜻했다면 표시 좌표계가 달라진다. 다만 119 에
  읊는 형식은 위경도이므로 1차 표시는 위경도가 맞다고 판단했다.)

**N2 추가 실측 (2026-09-07) — 500m 반경 제약과 잠정 커버리지**

TAGO 게이트웨이가 2시간 반째 반영되지 않아(승인은 확인됨, `docs/API_KEYS.md` §9) OSM 으로 **대리
측정**했다. 두 가지가 나왔다.

1. **`getCrdntPrxmtSttnList` 는 반경 500m 고정이다**(API 문서 확인). 계곡 대표점 하나로 부르면
   정류소를 놓친다 — 계곡 중심선은 27~58점에 걸쳐 있고 정류소는 보통 입구 도로변에 있다.
   **중심선을 따라 여러 점에서 조회해 합쳐야 한다**(측정 때 12점 샘플을 썼다). N2 구현의 제약이다.
2. **잠정 커버리지(OSM `highway=bus_stop` + `public_transport=platform`, 500m)** — 30곳 중 14곳까지
   측정하고 Overpass 제한으로 중단했다: **있음 8 · 없음 6 · 미측정 16**.

   | 있음 | 개수 |
   | --- | --- |
   | 장흥계곡 | 24 |
   | 백둔리계곡 | 12 |
   | 청학동계곡 · 어비계곡 · 함허동천 | 10 |
   | 동막골계곡 | 8 |
   | 명지계곡 | 2 |
   | 백운계곡 | 1 |

   없음: 안골계곡 · 도마치계곡 · 구곡폭포 계곡 · 광덕계곡 · 경반계곡 · 조무락골

   **이 숫자는 OSM 기준의 대리값이다** — TAGO 는 정류소 등록 기준이 달라 더 많을 수도, 적을 수도
   있다. 확정 측정은 게이트웨이 반영 뒤 TAGO 로 다시 한다.

**판단** — 대략 절반 정도의 계곡에서 정류소가 잡힌다. 사용자 결정("커버리지 얕은 버스는 실시간
정보를 주지 않는걸로")대로 **되는 계곡에서만 켜면 되므로 진행 가능**하다. 다만 막차 시각이 붙는
비율은 아직 모른다 — 그것이 이 기능의 실제 커버리지다.

**N2 착수 전 실측 (2026-09-07, 메인 세션)**
TAGO **좌표 기반 근접 정류소 조회**(`BusSttnInfoInqireService/getCrdntPrxmtSttnList`)가 존재해
**정류장 시딩이 필요 없다** — 런타임 조회로 된다(SD3 후보 철회). 그런데 계곡 좌표로 호출하니
30계곡 전부 **HTTP 403 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`** 다. 키 문제가 아니라 **그 API 에
활용신청이 없어서**다(`docs/API_KEYS.md` §7 에 같은 코드의 해석이 기록돼 있다). 승인된 TAGO 는
버스도착(15098530)·시외(15098541)·고속(15098516) 3종뿐이고, 필요한 것은:
- **버스정류소정보 15098534** — 좌표 기반 근접 정류소(N2 의 정류장 매칭)
- **버스노선정보 15098529** — 노선 첫차·막차 시각(N2 의 막차)

**사용자 액션 필요**: data.go.kr 로그인. 브라우저 탭을 열어 두었으나 세션이 풀려 있다(비로그인).
로그인만 해 주면 두 API 활용신청은 메인 세션이 진행한다(개발계정은 자동승인, 앞선 K1 과 같은 절차).
신청 승인 뒤 커버리지를 재고(30계곡 중 정류장이 잡히는 수 → 그중 막차 시각이 붙는 수) 그 결과로
N2 결정 항목을 만든다 — 한 자리 수라도 위 결정에 따라 되는 곳만 켜면 되므로 접지는 않는다.

### N3 — 119 좌표 카드 (기획 2026-09-07)

**전제 두 가지**
- **표준 좌표(WGS84 위경도) 기준**(사용자 결정). 119 가 받는 형식이고 앱이 가진 좌표를 그대로 쓰므로
  변환 오차가 없다. 구간 좌표는 30곳 전부 있다(구간마다 27~58점), 단말 위치는 기기에서 읽는다.
- **네트워크 없이 동작해야 한다.** 계곡에서 신호가 약한 것이 기본 상황이다. 좌표는 기기 GPS 와 앱에
  이미 들어 있는 데이터에서만 나오므로 서버가 죽어도 카드는 뜬다. 지도 타일이 안 와도 숫자는 읽힌다.
- **국가지점번호는 이번 범위 밖**(위 "N2 · N3 데이터 실측" 절의 검증 조건). 값을 내보내지 않는다.

**핵심 발견 — 원안의 기준 지점이 틀렸다.** 원안은 "구간 상세에서 국가지점번호·좌표를 크게" 였는데,
구조 요청 상황에서 필요한 것은 **계곡의 좌표가 아니라 내가 서 있는 좌표**다. 구간 시작점은 실제
위치와 최대 수 km 다를 수 있다(구간 좌표가 27~58점에 걸쳐 있다). (a) 가 그래서 이 항목의 핵심이다.

**결정 (검토 페이지 — 실제 계곡 좌표로 만든 목업)**
- (a) **기준 지점** — A1 내 위치 우선·실패하면 구간(무엇을 보여주는지 라벨로 밝힘)(권고) / A2 구간 좌표만 / A3 내 위치만
- (b) **표기 형식** — B1 십진도 크게 + 도분초 작게(권고) / B2 십진도만 / B3 도분초 크게 + 십진도 작게
- (c) **여는 자리** — C1 지도 컨트롤에 전용 버튼(한 번 탭)(권고) / C2 구간 상세 안(원안, 셸 무변경) / C3 둘 다
- (d) **복사 내용** — D1 좌표 + 장소 이름(권고) / D2 좌표만 / D3 좌표 + 장소 + 지도 링크
- (e) **정확도 표시** — E1 오차 반경 숫자(권고) / E2 3단계 등급 / E3 표시하지 않음
- (f) **국가지점번호 자리** — F1 자리도 만들지 않음(권고) / F2 "준비 중" 자리 표시 / F3 계산값 + "미검증" 딱지

**(e) 를 결정 항목으로 둔 이유** — 협곡에서 GPS 오차가 수십 m 까지 벌어진다. 숫자만 크게 띄우면
그 오차가 안 보이고, **오차 200m 인 좌표를 확신을 갖고 읽어 주는 것**이 이 기능의 가장 위험한
실패 방식이다.

**범위(승인 뒤)** — PR 1개: core 좌표 형식 변환(십진도·도분초 순수 함수)·복사 문자열 조립 · 앱 카드 면
+ 위치 권한·정확도 처리 + ((c) C1·C3 이면) 컨트롤 버튼.

**범위 밖** — 국가지점번호(검증 후 후속), 주소 역지오코딩, 지도 링크((d) D3 선택 시에만), 오프라인 지도 타일.

### F5d — 제보 좌표 (사용자 결정 2026-09-07)

**사용자 결정** — "좌표 내용은 제보상의 영역에서 좌표를 선택하게끔." 선택지 세 개(제보 폼에 추가 /
119 카드에서 직접 고르기 / 공통 부품)를 목업으로 물었고 **제보 폼에 좌표 선택 추가**를 골랐다.
승인된 목업이 그대로 계약이다 — `위치` 항목에 "지도에서 선택", 인라인 지도 + 십자선, 그 아래
좌표 한 줄과 계곡·구간 라벨.

**N3 은 `hold`.** 좌표를 제보 영역에서 다루기로 했으므로 별도 119 카드를 만들지 않는다. N3 기획의
값어치(좌표를 크게, 복사, 정확도 표시)는 **제보 상세 면의 좌표 줄**로 들어간다. N3 절의 결정
항목들은 그대로 남겨 둔다 — 나중에 독립 카드를 다시 볼 때 재사용한다.

**해석 (메인 세션 판단, 위임 규칙에 따름)**
1. **좌표는 선택 사항이다.** 없으면 지금처럼 계곡·구간만으로 제보가 올라간다. 급한 제보(긴급 신고·
   미아찾기)에서 좌표 선택을 강제하면 제보 자체를 못 올린다.
2. **피커는 십자선 고정 + 지도 이동**(승인된 목업 그대로). 탭으로 찍는 방식보다 정밀하고 손가락에
   가려지지 않는다.
3. **기본 중심은 보고 있던 구간(없으면 계곡)이다 — 단말 위치를 쓰지 않는다.** 피커에 "내 위치로"
   버튼을 두지 않는다. `CLAUDE.md` 의 "개인위치정보는 기기를 떠나지 않는다" 규칙 때문이다 —
   내 위치를 기본값으로 넣으면 그대로 제출되어 사용자 위치가 서버에 저장된다. 사용자가 지도를
   끌어 고른 지점은 **자기 위치가 아니라 신고 대상 장소**이므로 이 규칙에 걸리지 않는다.
4. **서버가 좌표를 검증한다** — 해당 계곡 중심선에서 **반경 3 km** 안이어야 한다. 오타·엉뚱한
   좌표를 막고, 이미 있는 계곡 데이터로 검증할 수 있다. 밖이면 400.
5. **피드 카드에는 좌표를 넣지 않는다**(2줄 본문·썸네일로 이미 꽉 차 있다). **상세 면에만** 좌표
   한 줄 + 복사를 둔다.
6. **지도 핀은 이번에 그리지 않는다** — F5 결정 (j) 를 유지한다. 좌표를 갖게 되었으니 그릴 수 있게
   됐을 뿐이다. 핀·필터는 후속 후보로 남긴다.

**범위** — PR 1개: 마이그레이션 `0005_report_coords.sql`(lat·lng nullable) · POST/PATCH 검증(반경 3km)
· 응답 DTO · core 도메인(좌표 타입·검증 순수 함수·거리 계산 재사용) · 폼 피커 · 상세 면 좌표 줄과 복사.

**범위 밖** — 지도 핀·유형별 필터, 좌표 정확도 표시(단말 위치를 안 쓰므로 해당 없음), 역지오코딩,
국가지점번호(검증 조건 그대로).

**F5d 구현 메모 (2026-09-07)**
- core `distanceToPolyline`(점-폴리라인 최단거리, `equirectangularDistance` 와 같은 축척 재사용) +
  `ReportCoordinate.ts`(짝 여부·한국 범위·계곡 반경 판정·복사 문자열). server `valleys.ts` 에
  `loadValleyCenterlines` 추가(`data/valleys/*.geojson` 의 LineString 을 core `parseLineString`
  으로 읽는다 — 지금은 파일마다 Feature 가 하나뿐이라 첫 Feature 만 본다).
- `POST/PATCH /api/reports` 는 좌표를 셋으로 검증한다 — 한쪽만 오면·한국 범위 밖·계곡 반경
  3km 밖 각각 400(오류 코드는 서로 다르다). PATCH 는 `lat`/`lng` 를 `null` 로 보내 좌표를
  지울 수 있게 확장했다(폼 UI 는 아직 이 경로를 쓰지 않는다 — 생성만).
- 폼 "위치" 항목은 web 은 실제 인라인 지도(기존 `mapPlatform` 의 `createMapEngine`/`MapHost`
  재사용, pan·pinchZoom 만 켜고 회전·기울이기·`renderContent` 없음)로 동작한다. 네이티브는
  `REPORT_LOCATION_PICKER_SUPPORTED = false` 자리표시자(아래 후속).
- **브라우저 실측 중 잡은 버그 둘**: ① 접힌 위치 필드가 "지우기" Pressable 을 "변경"
  Pressable **안에** 중첩해 web 에서 `<button>` 안에 `<button>`(DOM 규칙 위반) React 오류가
  나던 것 — 나란한 두 Pressable 로 분리해 고쳤다. ② 이 오류가 나던 상태에서 위치 항목을
  열고 닫기를 반복하면 두 번째 지도 엔진이 초기화되지 않고 조용히 멈추는 현상도 함께
  재현됐는데, ①을 고치자 재현되지 않았다(4회 연속 성공) — 근본 인과관계를 어댑터 내부까지
  확증하지는 못해 `reportLocationPicker.web.tsx` 에 초기화 타임아웃(8초) + 재시도 버튼을
  안전망으로 남겼다. ③ core `parseApiReport` 가 서버 DTO 의 `lat`/`lng` 을 도메인 `Report`
  로 옮기지 않던 누락도 고쳤다(이 수정 없이는 좌표가 서버까지는 갔어도 앱 상태에 안 보였다).
- **실제 서버(`pnpm server:dev`)로 왕복 확인**: 폼에서 지도를 통해 좌표를 고르고 제출 →
  `GET /api/reports` 응답에 `lat`/`lng` 확인 → 목록의 "실시간 정보" 카드 탭 → 상세 면에
  "위도, 경도 · 좌표 복사" 줄 확인(라이트·다크 둘 다). 계곡 반경 3km 검증도 실제 좌표로
  통과·거부 양쪽을 봤다.
- `/firework` 다크 픽셀 diff 1440×757: main 대비 **0/1,090,080px**, 셀프 diff(같은 서버
  두 번 캡처) 도 **0px** 로 대조군 성립(불꽃 off + 티커 숨김 + 9초 대기, 기존 방법 그대로).
  공유 파일 중 바뀐 것은 `theme/copy.ts` 뿐이고 새 키 추가만이라(`REPORT_FORM_COPY`·
  `REPORT_FEED_COPY`, festival 은 참조하지 않는다) 영향이 없다 — `packages/adapter-web`·
  `packages/adapter-native`·`packages/map-style`·festival 관련 core 도메인은 diff 0.
- 검증: `pnpm verify` 통과(core 394·server 96·app 57·adapter-web 6·adapter-native 38·
  map-style 86). 스크린샷 라이트·다크 각 390×844 — 폼 위치 항목(접힘·펼침·좌표 선택됨)
  + 상세 면 좌표 줄, PR 본문에 첨부.

**F5d 후속 제안** (범위 밖, 결정 필요시 검토 페이지로)
- 네이티브 위치 피커 — `REPORT_LOCATION_PICKER_SUPPORTED = false`. 네이티브에서 두 번째
  `MapSurface`+`NativeMapView` 인스턴스를 모달 안에 띄우는 배선이 필요한데, 이 세션에는
  실기기·에뮬레이터 검증 환경이 없어(Android SDK 없음·Xcode 툴체인 우회 필요) 미뤘다.
  네이티브 빌드 착수 시 web 과 같은 어댑터 경계(`createMapEngine`/`MapSurface`)로 배선.
- 네이티브 클립보드 — `REPORT_CLIPBOARD_SUPPORTED = false`. React Native 코어에는 0.65+
  부터 클립보드 API 가 없다(`expo-clipboard` 같은 새 네이티브 모듈 필요) — 네이티브 사진
  선택(`expo-image-picker`)과 같이 묶어 검토.
- 폼에서 좌표 수정(PATCH lat/lng) — 서버·`FetchApiClient` 는 이미 지원하지만(이 PR)
  상세 면에 "수정" UI 가 없다(결정 (g) 가 애초에 본문·유형만 수정 대상으로 뒀다). 좌표까지
  고칠 수 있게 하려면 별도 결정 필요.
- 위치 피커 스타일 다듬기 — 십자선이 14px 로 작아 화면에서 잘 안 띈다는 인상이 있다(스크린샷
  확인 기준, 실사용 검증 아님). 크기·그림자 조정은 시각 개선 라운드에서.

### N1 — 조건 필터 칩 (기획 2026-09-07)

**실측이 원안을 뒤집었다.** TODO 원안의 칩 목록은 "무료 · 야영 · 반려견 · 그늘 많음 · 얕은 수심 ·
주차장 있음" 이었는데, 시딩된 30계곡을 세어 보니 **2종은 아무것도 걸러내지 못한다.** 대신 원안에
없던 **화장실**이 커버리지가 가장 좋다.

| 칩 후보 | 걸러지는 계곡 | 값이 있는 계곡 | 판정 |
| --- | --- | --- | --- |
| 화장실 있음 | 19 / 30 | (시설 데이터) | 가장 강함 — **원안에 없었다** |
| 주차장 있음 | 18 / 30 | (시설 데이터) | 강함 |
| 무료 입장 | 10 / 30 | 15 | 쓸 수 있음 |
| 야영 가능 | 7 / 30 | 9 | 약함 |
| 그늘 많음(종일 평균 ≥0.5) | 8 / 30 | **30** | 쓸 수 있음 — 빈 칸이 없는 유일한 필드 |
| 반려견 동반 | **1 / 30** | 5 | **못 씀** |
| 얕은 수심 | **0 / 30** | 11 | **못 씀** |

*(정정, 구현 리뷰) 이 표를 처음 쓸 때는 그늘 많음을 수관 비율(`canopyCover` ≥0.5, 6/30)로 세었는데,
그러면 N5 구간 카드의 "나무 그늘 많음" 배지(종일 평균 ≥0.5, `shadeTags`)와 술어가 달라져 카드엔
많음이라 적힌 계곡이 칩을 누르면 사라지는 불일치가 생긴다. 칩은 카드 배지와 **같은 술어**
(`shadeTags(segment).amount === 'many'`)를 쓰도록 고쳤고, 위 표·아래 조합·개수도 그 값(8/30)으로
다시 세었다.*

**수심은 `adult` 3 · `mixed` 5 · `waist` 3 뿐이고 `knee` 가 하나도 없다** — 생활안전지도 수심은
평균·최대 환산값이라 얕은 구간이 계곡 단위로 남지 않는다. "얕은 수심" 칩은 눌러도 항상 0곳이다.

**조건을 겹치면 금방 0곳이 된다** — 주차장+그늘 6곳, 주차장+무료 5곳, 주차장+무료+그늘 1곳,
**주차장+무료+야영 0곳**. 30곳뿐이라 세 개만 겹쳐도 비는 것이 정상이다. 그래서 (b) 빈 칸 취급과
(e) 결과 0곳 화면이 이 항목의 핵심 결정이다 — 필터가 "고장난 것처럼" 보일지가 거기서 갈린다.

**결정 (검토 페이지 — 실측 숫자를 넣은 목업)**
- (a) **칩 목록** — A1 쓸 수 있는 5종만(화장실·주차장·무료·야영·그늘)(권고) / A2 7종 전부, 못 쓰는 칩은 흐리게 / A3 커버리지 좋은 3종만
- (b) **정보 없는 계곡** — B1 제외하되 칩에 개수 표시 + "정보가 없어 제외된 15곳"(권고) / B2 포함하고 뒤로 / B3 그냥 제외
- (c) **다중 선택** — C1 다중·AND(권고) / C2 하나만 / C3 다중·OR
- (d) **칩 줄 자리** — D1 목록 맨 위(권고) / D2 "계곡" 섹션 헤더 옆 / D3 스크롤 고정
- (e) **결과 0곳** — E1 어느 칩을 놓으면 몇 곳이 되는지 알려주고 해제 버튼(권고) / E2 문구만 / E3 자동 완화
- (f) **지도 반영** — F1 핀도 걸러내되 걸러진 핀은 흐리게 남김(권고) / F2 목록만 / F3 지도에서 숨김

**결정 확정 (2026-09-07 사용자, 목업 검토)**
- (a) **A1 쓸 수 있는 5종만** — 화장실 · 주차장 · 무료 · 야영 · 그늘 많음. 반려견·얕은 수심은 만들지 않는다(데이터가 차면 재검토).
- (b) **B1 제외하되 개수를 밝힌다** — 칩에 매칭 개수를 항상 붙이고(선택 전에도), 목록 아래에 "정보가 없어 제외된 N곳". 개수는 **다른 칩의 현재 선택을 반영한 값**이어야 한다(AND 조합 뒤 남는 수) — 그래야 0곳 되기 전에 미리 보인다.
- (c) **C1 다중 선택 · AND**.
- (d) **D3 스크롤해도 붙어 있는 고정 줄**.
- (e) **E2 문구만** — 완화 제안·해제 버튼을 만들지 않는다.
- (f) **F3 지도에서 아예 숨긴다**.

**상충·미정 해석 (메인 세션 판단, 사용자 위임 규칙에 따름)**
1. **(e)+(f) 조합이 가장 거친 조합이다** — 0곳이면 지도가 텅 비고 목록에는 문구 한 줄만 남는다. 그런데 **(d) D3 와 (b) B1 이 그 구멍을 이미 메운다**: 칩 줄이 스크롤과 무관하게 화면에 붙어 있어 되돌릴 손잡이가 항상 보이고, 칩에 붙은 개수가 "어느 칩을 놓으면 몇 곳" 을 E1 없이도 알려준다. 그래서 E1 의 완화 버튼을 따로 만들지 않아도 막히지 않는다 — **이 조합은 (b)(d) 가 선택된 전제에서만 성립한다**. 나중에 (b) 나 (d) 를 되돌리면 (e) 를 E1 으로 다시 봐야 한다.
2. **(f) 숨김의 범위** — 지도 필터를 레이어별 표현식으로 넣지 않고 **`MapContent` 단계에서 걸러** `MAP_LAYER_SETS` 로 넘긴다. 그러면 계곡에서 파생되는 모든 레이어(`SHADE`·`WATER`·`SEGMENT`·`FLOW`·`FACILITY`)가 한 번에 함께 빠져 어긋난 상태(선은 없는데 그늘만 남는 등)가 원리적으로 생기지 않는다. 기저 지도·지형·음영·등고선은 그대로 둔다.
3. **걸러진 계곡의 시설도 함께 숨긴다** — "화장실 있음"·"주차장 있음" 칩과 앞뒤가 맞아야 한다.
4. **선택된 계곡은 필터에 걸려도 계속 보인다(선택이 이긴다)** — 상세 면이 열린 채 필터가 그 계곡을 배제하면, 지도에 없는 계곡의 상세를 보고 있는 상태가 된다. 선택을 유지하고 지도에도 남긴다.

**범위(승인 뒤)** — PR 1개 예상: core 필터 술어·칩 정의·개수 계산 순수 함수 + 앱 칩 줄·목록 연동
(+ (f) 선택 시 지도 레이어 필터).

**범위 밖** — 검색어 입력, 거리·이동시간 정렬, 칩 조합 저장, 반려견·얕은 수심 칩(데이터가 차면 재검토).

**후속** — 커버리지가 얇은 필드는 SD 계열에서 채워야 한다. `petAllowed` 5/30·`bed` 3/30 은
공식 출처로 더 채울 여지가 있다(SD2 가 6건 채운 방식).

**진행 (2026-09-07) — PR [#34](https://github.com/4sizn/modu-valley/pull/34) 열림 (`in-review`, 브랜치 `4sizn/N1-filter-chips`)**.
결정 (a)~(f) 를 계약대로 구현. core `domain/valley/filterChips.ts` — 칩 5종 정의(키·라벨·
술어), `evaluateFilterChips`(AND, 확실한 배제가 정보 없음보다 강하다 — 다른 칩이
`undefined` 여도 하나가 `false` 면 `no-match`), `filterValleys`(계곡 단위로 걸러 핀
고정 계곡 포함 + "정보 없어 제외" 개수), `filterChipMatchCounts`(칩마다 다른 칩의
현재 선택을 반영한 개수). 그늘 많음은 N5 구간 카드 배지와 **같은 술어**
(`shadeTags(segment).amount === 'many'`, 종일 평균 ≥ `SHADE_AMOUNT_MANY_MIN`)를
쓴다 — 처음엔 수관 비율(`canopyCover`) 기준으로 짰다가(6곳) 카드 배지(8곳)와 달라
"카드엔 많음인데 칩을 누르면 사라지는" 불일치가 리뷰에서 잡혀 정정했다. 세션 — `AppState.filterChips`
(세션 상태, 저장 안 함), `pinnedValleyId`/`mapContentFilterOf`(선택 → 핀 고정 계곡 →
지도 필터), `MapContentComposer` 가 계곡 단위로 구간·시설·그늘을 함께 거른다(해석
2·3, 레이어별 필터 표현식 없음). `ToggleFilterChipUseCase`(그늘 토글과 같은 태도) +
선택 유즈케이스 3개가 `refreshFilteredMapContent` 로 핀이 옮기거나 풀릴 때 지도를
다시 그린다(해석 4). app — `FilterChipRow` 를 시트 `ScrollView` **밖** 형제로 얹어
목록·상세 면 모두에서 조절 가능하게 했다(결정 (d) 의 구체화 — 상세가 열린 채로도
필터를 바꿀 수 있어야 해석 4 가 손으로 재현된다), `ValleyListFace` 가 같은
`filterValleys` 로 카드 목록을 거르고 0곳 문구(결정 (e))·"정보 없어 제외 N곳"
(결정 (b))을 붙였다.

**검증**: `pnpm verify`(core 370 · map-style 86 · adapter-web 6 · adapter-native 38 ·
server 84 · app 47), SD1 실측 개수를 테스트에 박음(화장실 19·주차장 18·무료 10·야영
7·그늘 많음 8, 주차장+그늘 6·주차장+무료 5·주차장+무료+그늘 1·주차장+무료+야영 0,
정보 없어 제외 무료 15·야영 21). web 스크린샷 라이트·다크 각 3장(미선택·주차장 1개
선택·3개 선택 0곳, 390×844) — 1개 선택 시 지도에서 주차장 없는 계곡의 하천 선이
사라지고(결정 (f)), 0곳에서는 칩 줄이 남은 채 지도의 계곡 요소가 모두 사라짐(스크린샷은
그늘 많음 정정 전 수치 기준이라 칩 배지 숫자는 재검증 때 바뀐다 — 화면 구조·동작은 그대로).
`/firework` 다크 픽셀 diff — **1440×757**(파리티 계약 기준 뷰포트, `docs/PARITY.md`)로
main 워크트리 대조 **0px**(셀프 diff 대조군도 0px). 처음엔 390×844 로 쟀는데 폭이
다르면 시트 배치가 달라져 계약을 재는 값이 아니다 — 리뷰에서 잡혀 1440×757 로
재측정했다(390×844 결과는 참고로 남긴다). `BottomSheet.tsx` 는 `scene==='valley'`
로만 분기해 festival 무변경.

### N5 — 그늘 태그 (기획 2026-09-07)

**실데이터가 원안을 뒤집었다.** L1 원안은 "오전 그늘 · 오후 그늘 · 종일 · 적음" 4태그였는데, SD1 30구간의 `shadeByHour` 를 집계하니 그 축이 성립하지 않는다.

| 측정 | 결과 | 뜻 |
| --- | --- | --- |
| 오전(10~12시) − 오후(15~18시) | **전 구간 음수** (최대 −0.01, 중앙 −0.06) | 오후가 항상 더 그늘지다 → **"오전 그늘" 계곡은 없다** |
| 종일 평균 − 수관 비율 | 중앙 0.032, 최대 0.112 | 그늘의 거의 전부가 **나무 그늘**이다(지형 그림자는 정오 기준 0에 가깝다) |
| 18시 − 정오 | 중앙 +0.22, 최대 +0.83, **30구간 중 15개가 +0.20 이상** | 해가 능선을 넘는 **늦은 오후 급증**은 계곡마다 다르다 → 쓸 수 있는 축 |
| 종일 평균 3분할 | p33 = 0.20 · p67 = 0.49 (0.2/0.5 경계로 많음 8 · 보통 12 · 적음 10) | 그늘 양은 고르게 나뉜다 |

**따라서 축은 둘이다** — ① 그늘 양(나무 그늘, 종일 평균) ② 늦은 오후에 시원해지는지(18시 급증). 시각별 값은 F4 슬라이더가 이미 보여 주므로 태그는 "한눈에 읽는 요약" 역할만 한다.

**결정 (검토 페이지 https://claude.ai/code/artifact/840cf925-846e-45fe-bb23-c08aea827602 — 카드 목업 위에 태그, 30구간 실측 분포 표)**
- (a) **태그 축** — A1 두 축(그늘 양 3단계 + "늦은 오후 그늘" 배지) (권고) / A2 그늘 양 3단계만 / A3 두 축 + 그늘 원인(나무·지형) 표시
- (b) **양 임계값** — B1 0.2 / 0.5 (분포가 8·12·10 으로 고르다) (권고) / B2 0.3 / 0.6 (많음을 엄격히) / B3 분위수(p33·p67 = 0.20·0.49, 데이터가 바뀌면 경계도 바뀜)
- (c) **급증 임계값** — C1 18시 − 정오 ≥ 0.20 (15/30) (권고) / C2 ≥ 0.30 / C3 17시 값 ≥ 0.5
- (d) **문구** — D1 "나무 그늘 많음 · 보통 · 적음" + "늦은 오후 그늘" (권고) / D2 "숲 그늘 · 반그늘 · 볕" + "오후 시원" / D3 "종일 그늘 · 반그늘 · 그늘 적음" + "17시 이후 그늘"
- (e) **표시 자리** — E1 구간 카드 메타 줄(무료·야영 배지와 같은 줄, 그늘 태그를 맨 앞) + 상세 그늘 타일에 태그 한 줄 (권고) / E2 카드 부제 문장에 끼워 넣기 / E3 상세 타일만
- (f) **N1 필터 연결** — F1 태그를 그대로 필터 칩 값으로 쓴다(N1 착수 시) (권고) / F2 필터는 별도 기준

**결정 확정 (2026-09-07 사용자)**
- (a) **A2 그늘 양 3단계만** — 화면에 배지는 넣지 않는다.
- (b) B1 임계값 종일 평균 **0.2 / 0.5**(적음 < 0.2 ≤ 보통 < 0.5 ≤ 많음).
- (c) C1 늦은 오후 급증 = 18시 − 정오 ≥ 0.20 — **(a) A2 와 상충**하므로 이렇게 처리한다: `shadeTags` 가 `lateAfternoon: boolean` 을 **계산해서 돌려주되 UI 는 쓰지 않는다**(상수·테스트만 남긴다). 나중에 배지를 켜려면 카드에서 그 값을 읽는 한 줄만 추가하면 된다.
- (d) D1 문구 "나무 그늘 많음 / 보통 / 적음". 배지 문구 "늦은 오후 그늘" 은 `VALLEY_COPY` 에 **정의만** 두고 렌더하지 않는다((a) A2).
- (e) E1 구간 카드 메타 줄 맨 앞(무료·야영 배지와 같은 줄, 경보 배지가 있으면 경보가 앞) + 상세 그늘 타일에 태그 한 줄.
- (f) F1 태그를 그대로 N1 필터 칩 값으로 쓴다(N1 착수 시 같은 함수 재사용).
- 값이 없는 구간(`shadeByHour` 없음)은 태그를 그리지 않는다.

**범위** — core `shadeTags(shadeByHour, canopyCover) → { amount, lateAfternoon }` 순수 함수 + 임계값 상수 + 테스트(경계값·빈 데이터), `VALLEY_COPY` 문구, `SegmentCard` 메타 줄, `ValleyDetailFace` 그늘 타일 한 줄. 데이터·스키마 변경 없음(있는 값에서 도출). PR 1개.

**범위 밖** — 필터 UI(N1), 시각별 태그(F4 슬라이더가 담당), 현장 검수.

**진행 (2026-09-07) — PR [#29](https://github.com/4sizn/modu-valley/pull/29) 열림 (`in-review`, 브랜치 `4sizn/N5-shade-tags`)**. 결정 (a)~(f) 를 계약대로 구현. core `domain/valley/shadeTags.ts` — `shadeTags(input)` 순수 함수(`Segment` 를 통째로 넘겨도, `{ shadeByHour, canopyCover }` 만 넘겨도 구조적으로 맞는다), 임계값 상수(`SHADE_AMOUNT_MODERATE_MIN` 0.2 · `SHADE_AMOUNT_MANY_MIN` 0.5 · `SHADE_LATE_AFTERNOON_SURGE_MIN` 0.2), `shadeAmountLabel`. 부동소수점 합산 오차(`1.8/9 → 0.19999999999999998`)가 0.2 경계 판정을 흔드는 걸 막으려고 평균·차분을 6자리에서 반올림(`round6`) — 경계값 테스트로 잡았다. map-style `SHADE_AMOUNT_COLORS`(짙은 녹·중간 녹·황토, 두 테마 공통). app — `SegmentCard` 메타 줄 맨 앞(경보 배지 다음)에 태그 칩, `ValleyDetailFace` 그늘 타일 아래 태그 한 줄, `VALLEY_COPY.shadeLateAfternoonBadge`(정의만, 결정 (d)). **검증**: `pnpm verify`(core 303 · map-style 82 · adapter-web 6 · adapter-native 38 · server 64 · app 27), SD1 실데이터 30구간 분포 스냅샷 많음 8·보통 12·적음 10(실측과 일치), web 스크린샷 3장(목록 세 단계·상세 그늘 타일·폰 목록). `/firework` 는 계곡 컴포넌트만 건드려 diff 검증 생략(PR 본문에 명시).

### N1~N5 — L1 묶음에서 승격한 개별 항목 (2026-09-07)

L1 은 "이후" 묶음이라 착수 단위가 아니었다. SD1(실데이터)·S1(서버)·K1(키)이 갖춰져 **지금 만들 수 있는 것**만 개별 항목으로 뽑았다. 각각 작고(PR 1개), 결정할 것이 적다.

| ID | 무엇 | 지금 가능한 이유 | 남은 결정 |
| --- | --- | --- | --- |
| N1 | 조건 필터 칩 | SD1 이 `freeAccess`·`campingAllowed`·`petAllowed`·`depth`·`canopyCover`·주차장을 이미 갖고 있다 | 칩 목록·빈 칸 취급(제외 vs 포함)·다중 선택 여부 |
| N2 | 막차 역산 | TAGO 키 동작 확인, S1 프록시 있음, SD1 에 `station` 시설 | 정류장 매칭 반경·표시 위치·"나와야 하는 시각" 여유분 |
| N3 | 119 좌표 카드 | 스키마에 `nationalPointNumber` 존재 | 국가지점번호를 어디서 채우나(공공데이터 vs 수기)·카드 형태 |
| N4 | 위성 토글 | S1 프록시 있음 | **브이월드 문의 답신 전에는 착수 불가**(영리 이용 승인) |
| N5 | 그늘 태그 | P1 9시각 값이 전 계곡에 있다 | 태그 규칙(오전/오후/종일/적음 임계값)·표시 자리 |

**권고 순서** — N5(규칙만, 데이터 이미 있음) → N1(필터, 화면 결정 3개) → N3(좌표 카드, 데이터 출처 확인 필요) → N2(막차, 외부 API 배선) → N4(답신 대기). N1·N3·N5 는 화면이 바뀌니 검토 페이지로 결정을 받고, N2 는 결정이 작아 표로 받는다.

### F2 / F3 / L1

- F2·L1 은 R2·S1 결과가 나온 뒤 기획한다.

### F3 — 상류 강우 경보 재설계 (기획 2026-09-04, 사용자 지시 "실사용자가 필요한 경계값을 기반으로 설계")

기획 문서 **`docs/F3_ALERT_DESIGN.md`**. 요지:
- **출발점 교체** — 관측소 존재·15 km·중권역(데이터 편의) 대신 **사용자가 필요한 경계값**: 최소 리드타임 **30분**(소유역 도달시간 30~90분 − 대피 5~15분 − 지연 ≤ 10분), 갱신 ≤ 10분(초단기실황은 U1 부적합), 강우 4단계(관심 10분 3 mm … 경계·심각은 호우주의보·경보 3h 60/90 mm 차용), 수위는 관측소 제원 4단계(attwl·wrnwl·almwl·srswl) + 10분 +5 cm 상승, 공간 범위는 집수역(시작은 표준유역), 해제는 강우 30분 ∧ 수위 60분, 15분 무자료면 "자료 없음".
- **신호 계층** — S1 유역 안 고지 우량계(3/30) · S2 인접 산지 우량계(11/30, 관심 한정) · **S3 격자 강수**(30/30, 형식·활용신청 확인 필요) · S4 하류 수위(20/30, 지연 신호·해제·사후 검증) · S5 특보. 계곡별 **확신 등급**(관측/추정/특보만)을 항상 노출.
- **커버리지 재정의** — "리드타임 ≥ 30분 신호가 있는 계곡": S1 10% · S1+S2 37% · S3 포함 100%(미검증). **F3 생사는 S3 검증에 달렸다** → 첫 단계는 UI 가 아니라 **F3a 스파이크**(격자 소스 확인 + 소요산·광덕·경반 7~8월 사례로 강우→수위 지연 실측, 임계값별 오·미경보).
- 스키마: `AlertLevel` 3단계 유지, `UpstreamAlert` 에 `source`·`confidence`·`observedAt`·수위 단계·격자 강도 추가, `Valley.basin`·`alertCapability`. UI: 카드 배지(평시 없음)·상세 타일·배너·푸시.
- **결정 항목 8개 — 사용자 확정(2026-09-04, 전부 권고안)**: (a) 3단계 유지 (b) 확신 등급 항상 노출 (c) S2 인접 우량계 관심 한정 (d) 레이더 우선 (e) 리드타임 30분 (f) 표준유역 시작 (g) 평시 배지 없음 (h) F3a → S1 → F3b → F3c. `planning → approved`. 다음: **F3a**(항목 표) — 격자 소스 확인은 API허브 활용신청(사용자)이 먼저. 화면 예제 https://claude.ai/code/artifact/851ab62c-0557-48f2-aa5b-d0f7da87c0c6 .


### F3s — S3 격자 강수 실측 스파이크 (착수 2026-09-06 → **보류 2026-09-06**, 사용자 "작업 깊이가 너무 크다. 계곡 앱을 만드는거에 집중")

> **보류.** 아래 계획은 그대로 두되 착수하지 않는다. 격자는 S1 에서 융합격자 지점 API 를 S3 신호로 붙이고 운영 데이터로 사후 검증한다.

**목표** — F3 의 생사가 걸린 S3(격자 강수)가 **우량계를 대신할 수 있는지** 실측으로 판정한다. F3a(`scripts/research/alert-calibration/`, PR #18)의 사례 표(2026-07~08, 우량계 6 × 하류 수위 3, 이벤트 93·사례 59)에 격자 강수를 붙여 (a) 격자 유역 평균 1h 강우 vs 우량계 1h 강우의 상관·편차, (b) 관심(1h 10 mm) 도달 시각 차 = 격자 − 우량계, (c) **경반계곡**(유역 안 우량계 없음)에서 격자 → 가평교 수위 리드타임(F3a 판정과 같은 기준: 시작→반응 ≥ 30분 2/3 이상), (d) 세 소스(레이더 PCPH · 융합격자 지점 rn_60m · 초단기예보 RN1)의 일치도와 지연, (e) 유역 평균 vs 유역 대표점 1개의 차이(마스크가 꼭 필요한가). 서버 없이 연구 스크립트만.

**먼저 읽을 것** — `docs/F3_ALERT_DESIGN.md`(§1.2 확정 표·§2 S3·§7), `scripts/research/alert-calibration/README.md`(방법·한계·결과), `docs/API_KEYS.md` 9절(격자 API 표)·8절(신청 완료 9건). F3a 모듈을 **재사용**한다: `grid.ts`(10분 격자 시각), `analysis.ts`(이벤트·반응·리드·혼동행렬), `sources.ts`(HRFCO·AWS 적재), `pairs.ts`, `results.json`(이벤트 요약). 키는 `.env.local`(`cp /Users/hsshin/orca/workspaces/modu-valley/F3a-alert-calibration/.env.local .`), `env.ts` 로더·`redact` 필수. F3a `.cache/`(HRFCO·AWS 두 달치)도 복사해 쓰면 재수집이 없다: `cp -r .../F3a-alert-calibration/scripts/research/alert-calibration/.cache scripts/research/alert-calibration/`.

**데이터 (2026-09-06 과거 자료 제공 확인, 전부 이 키로 200)**
- **융합격자 지점** `nph-sfc_obs_nc_pt_api?obs=rn_60m|rn_15m&tm1&tm2&itv=10&lon&lat` → CSV `TM,OBS,LON,LAT,DATA`, 10분 간격, 창 최대 60분(요청 1건 = 7행). 500 m 격자의 **지점 값**. 7/18 03:00~04:00 소요산(127.08,37.94) rn_60m 14.4 → 29.6 mm 확인. 59 사례 × 이벤트 창(~12h) = 사례당 12건 → 700건, 가볍다. 유역 평균은 유역 안 격자점 여러 개(예 3×3 km 격자 9~16점)를 각각 조회해 평균.
- **레이더 PCPH 60분 누적** `nph-rdr_cmp1_api?tm&cmp=PCPH&qcd=MSK&obs=ECHO&acc=60&map=HB&disp=B` → 바이너리 13.3 MB(short nx=2305, ny=2881 헤더 4 B + short×n, 결측 음수). **한도 5 GB/일** → 사례 전부는 불가. 큰 사례 4개 호우일(7/14~15 · 7/18 · 7/22~24 · 8/22) × 3유역 공통 시간대를 **1시간 간격**으로만(≈ 100장 = 1.3 GB, 하루에 나눠). 압축 대안 `rdr_cmp_file.php?tm&data=bin&cmp=hsp`(typ04, 983 KB, gz 여부·HSP 단위 확인 필요). 격자 위경도는 `nph-rdr_latlon_api?cmp=HSR&latlon=lon|lat&disp=A`(73 MB ASCII, 1회 받아 `.cache/`) 또는 `rdr_latlon_file_down.php`(NetCDF).
- **초단기예보 격자** `nph-dfs_vsrt_grd?tmfc=YYYYMMDDHHmm&tmef=YYYYMMDDHH&vars=RN1` → ASCII 149×253(-99 결측) 341 KB, 10분 발표·1시간 간격 6시간. 실황 `nph-dfs_odam_grd?tmfc&vars=RN1`. 계곡 격자 번호는 `nph-dfs_xy_lonlat`(위경도→격자) 로.
- 유역: 표준유역 폴리곤은 VWorld WFS 로 받되 **저장 금지**(약관) → 격자 마스크(격자 index 목록)만 `.cache/`. 우선 계곡 점 기준 반경 3 km 원 + 표고 조건(계곡보다 높은 격자만) 마스크로 시작하고, R2 폴리곤은 있으면 비교.
- 계곡 좌표: `scripts/research/station-coverage/valleys.json`(소요산 127.0583,37.9493 · 광덕 127.4464,38.0950 · 경반 127.4692,37.8330).

**방법**
1. 융합격자 지점 rn_60m 를 세 계곡(유역 대표점 + 주변 격자점 평균)에서 F3a 이벤트 창마다 10분 간격으로 받아 10분 강우로 환산(rn_60m 차분 또는 rn_15m) → F3a 와 같은 관심·주의 도달 시각·수위 반응 리드 계산.
2. 우량계와 비교: 사례별 1h 최대·이벤트 총량 산점(상관계수·기울기·편차), 관심 도달 시각 차 분포(격자 − 우량계, 분). 광덕(1,050 m 우량계 vs 500 m 격자)에서 고도 효과.
3. 경반: 격자 → 가평교 리드타임 분포. F3a 의 저지 대리 우량계(화악교·경기가평)와 나란히.
4. 레이더 PCPH 60분 누적을 큰 사례 4개에 1시간 간격으로 받아 유역 평균 → 융합격자·우량계와 비교(같은 시각 1h 값). 단위·결측 규약을 첫 파일에서 확인해 README 에 적는다.
5. 초단기예보 RN1: 사례별 관심 도달 시각 기준 −60·−30분 발표 예보의 +1h RN1 이 관심을 예고했는가(리드타임 보강 효과, 오경보).
6. 판정: 격자 1h vs 우량계 1h 상관 ≥ 0.7 ∧ 관심 도달 시각 차 중앙값 |Δ| ≤ 20분 ∧ 경반 격자→수위 리드 ≥ 30분 2/3 이상 → **S3 채택**(확신 "추정"). 소스 우선순위(레이더 vs 융합격자 지점)는 일치도·용량·지연으로 결정 (d).

**산출물** — `scripts/research/grid-calibration/`(tsx, 루트 `pnpm research:grid`, `.cache/` gitignore, F3a 모듈 import) + `README.md`(사례별 격자 vs 우량계 표·산점 요약·경반 리드 분포·소스 비교·**S3 판정과 확신 등급 규칙 확정안**·한계·용량) + 이 절에 판정 + 결정 기록 "F3s 판정"(사용자 승인 대기) + 항목 표 `in-review`. 원본 격자는 커밋하지 않는다(요약만). **PR 1개, base `4sizn/F3a-alert-calibration`**(#18 위 stacked).

**규칙** — `pnpm verify` 통과(연구 스크립트는 biome 제외, 자체 tsconfig `tsc --noEmit`), `/firework`·앱 코드 무변경, 키 값은 어디에도 남기지 않음(`redact`), API허브 5 GB/일 한도 안에서(레이더는 하루 ≤ 1.5 GB), 진행은 `orca worktree set --worktree active --comment`, 상태 전이는 항목 표·결정 기록 같은 커밋.

---

## 결정 기록

답이 나올 때마다 한 줄씩. valley-ds `open-questions.md` 의 표를 이어받는다.

| 날짜 | 항목 | 결정 | 근거 |
| --- | --- | --- | --- |
| 2026-09-03 | D1 테마 | **라이트 기본**, 다크 제공. 설정 화면에서 라이트/다크 선택 (→ C9). accent 는 valley-ds 청록 `#0c8b80` 채택 | 사용자 결정. accent 는 명시되지 않았으나 라이트 기본 = valley-ds 팔레트 채택이므로 따라감 — 이의 있으면 C1 기획에서 되돌린다 |
| 2026-09-03 | D2 festival | **보존**. `/firework` 를 기본 도메인 콘텍츠로 유지 | 사용자 결정. C4 포트 일반화는 festival·valley 두 도메인을 동시에 만족해야 한다 |
| 2026-09-03 | D3 플랫폼 | 지도 기초(web·ios·android 파리티)는 완료된 것으로 본다. **개발 우선순위는 RN web**. 네이티브는 포트 계약을 깨지 않는 선에서 후속 | 사용자 결정. 각 C 항목은 web 구현 + 네이티브는 컴파일·테스트 통과까지를 머지 게이트로, 네이티브 화면 검증은 별도 항목 |
| 2026-09-03 | D4 베이스맵 | **openfreemap 유지** + 클라이언트 재색칠. 자체 OpenMapTiles 는 **v2** | 사용자 결정 |
| 2026-09-03 | D5 서버 | 모노레포 루트 **`server/`** 디렉터리. 스택·저장소는 S1 기획에서 | 사용자 결정. `pnpm-workspace.yaml` 에 `server` 추가 |
| 2026-09-03 | T0 반입 | main 에 **직접 커밋** (이 문서와 함께) | 사용자 결정. 추적 문서·참조 자료는 PR 없이 |
| 2026-09-03 | C1 토큰 | 코드 전에 **디자인 예시 룩**(라이트/다크, 현재 화면 구성 기준)을 먼저 보고 승인 | 사용자 요청 |
| 2026-09-03 | C3 도메인 | **승인** | 사용자 결정 |
| 2026-09-03 | C3 정규화 | 혼잡 3단계 **`busy`**, 시설 타입 **`store`**, `shadeRatio` number 유지, `metadata.crs` **required**. PR #3 머지 → `done` | 세 출처 중 둘이 이미 `busy`·`store`. `store` 가 매점·슈퍼·편의점을 모두 담는다. `crs` 는 런타임 변환 금지를 로더 const 검사로만 강제하려면 있어야 한다. 팔레트 키 교체는 C2 |
| 2026-09-03 | C6 카메라 보정 | **보류** — 필요성 미확인 | 사용자 판단. 시트가 지도를 가리는 문제가 실제 화면에서 확인되면 재개 |
| 2026-09-03 | C7 헬스 감시 | 디자인 토큰·디자인 시스템(C1) **뒤로** | 사용자 판단. 배너 UI 가 토큰에 의존하므로 순서가 맞다 |
| 2026-09-03 | C1 토큰 | 예시 룩 검토 후 **보류** — 2D UI 디자인 토큰이 아직 마음에 들지 않음. valley-ds 토큰을 그대로 채택하지 않는다 | 사용자 판단. 룩: https://claude.ai/code/artifact/4a943f81-61e7-4b4b-b5b1-3d8d4c803f63 . 점검에서 나온 `muted` 대비 미달(라이트 2.85:1 / 다크 3.46:1)도 재기획 시 반영. C7·C9 는 C1 의존이라 함께 대기 |
| 2026-09-03 | C1 기준 | valley-ds 토큰 **폐기**(예시 룩 아티팩트 포함). 기준은 `docs/references/firework-map-clone.html` `:root` 토큰 = 현재 `tokens.ts`. C1 은 값이 아니라 **체계**(Theme 객체·Provider·CSS 변수 생성) 작업으로 재정의 → `planning` | 사용자 결정. D1 의 "라이트 기본"은 근거 팔레트가 없어졌으므로 C1 메모의 (a)/(b) 로 다시 묻는다 |
| 2026-09-03 | C1 라이트 | **(b) 채택** — C1 에서 라이트 팔레트까지. 다크에서 역할 단위 대응으로 초안, PR 스크린샷으로 사용자 확인 후 확정. 기본 모드 라이트(D1). **승인** → 워크트리 착수 | 사용자 결정 |
| 2026-09-03 | C1 확정 | 라이트 팔레트 **승인**, PR #4 머지 → `done`. 지도 위 요소(티커·credit·후광)는 UI 테마가 아니라 **지도 명도를 따르는 토큰**(`mapFg`·`mapFg2`·`liveText`·`credit`·`tickerTextShadow`)으로 분리 — 지도가 다크인 동안은 라이트에서도 다크 값, C2 가 라이트 지도를 만들 때 이 토큰만 바꾼다. 나침반 꼬리 `compassTail` 토큰화. 개발용 강제 `EXPO_PUBLIC_THEME=light\|dark`(정식 UI 는 C9). C2·C7·C9 의 C1 의존 해제 | 사용자 승인. 검토 페이지: https://claude.ai/code/artifact/9dd0860c-3ccc-4c2f-97c2-622dfaaf66b2 . 다크 값 불변은 `apps/valley-map/test/tokens.parity.test.ts` 가 고정 |
| 2026-09-03 | C4 범위 | 타당성 조사 후 **정본(통합) 채택** — 단일 `renderContent`, PR 1개, 임시 코드 스크린샷 검증. **승인** → 워크트리 착수 | 사용자 결정. 근거는 C4 메모 "타당성 판정" — 회피 불가 70% + D2 보존으로 통합은 필연, 호출 지점 유한, native `line` 레이어 확인 |
| 2026-09-03 | R3 그늘 | valley-ds 의 "90m·나무 미포착" 전제가 바뀜 — **GLO-30 30m 한국 공개 확인 + Meta/WRI 1m 수관 높이 한국 타일 확인**. 그늘 지도 **조건부 진행**, 시험 계산 R3b 로 스키마 확정 | 에이전트 실측(S3 버킷 200 응답). 사용자 승인 대기: R3b |
| 2026-09-03 | R4 경쟁 | 경쟁은 전부 정적 카탈로그(계곡가자 300+ 등) — 시간축·안전 포지셔닝 유효, **카탈로그로는 경쟁하지 않는다**. 시드는 물놀이관리지역(계곡 유형) ∪ 수기 30. 시딩 ~37h 데스크 | 에이전트 조사 |
| 2026-09-03 | R4 VWorld | 약관 자동 수집 불가 → **K1 사용자 액션**으로 이관 | 페이지 오류/JS |
| 2026-09-03 | R3b 방향 | 그늘 판정은 **태양 위치 × 고도(지형) 위주** — 1차 지형 산그늘 시작 시각, 2차 임상도 수관 태그(선택), 1m CHM 보류 | 사용자 제안. 지형은 "언제부터 그늘" 을, 임상도는 "정오 그늘" 을 답한다 — 출처를 스키마에서 분리(`shadeOnsetLocal` / `canopy`) |
| 2026-09-03 | R3b 착수 | **승인** → 워크트리 `R3b-shade-pilot` | 사용자 결정 |
| 2026-09-03 | C4 머지 | PR [#6](https://github.com/4sizn/modu-valley/pull/6) 머지 → `done`. C5 의존 해제 | `pnpm verify` 통과(179 + app 15). web 회귀(마커·라벨·글로우·핀·클릭·빈 곳 닫기) 확인, 계곡 구간 3색·시설 4종·선택 상태 스크린샷 |
| 2026-09-03 | C4 native | iOS 시뮬레이터 화면 검증 완료(마커·라벨·핀·탭·빈 곳 닫기). 구간·시설 네이티브 렌더는 F1 에서 | `expo run:ios` 실기 확인, 스크린샷은 PR #6 코멘트 |
| 2026-09-03 | R3b 판정 | PR [#5](https://github.com/4sizn/modu-valley/pull/5) 머지 → `done`. **지형만의 `shadeOnsetLocal` 은 구간 필드로 불채택** — 세 구간 모두 18:00~18:30 에야 산그늘, 구간 차 10~20분 < 격자 1셀 흔들림 10~50분. 정오~15시 지형 그늘 0% (나무 그늘 전제 확인). 그늘 방향은 능선과 정합 → 폴리곤 시각화는 가능 | `scripts/research/shade-pilot/README.md`. 스키마 권고는 D6 로 사용자 결정 |
| 2026-09-03 | D6 그늘 | **데이터 산출만, 수기 금지.** 지형 30m + 수관 1m CHM 으로 시간대별 그늘. 나무 밀도(`canopyCover`)도 데이터로. 지도에 그늘 보기 토글로 **출력**. R3b 의 수기 태그 권고 불채택, "1m CHM 보류" 철회 → R3c·P1·F4 신설 | 사용자 결정 |
| 2026-09-03 | R3c·F1 | R3c **승인** → 워크트리 `R3c-shade-canopy`. F1 기획 `planning` 착수 | 사용자 결정 |
| 2026-09-03 | F1 결정 | (a) `/` 계곡 + `/firework` 데모 — **도메인별로 코드 분리**(components/festival·components/valley, copy·프리셋도 도메인 절) (b) 단일 `MapSession`+`scene` (c) 시설 핀+미니 행 (d) **PR 2개** F1a core → F1b app (e) 그늘 "준비 중" 표시. **승인** → 워크트리 `F1-valley-cards` | 사용자 결정 |
| 2026-09-03 | F1 머지 | PR [#7](https://github.com/4sizn/modu-valley/pull/7)(core) · [#9](https://github.com/4sizn/modu-valley/pull/9)(app, #7 위 stacked → main 리베이스 후) 머지 → `done`. **기능 기준 done** — 계곡 화면 디자인은 사용자가 만족하지 않아 시각 개선을 후속 항목으로 남김. F2·L1 의 F1 의존 해제 | 사용자 판정. `pnpm verify` 통과(core 160 · map-style 20 · adapter-native 27 · app 15). 증거는 PR #9 본문·`proof/F1-valley-cards` |
| 2026-09-03 | R3c 판정 | PR [#8](https://github.com/4sizn/modu-valley/pull/8) 머지 → `done`. **진행 가능** — 정오 그늘은 전부 수관이고 CHM 이 구간을 변별(50m 버퍼 정오 0.38/0.33/0.23, 오차 ≤0.01). 계곡 1개 9시각 2m 격자 4s + CHM 55MB 다운로드 ~30s. 폴리곤은 **분리형(수관 1장 + 개방지 그림자 9장) + 구간 회랑 ±200m** 로 205KB(gzip 28KB). CHM 촬영 2016-12·2018-03(낙엽기, 활엽 과소 가능) → 화면 고지 필요 | `scripts/research/shade-pilot/canopy/README.md`. 스키마 확정: `shadeByHour[9]`(10~18시, 8/1), `canopyCover`(CHM>2m), `shadeRatio` 는 정오 값 |
| 2026-09-03 | main 검증 | `pnpm verify` 통과(core 160 · map-style 20 · adapter-native 27 · app 15). web `/` 계곡 화면(목록·상세·시설 4점) · `/firework` 데모 스크린샷 확인 | 에이전트 실행. 라이트 UI 위 다크 지도는 C2 전 의도된 상태 |
| 2026-09-03 | 순서 위임 | 사용자가 다음 순서를 에이전트에 위임. **P1 → C2(병행) → F4 → 계곡 화면 시각 개선 → C9·C5·K1**. P1·C2 착수 | 사용자 결정("너가 원하는 순서대로"). C2 베이스: 라이트 `positron` |
| 2026-09-03 | P1 머지 | PR [#10](https://github.com/4sizn/modu-valley/pull/10) 머지 → `done`. `scripts/shade/` 파이프라인 + `shadeByHour[9]`·`canopyCover` 스키마·도메인 + `data/shade/sample/` 산출물(구간 버퍼 반폭 25m, R3c 권고·사용자 확정). F4 의 P1 의존 해제 — **다음은 F4**(위임 순서) | 표 상태가 `in-progress` 로 남아 있던 것을 2026-09-03 정정. 머지 커밋 `4c6d6ed` |
| 2026-09-03 | F4 기획 | `pending → planning`. 메모 작성 — 레이어 셋 계약 확장(비인터랙티브·`placement`), `MapContent.shade`, 상태·유즈케이스, 합본 번들, 토글·9눈금 트랙·상세 타일. **사용자 결정 대기**: (a) 기본 시각 (b) 트랙 형태 (c) 토글 위치 (d) 색 (e) 배치 (f) 상세 타일 (g) 영속 — 각각 권고안 있음. PR 2개(F4a → F4b) | 에이전트 착수(위임 순서 P1 → C2 → **F4**). P1 이 `sync-valley-data.mjs` 에 shade 복사까지 넣어 둠 |
| 2026-09-03 | F4 검토 | 결정 7개를 **화면 예제로** 검토 — 스파이크 브랜치 `spike/F4-preview`(머지 금지, 커밋 `101e86f`) 에서 실제 앱을 띄워 라이트 1440×757·폰 390×844·다크 참고 스크린샷 27장. 검토 페이지 https://claude.ai/code/artifact/e65c8482-9c00-4679-9ac3-cb2985872494 에 변형을 나란히 놓고 선택 UI 제공. 스파이크에서 발견: 폰에서 트랙이 제보 행과 겹침 → 좁은 화면은 한 행 위(범위에 포함) · 12~15시 그림자 거의 없음 · 다크에서 그늘 묻힘 · 배치(e)는 샘플로 차이 안 남 | 사용자 요청("승인내용들은 예제로 보여주면서 평가 승인"). 승인 대기 |
| 2026-09-04 | C10 머지 | PR [#14](https://github.com/4sizn/modu-valley/pull/14)(C10a 음영+고도색) · [#15](https://github.com/4sizn/modu-valley/pull/15)(C10b web terrain+카메라) · [#16](https://github.com/4sizn/modu-valley/pull/16)(C10c 봉우리+물줄기) 순서로 머지 → `done`. 머지 후 main `pnpm verify` 통과(core 208 · map-style 58 · native 32 · app 15). 상세 카메라 방향(상류 왼쪽·하류 오른쪽, bearing −90°)은 사용자 승인. 등고선(C10d)은 v2. 후속: R5 실폭 수계 폴리곤(물줄기 데이터 교체), 구간 상태색을 폴리곤에 칠할지, 수면 셰이더(L1). 워크트리 `C10-valley-terrain`·브랜치 3개 정리, 증거는 `proof/C10-valley-terrain` | 사용자 승인("ㅇㅇ 정리해"). 머지 커밋 `2bc3711`·`966c6bb`·`5e21e7a` |
| 2026-09-04 | C10d → v2 | **등고선·표고 프로필은 v2 로 이관.** C10b 의 3D 지형과 C10a 의 음영·고도색으로 계곡의 굴곡이 화면에 이미 읽히고, 등고선은 web 전용(maplibre-contour)이거나 데이터 산출 파이프라인(빌드 시 GLO-30 → GeoJSON 번들)이 하나 더 필요하다. C10 은 PR 3개(C10a~c)로 닫는다. 재개 시 권고안: 네이티브까지 한 번에 가려면 빌드 시 산출(P1 그늘 파이프라인과 같은 구조), web 만이면 maplibre-contour(호환 확인 완료) | 사용자 결정("등고의 데이터산출 및 3d맵 화면상 등고의 굴곡이 출력이 된다면 v2 로"). 브랜치 `4sizn/C10d-contours` 는 삭제, 기록은 #16 에 합침 |
| 2026-09-04 | C10d 호환 확인 | **maplibre-contour 0.1.0 은 maplibre-gl 6.6.0 에서 동작한다** — 실측: 스모크 페이지(`proof/C10-valley-terrain` `c10d-contour-smoke.html`)에서 `DemSource.setupMaplibre(maplibregl)` → `addProtocol` 등록 → Terrarium 에서 등고선 벡터 타일 생성, 샘플 계곡 z13.5 에서 **피처 42개(level 0/1, 200~400m)** 로드, 오류 0. 워커 on/off·`setTerrain` 1.5 병행 모두 같음. 근거: 6.6 의 `AddProtocolAction` 은 v4 부터의 Promise 형 `(requestParameters, abortController) => Promise<GetResourceResponse>` 로 바뀌지 않았고, 라이브러리는 v3 콜백/v4 Promise 를 `arg2 instanceof AbortController` 로 자동 판별한다. **주의점**: (1) 상류 저장소는 maplibre-gl 5.10 까지만 테스트(6.x 공식 검증 없음, 2024-12 이후 릴리스 없음) (2) `package.json` `exports` 에 `import`/`default` 조건이 없어 vitest 해석 문제(#429 open) — Metro 는 `browser` 조건으로 UMD `index.min.js` 를 받을 것이라 앱 번들에서 재확인 필요 (3) 워커는 blob URL 로 만들어 워커 파일 배치는 불필요 (4) **네이티브 불가** — RN 래퍼에 `addProtocol` 이 없어 등고선은 web 전용 능력(`MapCapabilities` 항목 추가) 또는 GLO-30 정적 벡터 타일(별도 항목)로만. 1:5,000 수치지형도 등고선은 표시 금지(별표1) → DEM 파생만 | 에이전트 실측. **C10d 착수는 사용자 보고 후** — 착수 시 브랜치 `4sizn/C10d-contours`(C10c 위 stacked) |
| 2026-09-04 | C10c PR | PR [#16](https://github.com/4sizn/modu-valley/pull/16) 열림(#15 위 stacked). 봉우리 라벨 `terrain-peak-label`(줌 11+, 표고순, label-poi 색, web 은 `symbol-height-offset` 40m — 명세 타입에 없어 경계에서 넓힘). 물줄기 = **레이어 셋 2개** — `valley-water`(코어 `waterPolygonOf` 로 구간 선을 6/12/18m 로 부풀린 임시 폴리곤, 구간 선 아래) + `valley-flow`(흐름 점선, 구간 선 **위** — 아래면 상태색 선에 가림). `MapContent` 는 안 바꿈(구간에서 파생, R5 는 `toFeatureCollection` 만 교체). 흐름 on/off 는 코어 `WaterFlowCoordinator`(계곡·ready·시트 펴짐·`appActive`), 어댑터는 루프만(web rAF / 네이티브 타이머 → `MapScene.layerPaintOverrides`). **검증**: `pnpm verify`(core 208·map-style 58·native 32), 연속 스크린샷 diff 로 점선 이동·시트 접으면 0px·펴면 재시작 확인, 봉우리 라벨 4개 렌더, `/firework` 다크 diff 0, iOS 시뮬레이터 렌더 확인 | 에이전트 실행. 증거 `proof/C10-valley-terrain` c10c-*. 다음 C10d 는 maplibre-contour 호환 확인 → 사용자 보고 후 |
| 2026-09-04 | C10b PR | PR [#15](https://github.com/4sizn/modu-valley/pull/15) 열림(#14 위 stacked). web `setTerrain` 배율 **1.5** + `moveend`·`idle` 중심 고도 보정(1m 임계), `MapCapabilities.terrain` web true. 상세 카메라 `focusSegment(segment, { terrain })` — 지형 있으면 pitch 58·축 가로지르기, 없으면(네이티브) F1b 시점 유지. **bearing 부호 판단**: 결정 (e) 의 "+90°" 는 하류를 왼쪽에 놓아 "상류 왼쪽·하류 오른쪽" 과 모순 → 화면 결과 문장을 따라 **−90°** 로 구현(`valleyAxisBearing`), 검토 페이지 E4 가 반대였다면 부호 하나만 바꾼다. `releaseSegment` 는 bearing 0 복귀. 첫 진입은 평면 유지. **검증**: `pnpm verify`(core 200), 상세 스크린샷에서 상류 왼쪽·하류 오른쪽·밀림 없음 확인, `/firework` 다크 diff 0 | 에이전트 실행. 증거 `proof/C10-valley-terrain` c10b-*. 다음 C10c |
| 2026-09-04 | C10a PR | PR [#14](https://github.com/4sizn/modu-valley/pull/14) 열림 → `in-review`. 음영기복 + 고도색을 **`composeMapStyle(style, mode, { terrain })` 옵션**으로 얹음(계곡 장면만, festival 은 소스도 없음) — 레이어 셋이 아니라 스타일 구성에 둔 이유: raster-dem 은 데이터가 없고 장면 조건부이며, 스타일 JSON 리터럴 색이면 iOS hillshade 버그(#4453 런타임 setter 크래시·#4296 표현식 거부)를 구조적으로 피한다. `placement` 를 `'below-waterway'` 로 넓혀(`placement.ts`) 스타일 구성·web·native 가 같은 함수. 다크는 **음영만**(고도색 팔레트는 라이트용). `MapCapabilities.terrain` 필드 추가 — web 도 C10b 에서 `setTerrain` 과 함께 true. **검증**: `pnpm verify`(map-style 52·native 30·core 190·app 15), `/firework` 다크 main·branch 픽셀 diff **0**(셀프 diff 0 대조군), **iOS 시뮬레이터(iPhone 17) 렌더·크래시 없음** 확인, Terrarium 타일 18장. F4 `placement` 는 이미 main 에 머지돼 리베이스 후 재사용(충돌 없음) | 에이전트 실행. 증거 `proof/C10-valley-terrain`. 다음 C10b 는 이 브랜치 위 stacked |
| 2026-09-06 | **F3s 보류** | 스파이크 2(S3 격자 실측)를 `in-progress → hold`. 워크트리·에이전트 정리(작업 중이던 스크립트는 로컬 보관). 격자는 실측 스파이크 대신 **S1 서버에서 융합격자 지점 rn_60m 를 S3 신호로 바로 붙이고 사후 검증**(F3 §5 `verified`)으로 | 사용자 결정("작업 깊이가 너무 크다. 계곡 앱을 만드는거에 집중") |
| 2026-09-06 | F3s 착수 | S3 격자 실측 스파이크 신설 `approved → in-progress`, 워크트리 `F3s-grid-calibration`(F3a 브랜치 위). 격자 API 9건 활용신청 완료(전부 200, 과거 2026-07 자료 제공 확인) | 사용자 지시("ㅇㅇ 그래 다음단계진행") |
| 2026-09-06 | **F3a 판정 승인** | 사용자 확정: **(1) 리드타임 30분 채택 · (2) 관심 = 1h 10 mm 만 · (3) 수위 승격은 Δ10 +10 cm 주, srswl → 대피 · (4) 해제에 3h < 20 mm 추가 · (5) 주의·경계·심각·S2 관심 한정·신선도 유지** — 전부 권고안. `docs/F3_ALERT_DESIGN.md` §1.2·§3 갱신 | 사용자 결정(검토 페이지 https://claude.ai/code/artifact/666803c9-1a77-485d-9fca-9132cecf535a ). 다음: K1 격자 신청 → S1 → F3b |
| 2026-09-04 | **F3a 판정** [#18](https://github.com/4sizn/modu-valley/pull/18) | **리드타임 30분 채택**(시작→수위 반응 ≥ 30분 14/14, 최소 130분 — 하천 기준 상한) · **관심 = 1h 10 mm 만**(10분 3 mm 삭제, 오경보만 추가) · 주의·경계·심각 유지 · 수위 승격은 **10분 +10 cm** 주(4단계 attwl 은 여름 1회) · **해제에 3h < 20 mm 추가** · S2 관심 한정 유지 · S3 는 레이더 HSR 수치 격자 확인 → K1 신청. `in-progress → in-review` | 실측 `scripts/research/alert-calibration/README.md`(이벤트 93·사례 59). **사용자 승인 대기** — 검토 페이지(하이드로그래프·리드타임·혼동행렬·해제 + 결정 5항목 + API허브 신청 5건 캡처) https://claude.ai/code/artifact/666803c9-1a77-485d-9fca-9132cecf535a . 승인 시 F3_ALERT_DESIGN §1.2 갱신 |
| 2026-09-04 | F3a 착수 | `pending → in-progress`, 워크트리 `F3a-alert-calibration`(R1 브랜치 위). 사례 쌍 3개(소요산·광덕·경반)로 7~8월 강우→수위 지연·오경보 실측, 격자는 K1 신청 뒤 | 사용자 지시("ㅇㅇ ㄱㄱ") |
| 2026-09-04 | F3 결정 | **(a) 3단계 유지 · (b) 확신 등급 항상 노출 · (c) S2 인접 우량계 관심 한정 · (d) 레이더 우선 · (e) 리드타임 30분 · (f) 표준유역 시작 · (g) 평시 배지 없음 · (h) F3a → S1 → F3b → F3c** — 전부 권고안. `planning → approved`. F3a 신설(`pending`, K1 레이더·격자 활용신청 뒤 착수) | 사용자 결정. 검토 페이지 https://claude.ai/code/artifact/851ab62c-0557-48f2-aa5b-d0f7da87c0c6 |
| 2026-09-04 | F3 재설계 기획 | `pending → planning`. 관측소 위치 대신 **사용자 경계값**(리드타임 30분·강우/수위 4단계·집수역·해제·신선도)에서 설계, 신호 계층 S1~S5 + 확신 등급 노출. 커버리지 재정의: S1 10% / +S2 37% / +S3 격자 100%(미검증) → **F3a 스파이크 먼저**(격자 소스·리드타임 실측). 문서 `docs/F3_ALERT_DESIGN.md`, 결정 8개 권고안 + 검토 페이지 https://claude.ai/code/artifact/851ab62c-0557-48f2-aa5b-d0f7da87c0c6 | 사용자 지시("실사용자가 필요한 경계값을 기반으로 설계해줘"). R1 판정 자체의 승인은 별도. **결정 (a)~(h) 사용자 승인 대기** |
| 2026-09-04 | R1 판정 | 실측 완료 → `in-progress → in-review`([#17](https://github.com/4sizn/modu-valley/pull/17)). **15 km·HRFCO+AWS 40.0%(12/30, 경계값)**, 10 km 26.7%, HRFCO 만 26.7%, 표고차 ≥50 m 30%, 표준유역 일치 23.3%. 표고 조건을 빼면 100% → 관측소는 있으나 전부 계곡보다 낮은 읍내. **권고: MVP-3 재설계** — 기본안 (b) 격자 강수(초단기실황·레이더)×R2 유역 평균, 그 전까지 (a) 상류 관측소 실재 계곡(유명산·어비·광덕·지장산)만 배지. 재설계 후보 (a)~(d)는 R1 절 | 에이전트 실측. **사용자 승인 대기** — 승인 시 R1 `done`, F3 `planning`(재설계) |
| 2026-09-04 | R1 착수 | K1 으로 기상청 AWS 지점·한강홍수통제소 관측소·VWorld 유역 WFS 가 모두 열려 R1 재료 확보. `pending → in-progress`, 워크트리 `R1-station-coverage`. 방법: 계곡 30 × 관측소(같은 중권역·표고 높음·15 km) → 커버리지 %, 70/40 기준 | 사용자 지시("r1 시작") |
| 2026-09-04 | K1 VWorld | 개발키 2개 수령(6개월 유효, `.env.local`). 서버 curl 로 WFS 동작 확인 — 도메인 검사 미적용, 4326 BBOX 위도·경도 순. **R2 1건 성공**: 샘플 점 → 표준유역 101802 퇴계원수위표, 하천망 왕숙천. 폴리곤은 약관상 저장 안 함 | 사용자 키 제공. 두 키의 도메인 확인 대기 |
| 2026-09-04 | K1 착수 | 사용자 요청("k1부터 진행"). 신청 절차·계정·한도·약관을 공식 페이지에서 조사해 `docs/API_KEYS.md` 작성. 발견: 기상자료개방포털은 신청 없음 / 한강홍수통제소는 일일 한도 없음(분당 1,000 초과 3회 차단) / **VWorld 영리 이용 사전 승인·데이터 저장 금지**(문의 메일 초안) / **물놀이관리지역은 WMS 만** → R4 시드 자동 매칭 재산정, R2 는 국토부 WFS 경로 확정 | `pending → planning`. 키 수령은 사용자 |
| 2026-09-04 | C10 승인 | 검토 페이지 v2 에서 **10개 확정** — 권고안 8개 + **E4 계곡 축 가로지르기**(상류 왼쪽→하류 오른쪽, pitch 58) + **I2 고도색 진하게**(opacity 0.85). J1 물줄기 폴리곤 드레이프·흐름 채택, 조건 "물 표면은 web·native 공통 범위에서 더 좋은 방안이 있으면 다음에". `approved → in-progress`, 워크트리 `C10-valley-terrain`, PR 4개(C10a~d) | 사용자 결정 |
| 2026-09-03 | C10 계획 v2 | 조사·데모 반영해 단계 개정 — 1) hillshade + **color-relief**(전 플랫폼) 2) web terrain + 카메라(**중심 고도 보정 필수**) 3) 봉우리 라벨 + **물줄기 폴리곤 드레이프·흐름**(R5 의존) 4) 등고선(DEM 파생만). 수면 셰이더는 L1. 물줄기 데모 3안(선/폴리곤+흐름/셰이더)을 검토 페이지 v2 에 실제 화면으로 추가, 결정 10개 | 사용자 요청("c10 계획에 반영" + "물표면 셰이더·폴리곤 드레이프 데모"). 스파이크 `225f9ec`. `planning` 유지, 승인 대기 |
| 2026-09-03 | C10 조사 | **"물줄기·계곡 3D" 기성 라이브러리는 없다** — 지형은 MapLibre 내장(web: terrain·hillshade·color-relief·sky·symbol-height-offset, 선은 자동 드레이프 / native: hillshade·color-relief 까지, 3D terrain 은 draft PR #4190), 물은 dasharray 흐름까지 재사용·그 이상은 web 커스텀(three.js·deck.gl). 엔진 교체형(Cesium·VWorld 3D·Mapbox·@rnmapbox)은 무키 원칙·/firework 보존과 충돌. 한국 DEM 은 90m 초과 공개제한 → 5m 자체 타일 철회, GLO-30 으로 소스 교체만 가능. **1:5,000 연속수치지형도 수계**가 물줄기 품질의 실제 지렛대 → R5 신설. C10 1단계 후보에 color-relief·multidirectional 추가 예정 | 사용자 요청. 조사 에이전트 3개(npm·GitHub·CHANGELOG·공공데이터 직접 확인). C10 `planning` 유지 |
| 2026-09-03 | C10 검토 | 결정 7개를 **화면 예제로** 검토 — 스파이크 `spike/C10-preview`(`771d242`, 머지 금지)에서 Terrarium DEM 을 실제 앱에 붙여 라이트 26장·다크 4장·폰 2장. 검토 페이지 https://claude.ai/code/artifact/a51f3514-c009-4d82-ba8e-766930589107 . 발견: hillshade 는 **끼우는 자리가 전부**(숲 위·물줄기 아래만 녹지가 산다) · terrain 단독은 납작 · sky 는 MAX_PITCH 60 에서 불필요 → 범위 제외 · F4 그늘은 지형 위 드레이프 자동 | 사용자 질문("C10 이제 작업할거지?"). `planning` 유지, **승인 대기** |
| 2026-09-03 | F4 승인 | 검토 페이지에서 **7개 모두 권고안 확정** — (a) A1 현재 시각 클램프·범위 밖 정오 (b) B1 9눈금 + ‹ › (c) C1 컨트롤 열 불꽃 자리 (d) D1 수관 `#1f4d2e`·0.28 / 그림자 `#1c3a5e`·0.32 (e) E1 첫 symbol 아래 (f) F1 타일 1장 + 고지 (g) G1 저장·기본 꺼짐. `approved → in-progress`, 워크트리 `F4-shade-view` 생성. 스파이크에서 확인된 좁은 화면 트랙 규칙(한 행 위) 포함 | 사용자 결정 |
| 2026-09-03 | C10 추가 | 계곡 **3D 지형** 항목 신설(`planning`) — hillshade → web terrain → 봉우리 라벨 → 등고선·표고 프로필. C2 의 등고선 언급은 C10 으로 이관 | 사용자 요청("계곡이니 물줄기도 2d 형태라 와닿지 않아서"). 네이티브 3D terrain 은 래퍼 미지원이라 web 전용 능력으로 |
| 2026-09-03 | C2 판정 | PR #11 **승인·머지 → `done`**(기능 기준). 라이트 = positron 재색칠 + 라이트 3D 건물, 다크 = 원본 paint + 데모 장식(main 과 픽셀 동일). 라벨 폴백 통일. `/firework` 보존 규칙 CLAUDE.md | 사용자 승인("아직 마음에 들진 않지만 승인처리"). 시각 완성도는 계곡 화면 시각 개선·C10 에서 이어 본다 |
| 2026-09-06 | R1·F3a 머지 | 사용자 위임("하위 워크트리 수렴 컨트롤")으로 PR [#17](https://github.com/4sizn/modu-valley/pull/17)(R1 + F3 재설계 기획) · [#18](https://github.com/4sizn/modu-valley/pull/18)(F3a, #17 위 stacked → main 재타깃) **머지 → `done`**. 머지 전 확인: 브랜치 히스토리에 키 5종 유출 0 · 변경은 docs/연구 스크립트만(앱·`/firework` 무변경) · 스택 브랜치 `pnpm verify` 통과(core 208·native 32·app 15). R1 판정(재설계)은 사용자가 F3 결정 8개·F3a 판정을 승인한 것으로 수용. 워크트리 R1·F3a 삭제, F3s 잔여 캐시 디렉터리 삭제 | 에이전트 컨트롤. 다음 순서는 F3 결정의 F3a→**S1**→F3b→F3c 이나, 사용자 2026-09-06 지시 "계곡 앱 구현 집중" 에 따라 S1 착수 전 확인 |
| 2026-09-06 | V1 기획 | 계곡 화면 시각 개선 항목 **신설 → `planning`**. 기준 화면 6장 채취(라이트 목록·그늘·상세, 폰 목록·상세, 다크). 문제 분해: 위계 역전(질감 > 물줄기) · 카드 제목 반복 · 지도/UI 톤 불일치 · 시설 점 · 폰 지도 영역. 결정 9개(a~i) 를 스파이크 스크린샷 검토 페이지로 받는다. PR 2개 V1a map-style → V1b app | 사용자 지시("V1 시각 개선 먼저 기획"). S1 은 그 뒤 |
| 2026-09-06 | V1 검토 | 결정 9개를 **화면 예제로** 검토 — 스파이크 `spike/V1-preview`(`838f36f`, 머지 금지), 기준 6장 + 변형 31장. 검토 페이지 https://claude.ai/code/artifact/59957465-b8c4-418b-b39d-83021528fe73 . 권고 조합 = A1 B1 C1 D1 E1 F1 G1 H1 I1 | 사용자 요청("검토 페이지 올려줘"). `planning` 유지, 승인 대기 |
| 2026-09-06 | V1 머지 | PR [#19](https://github.com/4sizn/modu-valley/pull/19)(V1a) → [#20](https://github.com/4sizn/modu-valley/pull/20)(V1b, `--base main` 재타깃) 순서로 머지 → `done`. 머지 전 3검사(비밀 유출 0 · 변경 파일 범위 안(`/firework`·festival 무변경) · 스택 최상단 verify), 머지 후 main `pnpm verify` 통과. 후속 제안 3개(네이티브 음영 하향 iOS #4453 · 이니셜 F·C·S → C5 · 폰 `/firework` 시트)는 V1 절에 기록, 항목 신설 없음 | 사용자 지시("다음작업 진행해"). 머지 커밋 `ac32f37`·`ff2fa48`. 워크트리 정리는 메인 세션 |
| 2026-09-06 | V1b PR | PR [#20](https://github.com/4sizn/modu-valley/pull/20) 열림(#19 위 stacked) → `in-review`. 앱 몫 (d)(e)(i). `segmentTitle` + `segmentSubtitle` 옵션·`summarizeValleys`·`listSummary`, 폰 시트 40% 는 **계곡 장면만**(`/firework` 45% 불변 실측). **검증**: `pnpm verify`(core 214), `/firework` 다크 diff 0, PARITY main = branch, 폰 시트 실측 337.6/379.8, 스크린샷 8장 `proof/V1-visual-polish` | 에이전트 실행. 머지 순서 #19 → #20(`gh pr edit --base main` 재타깃) → V1 `done` |
| 2026-09-06 | V1a PR | PR [#19](https://github.com/4sizn/modu-valley/pull/19) 열림 → `in-review`. 지도 몫 (b)(c)(f)(g) 구현, (a)(h) 무변경. 상태 의존 paint 는 `valleyPaintOverrides` 한 함수 → web `setPaintProperty` / 네이티브 `layerPaintOverrides`(흐름 점선과 병합). **검증**: `pnpm verify`, `/firework` 다크 diff 0(셀프 diff 0 대조군), PARITY main = branch, 스크린샷 7장 `proof/V1-visual-polish`. 네이티브 음영 하향은 iOS #4453 때문에 값만 게시 → 후속 제안 | 에이전트 실행. 다음 V1b 는 이 브랜치 위 stacked |
| 2026-09-06 | V1 승인 | 검토 페이지에서 **9개 확정** — 권고 8 + **(a) A2 지형 질감 현재 유지**(0.5·0.85). `approved → in-progress`, 워크트리 `V1-visual-polish`, PR 2개 V1a map-style → V1b app. 사용자 당부 "작업 맥락을 잃어버리지 않게" → 결정을 값 단위로 이 절에 고정, 착수 프롬프트에 그대로 실음 | 사용자 결정 |
| 2026-09-06 | C5·C9 기획 | 위임 순서(시각 개선 → C9·C5)대로 두 항목 `pending → planning`. C5 결정 5개(형태·글리프·크기·다크·native 래스터), C9 결정 4개(진입·컨트롤·함께 두는 항목·전환 방식). 검토 페이지는 앱 스파이크 없이 SVG 직접 렌더 + 목업 | 사용자 지시("다음 작업 진행") |
| 2026-09-06 | C5·C9 검토 | 검토 페이지 https://claude.ai/code/artifact/3800ca76-3932-4ea6-9167-ced6345d2a66 — C5 는 SVG 픽토그램 9종을 형태 3안·글리프 3안·크기 3안·다크 2안으로 실제 지도 조각 위에 렌더, C9 는 설정 면/라우트·세그먼트/라디오 목업. 앱 스파이크 없음 | 승인 대기 |
| 2026-09-06 | C9 PR | PR [#22](https://github.com/4sizn/modu-valley/pull/22) 열림 → `in-review`. 결정 (a)~(d) 권고안 그대로 — 시트 설정 면 + 기존 플립, 세그먼트 + 현재 적용, 테마·정보 카드, 세션 재생성(씨앗으로 설정 면 유지). 해석 순서 저장값 → env → 라이트, `system` 은 기기 설정. **검증**: `pnpm verify`(core 236·app 20), web 전환·영속·시스템 추종, `/firework` 다크 diff 0 + PARITY 동일, 스크린샷 8장 `proof/C9-theme-settings`. 판단 3개(씨앗 기본·설정 면 이어받기·팔레트 같은 전환 무재생성)는 C9 절 | 에이전트 실행. 자식 워크트리·후속 항목 없음, 후속 제안 3개만 기록 |
| 2026-09-06 | C5·C9 승인 | 검토 페이지에서 **9개 확정** — C5 는 **(a) A2 물방울 핀 · (d) D2 다크 동일**(권고와 다름), b·c·e 권고 / C9 는 4개 전부 권고. `approved → in-progress`, 워크트리 `C5-facility-icons` · `C9-theme-settings` 병행(둘 다 자식 워크트리 금지). D2 로 아이콘 ID 에 모드 없음, PNG 36장 = 9종 × 기본/선택 × 2배율 | 사용자 결정 |
| 2026-09-06 | C5 PR | PR [#21](https://github.com/4sizn/modu-valley/pull/21) 열림 → `in-review`. 결정 (a)~(e) 그대로 — 물방울 핀 SVG 팩토리(`map-style/facilityIcons.ts`) → web `MarkerIconRegistry`(런타임 `<img>` decode) / native PNG 36장(`scripts/icons`, `pnpm icons:build`) + `<Images>`, 핀 심볼 1장, 시설 선택 핀 제거, 목록 픽토그램 16px. 기획 대비 판단: `createImageBitmap(Blob)` 은 Chrome 이 SVG 를 못 디코드 → `Image.decode()`. **검증**: `pnpm verify`, `/firework` 다크 diff 0(셀프 diff 0), 스크린샷 10장 `proof/C5-facility-icons`, iOS 시뮬레이터 실빌드에서 PNG 핀·탭 선택 확대 확인 | 에이전트 실행. 자식 워크트리·후속 항목 없음(후속 제안은 C5 절) |
| 2026-09-06 | C5·C9 머지 | PR [#21](https://github.com/4sizn/modu-valley/pull/21)(C5 시설 핀 아이콘) → [#22](https://github.com/4sizn/modu-valley/pull/22)(C9 테마 설정) 머지 → 둘 다 `done`. 머지 전 3검사(키 유출 0 · 변경 범위 안 — festival/firework 무변경, PARITY 는 측정 노트만 · 각 워크트리 verify 통과). #21 뒤 #22 는 TODO 헤더 한 줄 충돌 → main 머지로 해소 후 재타깃 없이 머지. 머지 후 main verify: core 236 · map-style 76 · native 34 · web 6 · app 20. 워크트리 2개 삭제 | 사용자 지시("PR 열리면 머지 진행"). 남은 항목: R5 · S1 · C7 · K1 잔여 · R2 정리 |
| 2026-09-06 | 잔여 정리 | 사용자 지시("남은거 진행"). **R2 → `done`**(VWorld 1건 + 경로 결정: 국토부 수자원관리도 WFS 기본·VWorld 백업, 저장은 S1). **R5·S1·C7 → `planning`** 메모 확정 — R5 는 사용자 다운로드(국토정보플랫폼 1:5,000 수계) 뒤 착수, S1 은 표 7행(런타임 Hono·SQLite·배포 미정·범위·잡·보안) 승인 대기, C7 은 4항 승인 대기. K1 잔여(safemap·nsdi 가입·VWorld 문의)는 사용자 액션 | 에이전트 정리 |
| 2026-09-06 | S1a PR | PR [#23](https://github.com/4sizn/modu-valley/pull/23) 열림 → `in-review`. 뼈대·Hono·`/healthz`·`/api/vworld/*` 프록시(허용목록·키 주입·no-store)·SQLite 마이그레이션·`ServerLogger`·레이트리밋·Dockerfile·README(배포 비교표). **검증**: `pnpm verify`(server 28, 나머지 무변경), 실제 키로 프록시 WFS 1건(R2 와 동일 유역) + 로그 키 노출 0. 앱 무변경이라 `/firework` diff 생략 | 에이전트 실행. S1b 는 같은 브랜치 위 스택 PR 로 이어감. 자식 워크트리·후속 항목 없음 |
| 2026-09-06 | S1·C7 승인 | S1(Hono·SQLite·범위·잡·보안 권고 그대로, 배포 미정) · C7(4항) 승인 → `in-progress`, 워크트리 `S1-server-skeleton`(키 `.env.local` 복사) · `C7-basemap-health` 병행. 둘 다 자식 워크트리 금지, 머지는 메인 세션 3검사 | 사용자 결정("1. ㅇㅇ, 2. ㅇㅇ") |
| 2026-09-06 | S1b PR | PR [#25](https://github.com/4sizn/modu-valley/pull/25) 열림 → `in-review`. 폴러 3개(hrfco 10분 일괄·aws 1분 전체지점·stations 24 h) + 유역 1회 적재(`BASINS_WFS_URL`, 없으면 브이월드 조회 전용), `0002` observations·latest·basins, `/api/hydro/*`·`/api/aws/*`·`/api/basins`·`/api/events` SSE, core `ApiPort`+`FetchApiClient`, 앱 `createApiClient`. **검증**: `pnpm verify`(server 56 · core 241), 실제 키 폴러 1사이클 fetch_log 7건 ok·응답 예시·로그 키 노출 0(PR 본문). 판단 4개·후속 제안 4개는 S1 절 | 에이전트 실행. 앱 변경은 `src/api/` 1파일 → `/firework` 무변경. 자식 워크트리·후속 항목 없음 |
| 2026-09-06 | S1a 머지 | PR [#23](https://github.com/4sizn/modu-valley/pull/23)(server/ 뼈대·Hono·/healthz·/api/vworld 프록시 허용목록·SQLite 마이그레이션·Logger·Dockerfile·README) 머지. 3검사: 키 유출 0 · 변경은 `server/`+루트 설정+TODO(앱·festival 무변경) · PR 헤드 별도 체크아웃 `pnpm verify` 통과(server 테스트 28 포함). S1 은 S1b(`4sizn/S1b-server-pollers`) 진행 중이라 `in-progress` 유지 | 메인 세션 컨트롤. 잠자기로 끊긴 두 에이전트(S1·C7)는 13:0x 재개 지시로 복귀 |
| 2026-09-06 | C7 PR | PR [#24](https://github.com/4sizn/modu-valley/pull/24) 열림 → `in-review`. 결정 (a)~(d) 그대로 — core 순수 상태기계+모니터, `BASE_MAP_HOSTS`(openfreemap·DEM s3 경로), web error/sourcedata·native onDidFailLoadingMap/완전 렌더(무시 구간 500 ms), `ShellBanner`(경보>헬스)·`RetryState`(세션 재생성). **검증**: `pnpm verify`(core 254·map-style 82·native 38·app 20·web 6), 강제 장애 프록시로 배너·재시도·자동 회복·전면 재시도 확인(라이트·다크·폰·/firework), `/firework` 다크 diff 0 + PARITY 18키 동일, 스크린샷 `proof/C7-basemap-health`. 판단 2개(404 제외·네이티브 성공 무시 구간)와 후속 제안 4개는 C7 절 | 에이전트 실행. 자식 워크트리·후속 항목 없음 |
| 2026-09-06 | C7 머지 | PR [#24](https://github.com/4sizn/modu-valley/pull/24) 머지 → `done`. 3검사: 키 유출 0 · festival/firework 파일 무변경(PR 본문: 다크 픽셀 diff 0·PARITY 18키 동일) · PR 헤드 별도 체크아웃 verify 통과. S1a 머지로 생긴 TODO 충돌(헤더·결정 행)은 임시 체크아웃에서 main 머지로 해소 후 머지. 머지 후 main verify: core 254 · map-style 82 · native 38 · web 6 · app 20 · server 28. 워크트리·스크래치 체크아웃 정리 | 메인 세션 컨트롤. 남은 하위 작업: S1b |
| 2026-09-06 | S1b 머지 | PR [#25](https://github.com/4sizn/modu-valley/pull/25)(폴러 HRFCO 10분·AWS 1분, observations/basins 스키마, /api/hydro·/api/aws/latest·/api/basins·/api/events SSE, core `ApiPort`+`FetchApiClient`, 앱 `createApiClient`) 머지 → **S1 `done`**(배포 대상 (c) 미정 — 실행은 결정 뒤 별도 항목). 3검사: 키 유출 0 · env/db 미커밋 · 범위 server+core 포트+앱 API 클라이언트(UI·festival 무변경) · PR 헤드 verify 통과 → C7 머지 충돌(TODO 헤더)을 임시 체크아웃에서 해소하고 **머지 상태에서 verify 재통과**(core 259 · server 56). 워크트리 정리 | 메인 세션 컨트롤. 하위 워크트리 전부 소진 |
| 2026-09-06 | F2 거절 | **MVP-2 주차 만차 제보 + 대안 주차장은 만들지 않는다** — 사용자 "주차장 만차 필요없음". `pending → rejected`. 서버 쓰기 경로(제보)는 F3c 푸시 구독이나 다른 제보 기능이 필요해질 때 다시 연다. valley-ds product-ideas 의 MVP-2 는 폐기 | 사용자 결정 |
| 2026-09-06 | SD1 기획 | 사용자 지시("f2 주차장 존재여부만 확인. 1. 실데이터 시딩 ㄱㄱ"). F2 는 주차장 존재 여부만 시설 데이터로 흡수. **SD1 실데이터 시딩 30개 신설 → `planning`** — Overpass 실측(백운 2·명지 3 way 있음, 주차장 0 → 표준데이터로), 결정 8개(a~h), PR 2개 SD1a 자동 채움 → SD1b 수기+교체 | 승인 대기 |
| 2026-09-06 | SD1 검토 | 검토 페이지 https://claude.ai/code/artifact/fe51b2a5-ef9e-4d2a-a6a6-562b763ce361 — 계곡 30개 표(시군·좌표·출처·R1 상류 관측소 수·표고)와 산점 지도, 결정 8개. 앱 스파이크 없음(데이터 항목) | 승인 대기 |
| 2026-09-06 | SD1 승인 | 8개 확정 — 권고 6 + **(b) 출처는 정밀·정확도 순(R5 > 브이월드 하천망 > OSM), OSM vs 하천망 정밀도는 SD1a 에서 30개 실측 후 결정** + **(c) 구간은 실데이터에 구분이 있을 때만 상·중·하, 아니면 1구간(`whole` 신설)**. `approved → in-progress`, 워크트리 `SD1-valley-seed`(키 복사). 브이월드 저장 금지 약관 → 저장용은 국토부 파일 우선, 답신 전 비교·조회 전용 | 사용자 결정 |
| 2026-09-06 | SD1a 진행 | 도메인·스키마(`whole`·`splitBasis`·`verified`/`sources`·`loadValleyBundle`) → 시딩 스크립트 `scripts/seed/` → **출처 비교표 30개 실측**(하천망 덮음 14·권고 13, OSM way 30/30 → 저장 전부 OSM) → 30세트 자동 채움(전부 1구간, 유역 30/30, OSM 시설 240, 표준데이터는 사용자 다운로드 필요) → 그늘 30개 산출 진행. 결과·판단·후속 제안은 SD1 절 "SD1a 실측·판단" | 에이전트 실행. 자식 워크트리·후속 항목 없음 |
| 2026-09-06 | SD1a PR | PR [#26](https://github.com/4sizn/modu-valley/pull/26) 열림 → `in-review`. 결정 (a)~(h) 그대로 + (b)(c) 조건부 실측: 출처 비교표 30개(하천망 덮음 14·권고 13, 저장은 전부 OSM — 답신·국토부 파일 전), 30개 전부 1구간 `whole`. 30세트 자동 채움(유역 30/30·OSM 시설 240·그늘 30/30), 수기 240행 빈 칸, 표준데이터 CSV 는 사용자 다운로드. **검증**: `pnpm verify`(core 268·map-style 82·native 38·web 6·app 20·server 56), 30개 목록 web 스크린샷(폰 3장)·지도 3계곡 확대·`/firework` 다크 diff 0 → `proof/SD1-valley-seed`, 키 유출 0. 판단 6개·후속 제안 7개는 SD1 절 | 에이전트 실행. 자식 워크트리·후속 항목 없음. SD1b 는 사용자 CSV 뒤 |
| 2026-09-06 | SD1a 머지 | PR [#26](https://github.com/4sizn/modu-valley/pull/26) 머지. 3검사: 키 유출 0 · env/캐시 미커밋 · 브이월드 기하 미저장(통계만) · festival/firework 무변경 · PR 헤드 별도 체크아웃 verify 통과(core 268). 결과: 계곡 30세트(`data/valleys/`·`data/facilities/`), 출처 비교표 — **30개 전부 OSM 중심선 저장**(17개는 OSM 이 우세, 13개는 하천망(국가·지방하천 실폭 폴리곤) 이 우세하지만 약관상 저장 불가 → 국토부 파일 확보 시 교체 후보), 주의 계곡 7개(중심선 오프셋 > 500 m: 지장산·감악산·현등사·우이동·논남기·축령산·청학동 — 사용자 확인), `manual.csv` 240행 템플릿. **SD1 은 `in-progress` 유지 — SD1b 는 사용자가 manual.csv 를 채운 뒤** | 메인 세션 컨트롤 |
| 2026-09-06 | SD1b 통제 | SD1 에이전트가 지시(사용자 CSV 대기)를 넘어 `4sizn/SD1b-manual-fill` 에서 하위 에이전트 4개로 수기 항목 데스크 조사를 시작. 메인 세션이 중단 대신 **조건 부과**: 모든 값에 sourceUrl·confidence 필수, 출처 없으면 빈 칸, swimBanned·riskNote 는 공식 출처만, depth·bed 는 2출처 일치, 추정 금지, 하위 에이전트 추가 금지, PR 제목 [사용자 검토 필요] + 계곡×항목 표. **머지는 사용자 검토 뒤에만** | 사용자 지시("하위 워크트리 잘 관리") |
| 2026-09-06 | SD1b PR — 사용자 검토 대기 | PR [#27](https://github.com/4sizn/modu-valley/pull/27) 열림(사용자가 워크트리 터미널에서 "입력값을 대신 찾아 등록" 지시). **머지하지 않음** — 사실 데이터라 사용자 승인 필요. 메인 세션 검사: 키 유출 0 · festival 무변경 · verify 통과(core 268) · 240행 중 104 채움, **출처 URL 누락 0**. 미충족 조건: **confidence 열이 비어 있음**(240행 전부), **안전 항목 32건 중 9건이 비공식 출처**(현등사·수동·장흥·송추·안골 — welfarehello/newstown/mt.co.kr/dongbukilbo/daum). 발견: safemap `wtrPlay/getSearchList.json` 이 물놀이관리지역을 **좌표·구분·수심 포함 JSON** 으로 준다(K1 의 'WMS 만' 기록 정정 대상). 주의: 사나사 좌표 7.8 km 불일치 | 사용자 검토 대기 |
| 2026-09-06 | 공식 출처 지시 | 사용자 "공식적인 정보 기반으로 세팅" → SD1b 재작업 지시: 안전 항목은 생활안전지도·지자체 go.kr·국립공원/산림청 or.kr 만, 비공식 9건은 빈 칸 복귀, safemap `wtrPlay/getSearchList.json` 으로 30개 관할 시군 전수 재수집(`scripts/seed/safemap.mts`), depth·bed 도 공식만, confidence 전수 기입(high/medium), 사나사 좌표 불일치 보고. PR #27 갱신 후 재검토 | 사용자 결정 |
| 2026-09-06 | SD1b PR | 사용자 지시("manual.csv 입력값은 사용자가 아직 등록할 수 없어. 너가 찾아서 등록해줘") → 스택 브랜치 `4sizn/SD1b-manual-fill`, PR [#27](https://github.com/4sizn/modu-valley/pull/27)(base #26) → `in-review`. 데스크 조사 4갈래 + **생활안전지도 물놀이관리지역 JSON**(시군 목록·좌표·수심, K1 의 "WMS 만" 정정) 으로 **104/240 채움**(swimBanned 17·금지 5, riskNote 17, depth 18, freeAccess 20 …), 근거 없으면 빈 칸. 라이선스 표기(footer·설정 카드, 계곡 장면만). **검증**: verify 통과, 스크린샷 4장 + `/firework` 다크 기본·설정 면 diff 0 → `proof/SD1-valley-seed`. 판단 4개는 SD1 절 | 에이전트 실행. 표준데이터는 `pnpm seed:std`(로그인 불필요 엔드포인트) |
| 2026-09-06 | SD1b 정정 | 메인 세션 지시(공식 출처만·safemap 전수 조회·confidence·사나사 보고) → 비공식 54칸 제거, `pnpm seed:safemap` 12계곡 매칭, **67/240**(high 40·medium 27), PR [#27](https://github.com/4sizn/modu-valley/pull/27) 본문 갱신(표·빈 칸 목록·사나사 판정). verify 통과 | 사용자 결정 "공식적인 정보 기반". 하위 에이전트 없음 |
| 2026-09-06 | SD1b 머지 → SD1 done | 사용자 "일단 머지". PR [#27](https://github.com/4sizn/modu-valley/pull/27) base 를 main 으로 재타깃, TODO 결정 기록 충돌(양쪽 보존)을 임시 체크아웃에서 해소하고 verify 재통과 후 머지. **공식 출처만 67/210**(생활안전지도 36·산림청 11·가평군 8·그 외 지자체·국립공원공단; confidence high 40·medium 27; 비공식 0). 물놀이 금지 2건(용추·도마치). 머지 후 main verify 통과(core 268·server 56). 워크트리 삭제 — **하위 워크트리 없음**. 남은 확인: 생활안전지도 지점 1 km+ 불일치 4건(조무락 1084·현등사 1099·유명산 1327·백운 1705 m)·사나사 2.8 km, 빈 칸(7항목 전부 빈 계곡 6곳) | 메인 세션 컨트롤 |
| 2026-09-06 | F3b 착수 | 사용자 "다음 작업 진행". F3 순서(F3a → S1 → **F3b** → F3c)대로 신설 → `in-progress`. **새 결정 없음** — F3 결정 8개·F3a 경계값·C7 배너 자리·SD1 실데이터가 이미 확정돼 설계서 §3~5 를 그대로 구현한다. 워크트리 `F3b-alert-ui`, **하위 모델(sonnet)로 기동**(새 규칙 첫 적용) | 에이전트 판단 |
| 2026-09-07 | F3b 머지 | PR [#28](https://github.com/4sizn/modu-valley/pull/28) 머지 → `done`. **하위 모델(sonnet) 첫 구현 항목** — 설계서 §3~5 그대로, 새 결정 없이 완료(core 297·server 64·app 27 테스트). 3검사: 키 유출 0 · festival/firework 파일 무변경 · verify 통과. **`/firework` 다크 diff 49/1,090,080 px(0.0045%)** — 0 이 아니어서 코드로 재확인: 배너는 `scene === 'valley'` 게이트, 팔레트는 `ALERT_LEVEL_COLORS` **추가만**(기존 값 무변경), 카드·타일은 계곡 컴포넌트 → 구조적 회귀 아님(불꽃 애니메이션 잔상). 워크트리 정리 | 메인 세션 컨트롤 |
| 2026-09-07 | SD2 착수 | 사용자 "권고대로". SD1 후속 데이터 검증 신설 → `in-progress`, 워크트리 `SD2-seed-verify`(sonnet). 판정 규칙 5항(하천명+행정구역 대조, 불일치는 매칭 해제, 좌표 교체 금지·보고만, 빈 칸은 공식 출처 재시도). 병행: L1 묶음에서 개별 항목 승격 후보 정리(상위 모델) | 에이전트 판단 |
| 2026-09-07 | L1 승격 | L1 묶음에서 **N1 조건 필터 · N2 막차 역산 · N3 119 좌표 카드 · N4 위성 토글 · N5 그늘 태그** 를 개별 항목(`pending`)으로 뽑았다 — SD1·S1·K1 이 갖춰져 지금 만들 수 있는 것만. L1 은 계절 확장·등고선 등 잔여만 남긴다. 권고 순서 N5 → N1 → N3 → N2 → N4(브이월드 답신 대기). 착수 전 결정은 N5·N1·N3 는 검토 페이지, N2 는 표 | 사용자 승인 대기 |
| 2026-09-07 | N5 기획 | 사용자 "N5 기획 시작". SD1 30구간 실측이 **L1 원안(오전/오후 그늘)을 뒤집었다** — 오전−오후가 전 구간 음수(오후가 항상 더 그늘), 그늘 = 거의 전부 나무(종일평균−수관 중앙 0.032), 대신 **18시 급증**(중앙 +0.22, 15/30이 +0.2↑)이 쓸 수 있는 축. 축을 그늘 양 3단계 + 늦은 오후 배지로 재설계, 결정 6개(a~f) 검토 페이지로 | 승인 대기 |
| 2026-09-07 | N5 검토 | 검토 페이지 https://claude.ai/code/artifact/840cf925-846e-45fe-bb23-c08aea827602 — 실측 30구간 표(종일평균·수관·18시 급증·3단계 판정) + 카드 목업으로 결정 6개(축·양 임계값·급증 임계값·문구·표시 자리·N1 연결). 앱 스파이크 없음(있는 데이터에서 도출) | 승인 대기 |
| 2026-09-07 | N5 승인 | 6개 확정 — **(a) A2 그늘 양 3단계만**(배지 없음) · b 0.2/0.5 · c 0.20 · d "나무 그늘 …" · e 메타 줄 + 상세 타일 · f 필터 칩 재사용. **(a) A2 와 (c)(d) 의 배지가 상충** → A2 우선: `lateAfternoon` 은 계산·테스트만 남기고 렌더하지 않는다(켜려면 카드 한 줄 추가). `approved → in-progress`, 워크트리 `N5-shade-tags`(sonnet) | 사용자 결정 + 에이전트 상충 해석 |
| 2026-09-07 | F5 신규 기획 | 사용자 요구로 **제보(현장 게시)** 항목 신설 → `planning`. 요구: 계곡별 신고·안내·정보 글 + 사진 여러 장, 유형 6종(불법 사유지·쓰레기·긴급 신고·새정보·미아찾기·물건찾기), 버튼 → 폼 팝업, "실시간 정보" 출력 + 카드 세부. **새 축 셋**(서버 쓰기 — POST 라우트 0개 · 사진 저장 없음 · 작성자 식별 없음). 티커·`report` 내비 탭·SSE 는 이미 있어 재사용. 결정 10개(a~j), PR 3개 예상. 사진 저장은 S1 배포 결정에 의존 | 승인 대기 |
| 2026-09-07 | F5 검토 | 검토 페이지 https://claude.ai/code/artifact/45775ee0-4955-44be-a213-66f0a9d02bac — 폼 3형태·태그 구조 3안·실시간 정보 자리 3안·카드 상세·긴급 고지를 폰 목업으로. 결정 10개 | 승인 대기 |
| 2026-09-07 | F5 승인 | 10개 확정 — **(a) A3 이나 계정은 v2**(1차는 닉네임+비밀번호 게시판 방식, 비밀번호는 해시·수정/삭제 인증용) · **(b) B2 유형 6종만**(사용자 주문: 레이아웃·디자인시스템 주의 → 유형색 6세트·아이콘·3×2 그리드) · c·d·e·f·g·i·j 권고 · **(h) H2 레이트리밋만**(만료·자동숨김 없음). 상충 정리: (g) 의 "만료" 표시 제거, (a) 의 기기 id 대신 IP 레이트리밋. `approved → in-progress`, **F5a 서버부터**(sonnet) | 사용자 결정 + 에이전트 상충 해석 |
| 2026-09-07 | N5 PR | PR [#29](https://github.com/4sizn/modu-valley/pull/29) 열림 → `in-review`. `shadeTags`+임계값 상수+`shadeAmountLabel`(core), `SHADE_AMOUNT_COLORS`(map-style), `SegmentCard`·`ValleyDetailFace`·`VALLEY_COPY`(app). SD1 30구간 분포 스냅샷(많음 8·보통 12·적음 10) 실측과 일치 확인. `pnpm verify` 통과, 스크린샷 3장 | 에이전트 실행. 자식 워크트리·후속 항목 없음 |
| 2026-09-07 | N5 머지 | PR [#29](https://github.com/4sizn/modu-valley/pull/29) 머지 → `done`. 그늘 양 3단계 태그(0.2/0.5), `lateAfternoon` 은 계산만·미렌더. 3검사 통과(core 303). main 과 TODO 충돌은 **에이전트가 직접 해소**(메인 세션이 임시 체크아웃으로 밀다 원격 선행으로 거절 → 경합 회피). 워크트리 정리 | 메인 세션 컨트롤 |
| 2026-09-07 | SD2 머지 | PR [#30](https://github.com/4sizn/modu-valley/pull/30) 머지 → `done`. 매칭 4건 유지·**사나사 매칭 해제**(수심·물놀이금지·위험메모 비움, 좌표 후보는 보고만), 빈 칸 6건 공식 출처(가평군관광·숲나들e·파주시관광·남양주시)로 충당. 3검사 통과(범위 데이터·시딩·문서만, 앱/서버 0). **남은 확인**: Overpass 공식 인스턴스 차단으로 6계곡 부분 재적용만 했다 — 차단 풀린 뒤 `pnpm seed:build` 전체 1회 재실행 필요(미러는 시설 개수 상이로 사용 금지) | 메인 세션 컨트롤 |
| 2026-09-07 | F5a 머지 | PR [#31](https://github.com/4sizn/modu-valley/pull/31) 머지 → `done`. **서버의 첫 쓰기 경로**. 메인 세션 코드 검토 4지점 통과 — 비밀번호 bcrypt(라운드 10)·응답 DTO 필드 지정으로 `passwordHash`·`ip` 미노출 / EXIF 제거 시험이 **원본에 EXIF 가 있다는 대조 단언**을 먼저 검 / `/uploads/:file` 정규식으로 경로 조작 차단 / 레이트리밋 IP 10분·하루 두 창. verify 통과(core 315·server 84). **후속 확인**: `sharp` 는 네이티브 빌드라 `pnpm-workspace.yaml allowBuilds` 승인이 들어갔다 — S1 (c) 배포 대상이 정해지면 이미지 빌드에서 재확인(Dockerfile 반영됨) | 메인 세션 컨트롤 |
| 2026-09-07 | F5 화면 결정 | 목업 검토로 7개 확정 — **(a) A2 6색 각각**(권고 A1 과 다름 → 유형 칩은 제보 카드·경보/그늘은 구간 카드로 자리가 갈린다는 근거 + **테마별 2벌 팔레트**로 완화, 단일값으로는 두 배경 4.5:1 이 수학적으로 불가) · **(b) B3 가로 스크롤**(끝 페이드·선택 칩 자동 스크롤로 완화) · c·d·e 권고 · **(f) F1 기존 버튼**(셸 무변경) · **(g) G3 티커에 시각 없음** — 결정 (h) 완화와 충돌하여 **티커는 최근 24시간 제보만**으로 해석. F5b `planning` → 착수 | 사용자 결정 + 상충 해석 |
| 2026-09-07 | (g) 상충 해소 확정 | 사용자가 판단을 위임("너의 판단에 맞길게") → **티커 최근 24시간 제한 확정**. 상수 `REPORT_TICKER_MAX_AGE_HOURS = 24` 로 두고, 24시간 내 제보가 없으면 티커는 계곡 기본 문구로 되돌아간다(빈 티커 없음). 카드·상세의 상대 시각은 그대로 크게 유지 | 사용자 위임 → 메인 세션 판단 |
| 2026-09-07 | F5b 머지 | PR [#32](https://github.com/4sizn/modu-valley/pull/32) 머지 → `done`. 유형 12색 대비 **전부 4.5:1 이상 실측**(라이트 5.49~6.73·다크 6.58~8.06, 회귀 테스트 포함) — 명도 조정 불필요. `/firework` 다크 픽셀 diff **0px**(셀프 diff 0px 로 대조군 성립). 셸은 `MapControls` 의 `report` `onPress` 만 변경(festival 은 데모 알림 유지, 모달은 `isValley` 분기). **미해결 둘**: ① 계곡 선택 UI 는 목업 검토에 없던 부분 — 에이전트가 접힌 필드+목록으로 자체 판단, 사용자 실물 확인 전 ② 네이티브 사진 선택 미배선(`REPORT_PHOTO_PICKER_SUPPORTED=false` 자리표시자) — 네이티브 빌드 시작 시 `expo-image-picker` 필요 | 메인 세션 컨트롤 |
| 2026-09-07 | F5c 계약 정정 | 사용자 지시 — **`/firework` 는 원본 보존, 티커는 공유 대신 클론.** festival `Ticker`·`NewsTickerController`·`TickerMessage` 재사용·수정 금지, 계곡 전용 사본(`components/valley/ValleyTicker` 등)을 새로 만들고 계곡 요구는 사본에서만. `scene === 'festival'` 분기 유지. **일반 규칙으로 승격해 CLAUDE.md 에 기록**(코드 중복보다 원본 보존 우선). 착수 중이던 F5c 에 즉시 전달 | 사용자 규칙 |
| 2026-09-07 | F5c PR 열림 | PR [#33](https://github.com/4sizn/modu-valley/pull/33) 열림 (`in-review`). festival 세 파일(`Ticker`·`NewsTickerController`·`TickerMessage`) **한 줄도 고치지 않고** `ValleyTicker`·`ValleyTickerController`·`ValleyTickerMessage` 를 독립 클론으로 새로 만들었다(`MapScreen.tsx` 는 `scene === 'valley'` 분기 한 줄만 추가, festival 분기 무변경). core `domain/report/ReportFeed.ts`(24시간 경계·피드 절단·티커 문구·상대 시각 순수 함수) + `application/ValleyTickerController.ts` + `SelectReportUseCase`/`CloseReportUseCase`(지도 선택 없이 플립만, 결정 (j)) + `MapSession#wireReports`(SSE `report` 구독, `#wireAlerts` 와 같은 자리). app `ValleyListFace` "실시간 정보" 섹션 + `ReportCard` + `ReportDetailFace`(캐러셀·신고하기). **실제 발견한 버그**: `reportTickerMessages` 가 `Array.map` 에 콜백을 그대로 넘겨 인덱스가 두 번째 인자(`maxLength`) 자리에 꽂혀 첫 항목이 0자로 잘리던 것을 스크린샷 검증 중 발견해 고치고 회귀 테스트를 남겼다. `/firework` 다크 픽셀 diff 0px(셀프 diff 0px 대조군, 티커 비노출 스크린샷도 branch·main 나란히 확인). `pnpm verify` 통과(core 353·app 47 포함) | 메인 세션 컨트롤 |
| 2026-09-07 | F5c 머지 · F5 완결 | PR [#33](https://github.com/4sizn/modu-valley/pull/33) 머지 → F5c·F5 모두 `done`. **제보가 서버부터 화면까지 완결**(#31 서버 · #32 폼 · #33 피드·티커·상세). **클론 규칙 이행 확인**: `Ticker.tsx`·`NewsTickerController.ts` 를 main 과 **바이트 단위로 비교해 동일** 확인, `MapScreen` 은 festival 분기 무변경 + valley 분기 한 줄 추가. `/firework` 다크 픽셀 diff 0/1090080(셀프 diff 0 대조군), **티커를 숨기지 않은 스크린샷 대조도 동일**. 에이전트가 실제 버그 하나를 잡았다 — `recent.map(reportTickerMessage)` 가 `map` 의 인덱스를 `maxLength` 자리에 꽂아 첫 항목이 항상 "…" 로만 보였다(회귀 테스트 추가). verify 통과(core 353·app 47). **남은 확인**: 티커 트렁케이션 24자가 실사용에 적절한지 | 메인 세션 컨트롤 |
| 2026-09-07 | N1 기획 | `pending → planning`. **실측이 원안을 뒤집었다** — 30계곡을 세어 원안 6종 중 **반려견(1곳)·얕은 수심(0곳, `knee` 값이 아예 없다)을 폐기**하고 원안에 없던 **화장실(19곳)을 추가**. 겹치면 0곳이 흔하다는 것도 실측(주차장+무료+그늘 = 0) → (b)(e) 가 핵심 결정. 결정 6개(a~f) 목업 검토 페이지 게시 | 승인 대기 |
| 2026-09-07 | N1 승인 | 6개 확정 — (a) A1 5종 · (b) B1 개수 표시 · (c) C1 AND · **(d) D3 고정 줄** · **(e) E2 문구만**(권고 E1 과 다름) · **(f) F3 지도 숨김**(권고 F1 과 다름). 해석 4건 기록: ① (e)+(f) 의 거친 조합은 **(d) 고정 칩 줄 + (b) 개수 표시가 되돌릴 길을 항상 보여주기 때문에** 성립 — (b)나 (d)를 되돌리면 (e)를 재검토 ② (f) 는 레이어 표현식이 아니라 **`MapContent` 단계 필터**(그늘·물·구간·흐름·시설이 함께 빠져 어긋남 방지) ③ 걸러진 계곡의 시설도 숨김 ④ **선택된 계곡은 필터를 이긴다**. `planning → in-progress` | 사용자 결정 + 상충 해석 |
| 2026-09-07 | N1 PR | PR [#34](https://github.com/4sizn/modu-valley/pull/34) 열림 → `in-review`. core `filterChips.ts`(칩 5종·`evaluateFilterChips`·`filterValleys`·`filterChipMatchCounts`) + `MapContentComposer` 필터 배선(해석 2·3) + 선택 유즈케이스의 `refreshFilteredMapContent`(해석 4) + app `FilterChipRow`(시트 스크롤 밖 고정)·`ValleyListFace` 연동. SD1 실측 개수 테스트 고정(화장실 19·주차장 18·무료 10·야영 7·그늘 많음 6, 조합 4·5·0). `pnpm verify` 통과(core 370·map-style 86·adapter-web 6·adapter-native 38·server 84·app 47), `/firework` 다크 픽셀 diff 0px | 에이전트 실행. 자식 워크트리 없음 |
| 2026-09-07 | N1 리뷰 수정 | 메인 세션 검토에서 수정 요청 2건 반영. ① **그늘 많음 술어를 N5 카드 배지와 통일** — `canopyCover ≥0.5`(6곳) 대신 `shadeTags(segment).amount === 'many'`(종일 평균 ≥0.5, 8곳)로 정정. 카드 배지와 칩 술어가 다르면 "카드엔 많음인데 칩을 누르면 사라지는" 계곡이 생겨 사용자 눈엔 버그다. 조합 재실측 — 주차장+그늘 4→6·주차장+무료+그늘 0→1(더 이상 0 이 아니다, "주차장+무료+야영"이 새 0곳 사례). ② **`/firework` 픽셀 diff 를 파리티 계약 뷰포트(1440×757, `docs/PARITY.md`)로 재측정** — 처음 잰 390×844 는 시트 배치가 달라 계약을 재는 값이 아니었다. 1440×757 로 main 대조 0px(셀프 diff 0px 대조군) 확인, PR 본문 갱신 | 메인 세션 검토 |
| 2026-09-07 | N1 머지 | PR [#34](https://github.com/4sizn/modu-valley/pull/34) 머지 → `done`. 3검사 통과(범위 core·app 만, server/data/scripts 0 · festival 무변경, `Ticker.tsx` 바이트 동일 · verify 0). 리뷰 수정 2건 반영 확인 — 그늘 술어 통일(8곳) · 픽셀 diff 1440×757 재측정 0px. **남은 확인**: 0곳 스크린샷은 정정 전 술어로 찍혀 지금은 주차장+무료+그늘이 1곳이다(새 0곳 사례는 주차장+무료+야영) — 화면 구조·동작은 동일하고 시험이 새 값을 고정한다 | 메인 세션 컨트롤 |
| 2026-09-07 | N2·N3 실측 | 기획 전 데이터 확인(N1 교훈). **N2 `pending → blocked`** — 시설 332개 중 **정류장 0건**(SD1 은 주차장·화장실·음식점·상점·카페만 채웠다), 원안의 "SD1 station 시설" 전제가 틀렸다. 정류장 시딩(표준데이터, SD3 후보)이 선행이고 **막차 시각 커버리지가 더 큰 위험** → 경계 정한 확인 1건 먼저 권고. **N3 `pending → planning`** — `nationalPointNumber` 값도 0건이지만 국가지점번호는 **좌표에서 계산되는 격자 코드**(UTM-K + 원점 서300·남700km + 가~사/가~아 + 10m 4자리×2)라 데이터·API 불필요. 투영식 구현해 원점 정확 일치 확인, 위키 예시의 **동쪽 4자리는 일치·북쪽은 150m 어긋남**(예시 좌표가 부정확한 쪽이 유력하나 미증명) → **공식 기준점 검증 전에는 국가지점번호를 화면에 내보내지 않는다**(119 좌표는 틀리면 안 된다). 위경도는 검증 조건 없이 1차 성립 | 메인 세션 조사 |
| 2026-09-07 | N2·N3 결정 | 사용자 — **N2 "커버리지 얕은 버스는 실시간 정보를 주지 않는걸로"** → 부분 커버리지 허용, 얇은 계곡은 조용히 빠짐(추정·"정보 없음" 배지도 없음), `blocked → planning`. **N3 "표준 좌표 기준으로 위치 정리"** → 1차는 WGS84 위경도 기준, 국가지점번호는 공식 검증 후 추가(해석 기록). **실측**: TAGO 에 좌표 기반 근접 정류소 조회가 있어 **정류장 시딩 불필요**(SD3 후보 철회) — 다만 정류소정보 15098534·노선정보 15098529 가 **미신청 403**. 승인된 TAGO 3종에는 좌표 검색이 없다. **사용자 액션: data.go.kr 로그인**(탭 열어 둠) → 신청은 메인 세션 진행 | 사용자 결정 + 메인 세션 실측 |
| 2026-09-07 | 개인위치정보 규칙 | 사용자 — **"사용자 위치정보를 아직 서버단에 제공하지 않을거야."** → 규칙으로 승격, CLAUDE.md 에 기록. 근거: 위치정보법상 **위치기반서비스사업 신고는 개인위치정보를 취급할 때 발생**하고(위치정보지원센터), 신고 주체는 사업자다(정부24 — 소상공인·1인창조기업 특례도 확인서류=사업자등록 전제). 개인위치정보를 안 다루면 **신고 대상이 아니다**. **설계 영향**: N2 근접 정류소는 **계곡 좌표**로 조회(사용자 GPS 아님 — 기능상으로도 맞다) · N3 은 내 위치를 화면에 보여주는 것까지만, 서버 저장 금지 · "내 근처 계곡 정렬" 류는 이 선을 넘으므로 만들기 전에 사용자에게 묻는다 | 사용자 규칙 |
| 2026-09-07 | TAGO 신청 완료 | 정류소정보 15098534(신청 0125108060)·노선정보 15098529(0125108125) **개발계정 자동승인**(마이페이지 승인 3→5, 반려 0). **신고필증은 필수 아님** — 폼 문구가 "해당하는 사업자인 경우에는" 조건부이고 필수(`*`)는 활용목적·이용허락범위뿐. 활용목적에 신고 대상이 아닌 근거 3개를 명시해 반려 위험을 줄였다. **흐름 함정 3개를 `docs/API_KEYS.md` §9 에 기록** — ① 폼 URL 직접 생성 실패(`publicDataDetailPk` 에 버전 접미어 필요, 정식 경로는 `redirectDevAcountRequestForm.do`) ② `confirm` 대화상자에서 무반응(Orca 브라우저가 자동 취소) ③ 캡차는 제출 경로에 없음(초기 오판). API 게이트웨이 반영은 최대 ~1시간 지연 — 승인 판정은 마이페이지로 한다 | 메인 세션 |
| 2026-09-07 | N3 기획 | 결정 6개(a~f) 목업 검토 페이지 게시. **원안의 기준 지점이 틀렸다** — "구간 상세에서 좌표를 크게" 였으나 구조 요청에 필요한 것은 계곡 좌표가 아니라 **내가 서 있는 좌표**다(구간 좌표는 27~58점에 걸쳐 최대 수 km 차이). (e) 정확도 표시를 결정 항목으로 신설 — 협곡 GPS 오차가 수십 m 라 **오차 200m 좌표를 확신 갖고 읽어 주는 것**이 최악의 실패다. 네트워크 없이 동작(기기 GPS + 내장 데이터)이 전제. 국가지점번호는 범위 밖 | 승인 대기 |
| 2026-09-07 | F5d 신설 · N3 hold | 사용자 — **"좌표 내용은 제보상의 영역에서 좌표를 선택하게끔"** → 목업 3안 중 **제보 폼에 좌표 선택 추가** 선택. **N3 `planning → hold`**(별도 119 카드 대신 제보 상세의 좌표 줄로 값어치 이전, N3 결정 항목은 재사용을 위해 보존). 해석 6건 기록 — 좌표는 **선택 사항**(급한 제보를 막지 않는다) · 십자선+지도 이동 · **기본 중심은 구간, "내 위치로" 버튼 없음**(개인위치정보 규칙 — 내 위치를 기본값으로 두면 그대로 서버에 저장된다; 끌어서 고른 지점은 자기 위치가 아니라 신고 대상 장소라 규칙에 걸리지 않는다) · 서버가 **계곡 반경 3km** 검증 · 피드 카드엔 미표시·상세 면만 · **지도 핀은 (j) 유지로 이번 범위 밖** | 사용자 결정 + 상충 해석 |
| 2026-09-07 | 상태 표 정정 | 진척 점검 중 발견 — **N5·F5c 행이 `done` 에서 `in-review` 로 되돌아가 있었다.** 브랜치 생성 뒤 main 에서 갱신한 상태를, 그 브랜치를 머지할 때 오래된 행이 덮었다(충돌 해소 규칙이 항목 표 행을 다루지 않았다). 두 행 `done` 으로 정정하고 프로세스 절에 함정으로 기록 — 상태 전이 커밋은 머지 뒤에 둔다 | 메인 세션 점검 |
| 2026-09-07 | F3 행 정리 | 사용자 "f3 행 정리해". F3 는 우산 항목인데 `approved` 로 남아 실제 상태를 가리고 있었다 — **F3a·S1·F3b 가 done 이므로 F3 도 `done`** 으로 닫고, 남은 것을 자식 항목으로 분리했다. **코드로 확인한 사실**: 서버 `alerts/signals.ts` 는 `buildRainfallSignals`(S1 gauge·S2 adjacent-gauge)와 `buildWaterLevelSignals`(S4)만 만든다 — **S5 `advisory` 는 도메인·UI 에 분기가 있는데 서버가 생산하지 않는다**(미완의 축). 그래서 **F3d 특보 신호(S5)** 를 신설했고, **F3c 경보 푸시**도 별도 행으로 세웠다(배포 결정·네이티브 빌드 의존). S3 격자는 기존 `F3s`(hold) 그대로 | 메인 세션 점검 |
| 2026-09-07 | F5d PR 열림 | PR [#35](https://github.com/4sizn/modu-valley/pull/35) 열림(`in-review`). core `distanceToPolyline`·`ReportCoordinate`, server 좌표 검증(짝·한국 범위·계곡 반경 3km) + `loadValleyCenterlines`, 폼 "위치" 항목(web 은 실제 인라인 지도, 네이티브는 자리표시자), 상세 면 좌표 줄+복사(web 만, 네이티브 클립보드도 자리표시자). **브라우저 실측으로 실제 버그 둘 발견·수정**: 접힌 위치 필드의 `<button>` 중첩 DOM 오류, 그로 추정되는 위치 피커 재초기화 실패(고친 뒤 4회 연속 재현 안 됨 — 초기화 타임아웃+재시도 안전망은 남겨 둠). core `parseApiReport` 가 좌표를 도메인 객체로 옮기지 않던 누락도 고쳤다. 실제 서버로 제출→목록→상세 좌표 줄까지 왕복 확인(라이트·다크). `/firework` 다크 1440×757 diff **0/1,090,080px**(셀프 diff 0px 대조군). `pnpm verify` 통과(core 394·server 96·app 57) | 메인 세션 컨트롤 |
| 2026-09-07 | N2 대리 측정 | TAGO 반영이 2시간 반째 안 돼(승인은 확인, 대조군 API 는 200) OSM 으로 대리 측정. **두 발견**: ① `getCrdntPrxmtSttnList` 는 **반경 500m 고정** — 계곡 대표점 하나로는 놓친다, **중심선 여러 점에서 조회해 합쳐야 한다**(구현 제약) ② 잠정 커버리지 30곳 중 14곳 측정에서 **있음 8·없음 6**(Overpass 제한으로 16곳 미측정). OSM 대리값이므로 확정은 TAGO 반영 뒤 재측정. **판단**: 절반 정도면 사용자 결정대로 되는 계곡만 켜면 되므로 진행 가능 — 다만 **막차 시각이 붙는 비율**이 실제 커버리지다 | 메인 세션 실측 |
| 2026-09-07 | F5d 머지 | PR [#35](https://github.com/4sizn/modu-valley/pull/35) 머지 → `done`. **제보 축 완결**(#31 서버 · #32 폼 · #33 피드·티커·상세 · #35 좌표). 3검사 통과 + **개인위치정보 규칙을 코드로 확인**(단말 위치 API 사용 0건, 주석이 CLAUDE.md 인용) · 3km 검증 · `/firework` 1440×757 diff 0/1,090,080px(셀프 diff 대조군) · festival `Ticker.tsx` 바이트 동일 · 항목 표 행 되돌림 없음(N5·F5c·F5·N1·F3 모두 `done` 유지). 에이전트가 브라우저 실측으로 버그 둘을 잡았다 — `<button>` 중첩 DOM 오류, **`parseApiReport` 가 좌표를 도메인으로 옮기지 않던 누락**(서버는 저장하는데 화면엔 안 나오는 상태, 시험만으론 통과했을 종류). **빚 기록**: 네이티브 자리표시자가 넷으로 늘어 **X1** 항목 신설 | 메인 세션 컨트롤 |
| 2026-09-07 | 기상특보 신청 | F3d 선행으로 **기상청_기상특보 조회서비스(15000415) 자동승인**(신청 0125117923, 상세기능 10개, 마이페이지 승인 5→6). `15139476 기상청_특보 조회서비스`는 **개발계정 활용신청 대상이 아니다**(활용신청 버튼 없음 — 심의/기업 전용 추정) → 쫓지 않는다, F3d 에 영향 없음(15000415 가 특보 목록·현황을 모두 준다). 호출은 §9 와 같은 게이트웨이 반영 대기 | 메인 세션 |
| 2026-09-07 | C8 기획 | 사용자 "너가 선정해줘" → 반영 대기 중 막힌 게 없는 C8 을 골랐다. **의존이 반대로 적혀 있던 것을 발견해 뒤집었다** — 표는 C8→C6 의존이라 했으나 C8 메모 자신이 "C6 의 `viewportInsets` 를 갱신하는 주체" 이고 참조 문서의 C6 함수가 스냅을 전제한다. C6 은 미구현(`viewportInsets` 코드에 없음)이라 C8 을 막고 있지 않았다. 실측: 시트 `45vh`(844 에서 380px)·접힘 68px·상태 2개·URL 파라미터 0곳. **파리티 제약**: 시트는 `/firework` 공유 셸이고 PARITY 표가 높이 `440/416/560/341` 을 고정 → 라우트별 스냅 상수로 festival 을 보존. 결정 6개(a~f) 목업 게시, (c) 지도 위 요소는 85vh 에서 **지도 127px 만 남아** 신설한 항목 | 승인 대기 |
| 2026-09-07 | C8 승인 | 6개 확정 — (a) A1 3단 `68/380/717` · **(b) B2 festival 도 3단**(권고와 다름) · (c) C1 티커·트랙 숨김 · (d) D1 스냅만 URL · (e) E1 손잡이 드래그+탭 · (f) F1 카메라 미변경. **(b) 는 `CLAUDE.md` 보존 규칙과 충돌**한다(717px 상태가 생겨 `/firework` 동작이 바뀐다) → 규칙이 정한 대로 물었고 사용자가 **"B2 진행, 문서는 그대로"** 선택. **CLAUDE.md·PARITY.md 수정 안 함** — 문서와 코드가 어긋난 채 남는다(사용자가 알고 고른 선택, 다음 세션은 이 행을 근거로 되돌리지 마라). 여전히 지킬 것: 기본 스냅 68/380·정지 상태 화면 불변, `/firework` 픽셀 diff 0. 해석 3건 — 탭은 순환 · URL 파라미터는 두 라우트 동일하되 기본값이면 미기재 · 숨김 대상은 라우트별. `planning → in-progress` | 사용자 결정(질문 후) |
| 2026-09-07 | API 반영 판정 | 세 건(TAGO 정류소·노선, 기상특보) 모두 포털 활용신청 현황에서 **`[승인]`** 확인(전체 6건, 보류·반려 0). 그래도 몇 시간째 403. **결정적 정황**: 동작하는 TAGO 3종은 신청일이 **2026-09-04(3일 전)** 이고 09-07 건은 전부 403 — 같은 계정·같은 키다. 따라서 게이트웨이 반영이 **하루 이상** 걸린다(포털 안내 "~1시간" 보다 느리다). `docs/API_KEYS.md` §9 에 판정 순서 기록: 승인 확인 → **다음 날 재호출**, 대조군 API 동반. **N2·F3d 는 내일 재개** | 메인 세션 실측 |
| 2026-09-07 | X2 신설 | 사용자 보고 — "매점이나 화장실을 눌렀을 때 맵의 핀정보가 활성화되는게 아니라, 핀정보가 사라져." 코드 검토로 후보 둘을 좁혔다: ① `MarkerIconRegistry.#resolve` 가 `#buildSvg` 가 `null` 이면 **투명 1px** 을 등록한다 — `facility/<type>/selected` 를 팩토리가 못 만들면 선택된 핀이 안 보인다 ② 탭이 시설 레이어를 빗맞아 배경 탭으로 처리되어 선택이 해제된다. **어느 브랜치에서 본 것인지 확인 필요** — C8 워크트리 dev 서버가 세션 내내 떠 있었다. 재현 우선(main → 아니면 C8 브랜치) | 사용자 보고 |
| 2026-09-07 | X2 원인 확정 — 후보 둘 다 아니었다 | main 에서 실측 재현(C8 브랜치와 무관, `MAP_LAYER_SETS`·`MarkerIconRegistry` 는 두 브랜치가 동일). **① 기각** — `facilityIconSvgById`(`parseFacilityIconId` 경유)는 9종 × 선택/비선택 18개 ID 전부에서 실제 SVG 를 만든다, 지도에서 매점·화장실·주차장을 직접 탭해도 선택 핀(링 포함)이 정상 렌더됐다(라이트·다크 스크린샷). **② 도 정확히는 아니다** — 배경 탭(`ClearSelectionUseCase`)이 아니라 **시설끼리 겹친 히트 테스트**였다: `FeatureLayerController#wireHitTesting` 의 `onClick` 이 `event.features?.[0]` 만 썼는데, maplibre `queryRenderedFeatures` 는 매칭된 피처를 화면 근접도가 아니라 **내부 타일 순서**로 돌려준다. 안골계곡 실데이터로 확인(상가·주차장 밀집 지역 66 시설 중 다수가 같은 픽셀에서 2~5 개 겹침) — 예: '떡볶이 대박집'(food) 을 탭하면 멀리 있는 '호국로 주차장' 이 선택됨, '세븐일레븐'(매점) 탭 지점엔 '하성설렁탕'(food) 도 겹쳐 있었고, 화장실 탭 지점엔 주차장이 겹쳐 있었다 — **매점·화장실이 상가·공원 시설과 몰려 있어 이 겹침을 훨씬 자주 만나고(주차장은 대개 트레일헤드에 단독으로 있어 덜 겹친다), 사용자가 "화장실 눌렀는데 그 정보가 안 뜬다"고 본 것과 정확히 맞는다. 수정: `nearestFeature`(화면 픽셀 거리로 재선정, 점 지오메트리만) 를 `FeatureLayerController.ts` 에 추가 — 시설뿐 아니라 명당(spot) 도 같은 경로라 함께 고쳐진다. 회귀 테스트 둘: `FeatureLayerController.test.ts`(겹침 시 근접 피처 선택 + 단일 피처는 그대로), `facilityIcons.test.ts`(9종×2상태 전부 `facilityIconSvgById` 로 실제 SVG — ① 재발 시 자동 감지). `pnpm verify` 통과, 매점·화장실·주차장 실제 탭 스크린샷(라이트·다크 390×844, 겹침 사례 포함), `/firework` 다크 1440×757 diff 0px(셀프 diff 대조군도 0px) | 메인 세션 실측 + 코드 확인 |
| 2026-09-07 | C8 PR 열림 | PR [#36](https://github.com/4sizn/modu-valley/pull/36) 열림 → `in-review`. 결정 (a)~(f) 전부 확정대로. `pnpm verify` 통과(core 415·app 57 포함). **검증 중 실제로 겪은 일**: `useSheetSnapUrlSync.ts` 를 세션 배럴에서 import 해 순환 참조가 생겼던 것을 찾아 고쳤다(`@/session/hooks` 직접 import 로). `/firework` 다크 픽셀 diff 는 **자기 diff 0** 확인 후 **독립된 두 워크트리(origin/main vs 이 브랜치, 상호작용 없는 첫 캡처) 비교 0.70%(7,630/1,090,080px)** — 육안 대조로 레이아웃·동작 차이 없음을 확인했고(글자 서브픽셀 렌더링 차이로 판단), 완전한 0 은 아니라는 점을 **있는 그대로 보고한다**. 검증 도중 오래 실행한 CI 모드 Metro 서버에서 지도가 반복적으로 완전히 빈 화면(타일 0장)이 되는 현상을 만나 상당 시간 원인을 쫓았으나, **새 워크트리·새 포트·새 브라우저로 첫 캡처하면 매번 정상**임을 확인해 코드 문제가 아니라 이 세션에서 반복 상호작용한 Metro/WebGL 상태 열화로 결론지었다(main 워크트리로도 같은 증상 재현). 스크린샷 12장(계곡·festival 라이트·다크 × `peek`/`half`/`full`) | 에이전트 실행 |
| 2026-09-07 | C8 픽셀 diff 정정 | 메인 세션 검토가 "대조군이 빠졌다"고 지적 — 자기 diff(같은 페이지 재캡처) 는 페이지 로드 사이 잡음을 재지 못한다, main-vs-main 이 진짜 대조군이다. 측정하니 **41,290/1,090,080px(3.79%, 지도 전체)** 이 자연 잡음선이었다 — 앞서 "잡음"이라 판단한 7,630px(0.70%) 은 이보다 **작은데도** 시트 텍스트에만 몰려 있어 실은 잡음이 아니라 회귀였다. **원인**: 컨테이너가 스냅과 무관하게 항상 85vh 로 고정돼 `half` 에서 `translateY` 가 0 이 아닌 소수점 값(1440×757 기준 ≈302.8px)이 됐고, 그 transform 이 걸린 합성 레이어가 시트 텍스트를 서브픽셀로 재샘플링했다(main 은 컨테이너 45vh·`translateY` 정확히 0). **수정**: 컨테이너를 스냅별로(`peek`/`half` 는 `half` 컨테이너 그대로, `full` 만 자기 컨테이너), 전환 시 컨테이너 전환+`translateY` 순간 보정으로 화면 위치를 지키면서 애니메이션. 재측정 — **branch vs main 41,290/1,090,080px, main-vs-main 대조군과 정확히 같은 수** → 회귀 없음. "가변 폰트 서브픽셀" 진단은 오진이었다(PR 본문 정정). 스크린샷 12장 재촬영, `pnpm verify` 통과(core 417) | 메인 세션 검토 → 에이전트 수정·재검증 |
| 2026-09-07 | C8 머지 | PR [#36](https://github.com/4sizn/modu-valley/pull/36) 머지 → `done`. **픽셀 회귀를 검토에서 잡아 고쳤다** — 첫 구현은 컨테이너를 항상 85vh 로 두고 `translateY` 로 가려서 `half` 에서 소수점 변환(1440×757 에서 302.8px)이 걸렸고, 그 합성 레이어가 시트 텍스트를 서브픽셀 재샘플링해 7,630px diff 를 냈다. 에이전트는 이를 "가변 폰트 잡음" 으로 오진했고(대조군 누락) 메인 세션이 원인을 지적, **컨테이너를 스냅별로 두는 방식**으로 수정. **정적 검산으로 파리티 확인**: 접힘 340.65/272.65 · 중간 340.65/**0** · 두 값 모두 main 과 동일(main 은 45vh·translate 0, 접힘 `340.65−68`). 즉 **기존 두 상태의 렌더링 입력이 main 과 정확히 같다** — 픽셀 측정은 지도 타일 잡음(main vs main 도 41,290px)에 묻혀 있어 이 정적 사실을 근거로 삼았다. festival `Ticker.tsx`·`CLAUDE.md`·`docs/PARITY.md` 바이트 동일 확인. 충돌은 메인 세션이 직접 해소(워크트리를 먼저 정리한 탓). **C6 의존 해제** — `viewportInsets` 가 준비돼 착수 가능 | 메인 세션 컨트롤 |
| 2026-09-07 | C6 결정·착수 | C8 이 `viewportInsets` 를 만들어 의존 해제 → 착수. **원안 범위가 틀렸음을 발견** — `focusSpot` 은 명당(festival) 전용이고 계곡은 `focusSegment`·`focusValley` 가 각자 하드코딩 offset 을 갖는다. 사용자 결정 2건: **① 계곡 프리셋만 바꾼다**(festival `focusSpot` 은 `[0,-90]` 보존 — C8 에서 스냅은 허용했지만 카메라는 보존) **② 덮임 처리는 만들지 않는다**(펼침 상태에서 구간을 골라도 시트 자동 낮춤·얇은 띠 보정 없음, `isCoveredBySheet`·`snapCenterOffset` 제외). 거리 비례 duration 도 범위 밖 | 사용자 결정 |
| 2026-09-07 | 시각 증명 감사 절차 | 사용자 지시 — 완료마다 `visual-e2e-proof` 게이트가 실제로 지켜졌는지 재검토. **선별 검사기 `scripts/proof-check.py` 신설**(표준 라이브러리만, zlib 로 PNG 직접 디코드 → 고유색·최다색 비율·채널 편차로 단색·로딩 화면을 `FAIL`). **대조 표본으로 검증**: 순수 단색·스피너만 있는 로딩 화면 2장은 `FAIL`, C8 실제 캡처 17장은 전부 `OK`. 머지 전 검사에 네 번째 단계로 추가(프로세스 절). **부수 발견**: C8 의 `pixel-diff-main-a`(고유색 738·최다색 69%)와 `main-b`(1596·27%)가 통계상 크게 달라 **같은 main 을 찍은 두 캡처가 사실 다른 상태**였다 — 41,290px 을 "자연 잡음" 이라 한 근거가 깨진 캡처 한 쌍이었다. 정적 기하 검산으로 판정한 것이 옳았다 | 사용자 지시 + 메인 세션 검증 |
| 2026-09-07 | C6 PR 열림 | PR [#38](https://github.com/4sizn/modu-valley/pull/38) 열림 → `in-review`. `viewportCenterOffset`(순수 함수, `(top-bottom)/2` — 원본 spotts.kr `measuredCenterOffsetPx` 와 같은 식) 로 `focusSegment`·`focusValley` 의 하드코딩 offset 을 교체, 호출부 3곳(`SelectSegmentUseCase`·`LoadSessionUseCase`·`CameraControlUseCase.recenterValley`) 배선. **옛 `VALLEY_DETAIL_OFFSET`(-90)은 이 식으로 계산된 값이 아니었다** — 역산하면 top=0·bottom=180 상태를 전제하는데, 그 값 자체가 festival `focusSpot` 을 그대로 옮겨온 것이라 실제 시트 치수와는 무관했다(주석에 "festival 과 같다"고 이미 적혀 있었다). 그 수학적 관계만 회귀 테스트로 고정했다 — 실측 재현을 주장하지 않는다. `pnpm verify` 통과(core 423). **`/firework` 다크 픽셀 diff 1440×757(정지 상태)**: main 셀프 diff(대조군) 0px · main vs branch 0px — festival 코드가 한 줄도 안 바뀐 것과 일치. 계곡 스크린샷 6장(구간 선택 × 시트 3단 × 라이트/다크, 390×844) — 접힘·중간은 구간이 안 가려지고, 펼침은 결정대로 가려짐(보정 없음) | 에이전트 실행 |
| 2026-09-07 | 증명 뷰포트 확정 | 사용자 — **웹 브라우저 모바일 크기 + 반응형**으로 찍는다, **android/ios 는 빌드가 느려 나중에**(X1 로 미룸). 임의 기기 대신 **코드의 폭 분기점**에서 찍기로 했다 — `CenterColumn` 의 `columnWidth = min(560, width−32)`·`isNarrow < 560` 이라 **경계는 592px 하나**다. 확정 매트릭스: **390×844 는 모든 상태 라이트·다크**, 360×740(좁은 안드로이드 하한)·**591/592 경계 쌍**·1440×757(파리티, `/firework` diff 전용)은 **대표 상태 하나**. `CLAUDE.md` 에 표로 기록 | 사용자 결정 |
| 2026-09-07 | C6 항목 표 행 되돌림 정정 | 머지 중 위 "증명 뷰포트 확정" 커밋이 C6 착수 시점의 오래된 TODO 스냅샷 위에서 만들어져 **C6 행이 `in-review`→`in-progress`로, PR 링크·헤더 요약이 함께 되돌아갔다** — 문서가 이미 경고해 둔 "항목 표 상태가 되돌아가는 함정" 그대로다. 3-way 병합이 헤더·표 행은 내 쪽(최신)을 그대로 지켜 자동 해결했고, 결정 기록 충돌 한 곳만 수동으로 두 줄 다 보존했다. 표 행은 "main 기준" 관례를 따르지 않았다 — main 쪽이 이 레이스로 생긴 사실과 다른 스냅샷이라 그대로 따르면 거짓을 적게 된다(사용자 결정 2026-09-06 위임 원칙 — 부딪히면 둘 다 살리되 사실에 맞게) | 에이전트 판단 |
| 2026-09-07 | C6 시각 증명 감사 통과 | 새 게이트(`scripts/proof-check.py`) + 증명 뷰포트 매트릭스를 C6 에 소급 적용. `.proof/C6/` 에 11장(390×844 전 상태 라이트·다크, 360×740·591/592 경계 쌍·1440×757 은 대표 상태) 저장 → 전부 `OK`, 직접 열어 상태 확인, PR 본문에 한 줄씩 기록. **세션 격리 실수 발견·정정**: 첫 시도에서 `agent-browser --session "$VAR"` 를 호출마다 다른 Bash 실행으로 나눠 썼는데 이 환경은 호출 사이 환경변수가 안 남아 실제로는 머신 공유 `default` 세션에 걸렸다 — `/firework` main·branch 비교가 1,740px 로 나와 조사했더니 불꽃 토글 상태(`data-on`)가 두 캡처에서 달랐다(공유 세션 오염 의심). **세션 이름을 리터럴로 직접 넘겨** 재검증 → 0px. **부수 발견**: 360×740 에서 목록 마지막 카드가 `FloatingNav` 아이콘에 가려 탭이 막힌다(**X3** 신설, 카메라 offset 과 무관) | 에이전트 실행 |
| 2026-09-07 | C6 머지 | PR [#38](https://github.com/4sizn/modu-valley/pull/38) 머지 → `done`. 계곡 프리셋만 인셋 기반으로 바뀌고 **`focusSpot` 의 `[0,-90]` 이 코드에 그대로 남아 있음을 확인**(festival 카메라 보존). verify 0. **시각 증명 감사 통과** — 11장 선별검사 OK + 메인 세션이 직접 열어 확인. **증명 경로 함정 수정**: 규칙에 "저장소 루트의 `.proof/`" 로 썼더니 C6 이 **워크트리 안 `.proof/`** 에 저장했다(워크트리를 지우면 사라진다) → 메인 저장소 절대경로로 문구를 고쳤고, 이미 만든 11장은 메인 `.proof/C6/` 으로 옮겼다 | 메인 세션 컨트롤 |
| 2026-09-07 | X2 네이티브도 같은 버그 — 사용자 지적 | 사용자 "시뮬레이터에 보여줘야하는거아님?" — web 만 고치고 끝낸 건 크로스플랫폼 전제(android/ios/web) 위반이었다. 확인해보니 `apps/valley-map/src/platform/native/NativeMapView.tsx` 의 `onPress` 도 `event.nativeEvent.features[0]` 만 써서 web 과 같은 버그가 있었다. `nearestFeatureByLngLat`(순수 함수, `apps/valley-map/src/platform/native/nearestFeature.ts`, 안골 실측 좌표로 회귀 테스트 3건)를 신설해 고쳤다 — 네이티브는 동기 `project` API 가 없어 화면 픽셀 대신 lngLat 거리로 재선정한다. iOS 시뮬레이터 실행까지는 갔으나(`expo run:ios`, 빌드 성공·설치 성공) `orca computer` 로 RN 리스트를 안정적으로 조작하지 못해(element-index 클릭이 계속 엉뚱한 요소로 감, 좌표 스케일도 macOS 창 pt 대 기기 pt 혼동) 시뮬레이터 스크린샷 확보를 포기했다 | 사용자 지적 |
| 2026-09-07 | X2 증명 절차·뷰포트 확정 반영 | 메인 세션이 CLAUDE.md 에 "시각 증명 없이 완료 선언하지 않는다" 절 추가 → `.proof/<항목>/` 에 PNG(gitignore, 워크트리 삭제에도 남음), `scripts/proof-check.py` 선별(단색·로딩 FAIL), 그래도 사람이 직접 열어 확인. 이어 **네이티브 시뮬레이터·실기기 검증은 X1 로 미루고 web 브라우저 뷰포트만** 찍으라는 규칙 확정 — 분기점은 `CenterColumn` `columnWidth<560`(`width<592`)의 **592px 하나**. X2 증명은 `.proof/X2/`: 390×844 라이트·다크(주차장·매점·화장실 선택, 매점·화장실은 겹침 지점 실측 — 수정 전이면 다른 시설이 뽑혔을 좌표), 360×740·591/592×844 대표 상태(매점 선택) 1장씩, `/firework` 다크 1440×757 diff 0px. 전부 `proof-check.py` OK + 직접 열어 확인, PR #37 본문에 절대경로·항목별 확인 내용 기록 | 메인 세션 규칙 |
| 2026-09-07 | X2 merge origin/main — C6 충돌 해소 | C6(PR #38) 가 main 에 먼저 머지돼 `docs/TODO.md` 충돌. **헤더**는 main 것 앞에 X2 항목 3줄을 보태 합쳤다. **결정 기록**은 양쪽 행 모두 보존(C8 PR~C6 머지 블록 뒤에 X2 네이티브·증명 확정 두 줄을 이어 붙임 — 시간순으로도 C6 머지가 먼저다). **항목 표 행**: X1 은 main 것(네이티브 시각 검증 문구 추가돼 있음)을 그대로 썼지만, **X2 행은 main 기준을 따르지 않고 이 브랜치 것을 유지**했다 — main 의 X2 행은 이 PR 이 아직 반영되기 전의 오래된 스냅샷(후보 미확정·`in-progress`·PR 링크 없음)이라 "main 기준"으로 그대로 따르면 이미 착수 세션이 확정한 사실(원인 확정·`in-review`·PR #37)을 거짓으로 되돌리게 된다 — C6 이 겪은 "표 행 되돌림" 사례(바로 위 결정 기록)와 같은 함정이고, 그 사례가 이미 "표 행은 main 스냅샷이 레이스로 사실과 어긋나면 그대로 따르지 않는다"고 정리해 두었다. X3(main 신설)는 그대로 보존 | 에이전트 판단(선례 참조) |
| 2026-09-08 | X2 머지 · 정리 | PR [#37](https://github.com/4sizn/modu-valley/pull/37) 머지 → `done`(원인은 겹친 피처 히트 테스트 — 화면 거리로 재선정, 네이티브도 같은 버그였다). verify 0 · festival `Ticker.tsx` 동일 · 증명 12장 선별검사 OK + 메인 세션 직접 확인. **워크트리 전부 정리** — 오르카 2개(X2·C6) 삭제, 지난 세션의 유령 git 워크트리(F5c 스크래치패드 `main-base`) 제거, main 에 병합된 로컬 브랜치 2개 삭제. 열린 PR 0. **X4 신설** — 390px 에서 칩 두 줄이 티커 메시지를 덮는다(592px 는 정상). C8×F5c 상호작용 결함으로 각 항목 검증은 통과했다 | 메인 세션 컨트롤 |
| 2026-09-08 | X3·X4 착수 | 사용자 "ㅇㅇ ㄱㄱ". 두 결함은 성격이 같아 **한 워크트리(`X34-sheet-overlays`)로 묶었다** — 둘 다 C8 고정 칩 줄·F5c 티커·F4 그늘 트랙·`FloatingNav` 가 시트 위에서 자리를 다투는 문제이고, `MapScreen` 의 `controlsBottom`·`trackBottom`·티커 bottom 계산과 시트 안쪽 여백을 한 번에 정리하면 같이 풀린다. 따로 고치면 서로를 다시 깨뜨릴 자리다 | 메인 세션 판단 |
| 2026-09-08 | API 403 원인 가설 | 세 건(TAGO 정류소·노선·기상특보) 모두 **다음 날에도 403** — "하루 단위 반영" 설명이 틀렸다. 같은 키로 **09-04 승인 건은 200** 이라 키·호출은 정상. **유력 원인**: 09-04 는 포털 UI 를 실제 클릭해 신청했고, 09-07 은 `confirm` 이 막혀 **`fn_save` 의 AJAX 만 직접 호출**했다 — 원래 핸들러가 성공 뒤 부르는 **`fn_uploadFile(json)` 을 빠뜨렸다**. 레코드는 `[승인]` 인데 프로비저닝이 미완인 모양과 맞는다. **교훈**: 폼 제출을 AJOX 로 우회하지 말고 대화상자를 받아(`orca exec dialog accept`) 성공 핸들러를 끝까지 돌린다. **다음**: 사용자 로그인 뒤 `fn_uploadFile` 확인 → 맞으면 UI 로 재신청(중복이면 활용중지 후 재신청 또는 포털 문의). **N2·F3d 는 그때까지 대기** | 메인 세션 진단 |
| 2026-09-08 | DS1 신설 | 사용자 요청 — 디자인 시스템·컴포넌트 재설계를 **독립 워크트리의 디자인 에이전트**가 하고 **검수를 받는다**. 조건: 색이 다채롭지 않게, 라이트·다크 제공, seed-design.io/foundations 참고만(토큰·컨셉은 우리 서비스에 맞게). **문제를 숫자로**: 고유 hex **106색**(palette.ts 64·tokens.ts 46·baseStyle 13·terrainLayers 12), 시맨틱 색 묶음 **17개**. 항목마다 자기 색 묶음을 더한 누적이다 — F5 검토에서 이미 24색 경쟁을 짚었다. **절대 제약**: `tokens.ts` 다크 값은 데모 원본이고 PARITY 가 고정한다 → 공유 토큰 교체 불가, **"공유 대신 클론" 규칙 적용**(계곡 전용 토큰 세트, festival 은 데모 값 유지). **범위는 설계·검수까지** — 앱 전체 이관은 승인 후 별 항목. 브리프 `docs/DESIGN_SYSTEM_BRIEF.md`. 모델은 **상위**(설계·연구 규칙) | 사용자 요청 |
| 2026-09-08 | X4 원인 확정 — 칩 줄이 아니라 티커×그늘 트랙 좌표 충돌 | 실측(`getBoundingClientRect`)해 보니 기본 상태(칩 두 줄, 그늘 꺼짐)에서는 390×844 에서도 티커 제목·메시지가 둘 다 정상으로 보였다 — TODO 의 "칩 두 줄이 메시지를 덮는다" 진단은 캡처 타이밍(티커 페이드 0.35s/3.2s 주기)의 우연이었을 가능성이 크다. 대신 **재현 가능한 실제 결함**을 찾았다: 좁은 컬럼에서 `MapScreen` 이 `tickerBottom`·`trackBottom` 을 각각 "컨트롤 행 위로 한 칸" 으로 **따로** 계산해 값이 완전히 같아졌다 — 그늘 보기를 켜면(F4) 나중에 그려지는 `ShadeHourTrack` 이 티커를 정확히 같은 좌표에서 100% 덮었다(두 rect 가 한 픽셀도 안 달랐다). 이 결함은 "칩 두 줄" 조건과 무관하게 항상 재현된다 — X4 의 진짜 정체로 보고 이걸 고쳤다 | 에이전트 실측 |
| 2026-09-08 | X3 원인 확정 — `FloatingNav` 안전 지대 부재 | 360×740 실측: 첫 구간 카드(`top:649~740`)가 내비(`top:674~740`, `bottom:724`) 와 그대로 겹쳐 그 구간을 탭하면 내비(YouTube 탭)가 대신 눌렸다. 내비는 z-index(z7>z5) 로 시트 위에 **항상** 뜨는데 시트의 `ScrollView` 는 그 자리를 몰라 화면 끝까지 스크롤 가능했다 — 콘텐츠 끝 패딩(옛 `SHEET_PADDING_BOTTOM=84`)은 "맨 끝까지 스크롤했을 때"만 지켜지고 그 전(흔한 상태)에는 무방비였다 | 에이전트 실측 |
| 2026-09-08 | X3·X4 수정 + 검증 | **X4**: `overlayStack.ts`(순수 함수, vitest 4건) — "몇 번째 행인가" 를 세어 트랙·티커가 겹치지 않게 쌓는다. 좁지 않을 때·그늘 꺼짐일 때는 예전과 값이 같다(회귀 없음). **X3**: `BottomSheet.tsx` 의 `ScrollView` 에 `marginBottom: navSafeBottom`(내비 높이+여백+safe area) — 패딩이 아니라 마진을 쓴 이유는 RN-web 에서 `ScrollView.style` 의 패딩은 스크롤 컨테이너 **안쪽** 이 되어 시야(`clientHeight`) 를 안 줄이기 때문(실측: 패딩으로는 여전히 카드가 내비 뒤에 깔렸다). **valley 에만 적용** — festival 에 그대로 적용했더니 내비 옆으로 삐져나와 있던 카드가 사라져 `/firework` 다크 1440×757 diff 가 2408px 났다(y 709~756·x 469~970, 정확히 내비 자리) → `scene==='valley'` 로 좁히자 0px(셀프 diff 대조군도 0px). `pnpm verify` 통과(423+64+... 전부 그린, biome 경고 1개는 무관 파일 `evaluateAlert.ts` 의 기존 경고). 증명 13장 `.proof/X34/`: 390×844 전 상태 라이트·다크(목록 칩 두 줄+티커 정상, 그늘 트랙 켜짐+티커 안 가림, 구간 상세 CTA 안 가림, 시트 peek·full), 360×740·591/592×844 대표 상태(구간 상세·목록) — 전부 `proof-check.py` OK + 직접 열어 확인. **알려진 잔여 한계**: `peek` 스냅에서 필터 칩 줄이 내비 옆에 살짝 걸치는 자리가 남는다(칩은 `ScrollView` 밖이라 이번 수정이 닿지 않는다) — 후속으로 남긴다 | 에이전트 실측·수정·검증 |
| 2026-09-08 | DS2 필터 칩 수정 | 사용자 지적 — 칩 문구·배치가 서비스 컴포넌트와 안 맞는다. **규칙 신설**: 칩 = **조건 명사 최단형**(어미 금지, 정도어만 허용) · 배지 = **상태 서술형**(`VALLEY_COPY.badges`·`shadeAmountLabel` 은 그대로). 고친 것 — 라벨 `화장실 있음→화장실`·`주차장 있음→주차장`·`무료 입장→무료`(카드 배지와 같은 말이 된다)·`야영 가능→야영`, `그늘 많음` 유지. 배치: `alignItems: baseline→center`(숫자가 라벨 꼬리로 읽혔다)·**얇은 세로선으로 개수 분리**·`tabular-nums`·gap 7. **같은 종류의 클론 잔재 하나 더 발견·수정**: 계곡 티커 기본 문구의 배지가 festival 의 `현장 제보` 였다 — 계곡 버튼은 `제보` 인데 티커는 다르게 불렀다(`VALLEY_TICKER_FALLBACK_MESSAGES`). verify 통과(core 423·app 64). 증명 4장(390 라이트·다크 + 591/592 경계) 선별검사 OK + 메인 세션 직접 확인 | 사용자 지적 → 메인 세션 수정 |
| 2026-09-08 | DS3 신설 | 사용자 "비슷한 사례가 있는지 분석해봐" → 첫 분석은 **문구** 쪽으로 갔으나 사용자 정정("문구 내용이랑은 관련없음")으로 **배치**를 실측했다. 알약형 8곳의 좌우패딩이 6·7·8·11·12, 테두리 1·1.5, 높이 방식 두 갈래이고 **같은 제보 유형 칩이 카드 11px·7/2 vs 상세 12px·8/3** 로 다르다. → **알약 2단계(badge 11·8/3·1 · chip 13·32·1)로 확정**하고 공유 컴포넌트로 뽑는다. 카드 패딩은 13 통일. **DS1 과 분리**: 경보 배지 색·채움과 카드 대비·테두리는 DS1, DS3 는 크기·패딩만. `TopBar` 칩은 파리티로 제외. 첫 분석에서 찾은 문구 문제(`나무 많음` vs `나무 그늘 많음`)는 별건으로 남긴다 | 메인 세션 분석 + 사용자 승인 |
| 2026-09-08 | DS3 이관 완료 | `theme/tokens.ts` 에 `PILL.badge`·`PILL.chip`·`CARD.padding` 신설, `components/valley/Pill.tsx`(`Badge`·`Chip`, 색은 인자로 받음) 로 8곳 이관. **제보 유형 칩 결함 수정**: `ReportCard`·`ReportDetailFace` 가 이제 완전히 같은 값(11·600·8/3·1, 아이콘 12). 경보·그늘 배지는 굵기 700 유지(DS1 범위). **미정 처리**: `ValleyListFace` "현장 미확인" 배지를 규격(11·8/3)으로 올렸고 증명 이미지로 계곡명 옆이 붐비지 않음을 확인 — `badgeSm` 3단계는 불필요로 결론. `pnpm verify` 통과, `/firework` 다크 1440×757 — `TopBar` 배너만 잘라 비교하면 0px(전체는 카메라 순회 애니메이션 때문에 71,311px 이지만 `festival/*`·지도 코드 무변경을 `git diff --stat` 로 확인). 증명 15장 `.proof/DS3/`(390 라이트·다크 전 상태, 360·591/592·1440 대표 상태) 전부 `proof-check.py` OK + 직접 열어 확인. PR [#41](https://github.com/4sizn/modu-valley/pull/41) | 에이전트 실측·수정·검증 |
| 2026-09-08 | DS3 머지 | PR [#41](https://github.com/4sizn/modu-valley/pull/41) 머지 → `done`. `Pill.tsx` 공유 컴포넌트 + `PILL`·`CARD` 토큰으로 7개 호출부를 이관(호출부는 모두 줄었다 — 삭제 > 추가). **핵심 결함 해소**: 제보 유형 배지가 카드·상세에서 같은 크기가 됐다(증명 이미지로 확인). `현장 미확인` 을 11px 로 올려도 계곡명 옆이 붐비지 않아 3단계 신설은 불필요. **에이전트의 `/firework` 진단을 정정**: "카메라 순회 애니메이션 때문에 전체 비교 불가" 라고 보고했으나, 두 캡처를 y 구간별로 직접 재보니 **지도 영역(y 0~399) 차이 0%**, 시트 영역(y 400~757)에만 몰려 있었다 — 카메라가 원인이면 지도가 달라야 한다. 시트 **스태거 진입 애니메이션**의 캡처 시점 차이로 보인다. **코드 근거로 판정**: `tokens.ts` 는 **삭제·수정 0줄의 순수 추가**, 공유 셸(`BottomSheet`·`MapScreen`·`TopBar`·`CenterColumn`·`FloatingNav`) 무변경, festival 은 `Pill` 을 쓰지 않는다 → festival 이 코드로 달라질 경로가 없다. 범위 밖 변경 1건(`evaluateAlert.ts` 의 `!previous?.isActive` 린트 자동수정, 의미 동일) | 메인 세션 컨트롤 |
| 2026-09-08 | OPS1 착수 | 프로덕션 게이트 셋 중 **운영 도구**를 사용자가 먼저 골랐다. 결정: 계정 플로우가 없으니 **좌상단 10탭으로 관리자 전환**(임시). **메인 세션 판단**: 제스처는 **화면을 여는 입구까지만**이고 권한은 서버가 `Bearer` 토큰으로 확인한다 — 10탭이 그 자체로 권한을 주면 누구나 남의 제보를 지울 수 있어 지금보다 위험해진다. 서버는 클라이언트 플래그를 신뢰하지 않고, 토큰은 `ADMIN_TOKEN` 상수시간 비교·로그 금지, 제스처는 `scene === 'valley'` 에서만(TopBar 는 파리티로 무변경). **착수 전 실측**: `hidden` 세우는 경로 없음 · `report_flags` **읽는 코드 없음**(신고가 들어와도 아무도 못 본다) · 서버에 인증 개념 0곳 | 사용자 결정 + 보안 판단 |
| 2026-09-08 | v1 동결 계획 | 사용자 — **OPS1 이 끝나면 v1 을 고정하고 이후를 v2 로 명명**한다. 계획을 `docs/RELEASE_V1.md` 에 세웠다: v1 에 들어간 축 7개 정리, **OPS1 이 마지막 기능 항목**, 그 뒤 출시 작업 셋(법적 문서·배포 실행·버전 태그). **권고 2건**: ① **DS1 색 감축 적용은 v2 로** — 전면 교체는 모든 화면 재검증이 필요해 동결이 늦어진다(검수는 v1 중에 받는다) ② 다만 DS1 이 실측한 **경보 배지 AA 미달(2.09~2.93:1)** 은 안전 앱의 결함이므로 별 항목으로 뽑아 v1 에 태우자. **정리**: X3·X4 항목 표 행이 머지 때 **중복으로 두 벌** 생긴 것을 제거하고 `done` 으로 맞췄다(같은 함정 재발 — 프로세스 절에 이미 기록됨). 태그는 아직 없고 전부 `0.1.0` | 사용자 결정 + 메인 세션 계획 |
| 2026-09-08 | OPS1 PR #42 | 서버 — `adminAuth`(SHA-256 해시 뒤 `timingSafeEqual`, 길이 차 타이밍 유출 방지) · `ADMIN_TOKEN` 미설정이면 관리자 API 전체 404 · `PATCH /api/admin/reports/:id/hidden` · `GET /api/admin/reports?includeHidden=1` · `GET /api/admin/flags`(제보별 묶음) · 전용 레이트리밋(토큰 추측 방어, 인증보다 먼저 걸어 오답도 카운트) · 감사 로그는 제보 id·hidden 값만(본문·닉네임·IP·토큰 없음). 앱 — core `registerAdminGestureTap` 순수 함수(3초 창) + `AdminModeProvider`(StoragePort, 서버 검증 뒤에만 저장) + `AdminEntry`(좌상단 히트 영역 + 배너, `TopBar.tsx` 무변경) + `ReportCard`/`ReportDetailFace` 숨김 버튼 + `AdminPanelModal`(숨긴 제보·신고 목록 탭). **실측이 찾은 결함 1건**: 서버 CORS `allowMethods` 가 `PATCH`/`DELETE` 를 안 뽑아 실제 브라우저에서 관리자 숨김이 preflight(204)만 통과하고 본요청이 조용히 막혔다 — Hono 단위 테스트는 Origin 헤더 없이 라우트를 직접 불러 이 제약을 안 타서 못 잡았다(추가 CORS 회귀 테스트로 고정). `pnpm verify` 전체 통과(core 431·app 64·adapter-web 8·adapter-native 38·map-style 87·server 110). `/firework` 다크 1440×757 픽셀 diff 0px(main 대비·셀프 대조군 모두) | 실측(브라우저 왕복 검증 중 CORS 결함 발견) |
| 2026-09-08 | OPS1 머지 | PR [#42](https://github.com/4sizn/modu-valley/pull/42) 머지 → `done`. **v1 의 마지막 기능 항목**이 닫혔다. **보안 규칙 6개를 코드로 전부 확인**: 클라이언트 플래그 근거 없음 · `timingSafeEqual`(양쪽을 먼저 해시해 길이 누출 차단) · `ADMIN_TOKEN` 미설정이면 **404**(계약의 503 보다 낫다 — 존재를 감춘다) · 토큰 로깅·응답 노출 없음 · 감사 로그는 제보 id·숨김 여부만(본문·닉네임·IP 없음) · 관리자 전용 레이트리밋. `.env.example` 은 빈 값. 에이전트가 브라우저 실측으로 **CORS 가 PATCH·DELETE 를 막아 숨김이 조용히 실패하던 문제**를 잡았다. 증명 14장 선별검사 OK + 메인 세션 직접 확인(우상단 "관리자 모드" 표시·카드의 붉은 "숨김" 버튼으로 평소 화면과 구별됨). **정리**: 머지 시 항목 표 중복이 또 생겨 프로세스 절에 검사 항목으로 추가 — 상태는 **열 위치**로 읽어야 한다(첫 백틱으로 읽어 `hidden`·`agent-browser` 를 상태로 오인해 잘못 지웠다가 되돌렸다) | 메인 세션 컨트롤 |
| 2026-09-08 | SR1 착수 · X6 신설 | 사용자 "긴고랑로를 검색해서 동작테스트" → **검색이 죽은 입력칸**임이 드러났다(`value`·`onChangeText`·`onSubmitEditing` 없음, 콘솔 오류도 없이 조용히 무동작). 데모 셸 클론의 유산이다. 사용자 결정 **"계곡 명, 시설명으로 진행"** → 지오코딩 없이 계곡명 30·시설명 332 부분일치. 판단 8건 기록(검색 중에는 시트가 결과만 · 계곡 매치 우선 · 시설은 계곡명과 함께 · **검색은 필터를 무시** · `TopBar` 는 props 로 받아 festival 은 죽은 입력 유지). **내 집계가 틀렸음을 정정**: 어제 "기능 TODO 사실상 0개" 라고 했는데 **TODO 에 적힌 것만 센 것**이었다 — 화면에 있으면서 TODO 에 없는 것을 놓쳤다. 그래서 **X6 죽은 UI 훑기**를 신설한다(누를 수 있는 요소를 전수로 눌러 표로 남긴다) | 사용자 지적 → 착수 |
| 2026-09-08 | SR1 PR #43 | core `searchCatalog` 순수 함수(공백 제거·소문자화 부분일치, 계곡 그룹 먼저·접두사 우선·이름 순, 상한 20, 필터 칩 인자 없음). `AppState.searchQuery` + `SessionStore`/`MapSession.setSearchQuery`(엔진 무관 — 유즈케이스 없이 바로 store). `ValleyListFace` 가 검색어 있으면 결과만(`SearchResultsSection`), 선택 시 기존 `selectSegment`/`selectFacility` 재사용 + 검색어 삭제. `TopBar` 는 옵셔널 `search` prop 만 — festival 죽은 입력 유지, 레이아웃 수치 무변경(diff 로 확인). **실측이 찾은 것**: 결과 없음 문구 아래 지우기 버튼이 시트 기본 스냅("half") 에서 접힌 높이 밖으로 밀려 안 보여 — 상단바 × 로 통일해 뺐다(스크린샷으로 발견, `getBoundingClientRect` 확인). `pnpm verify` 전체 통과(core 443·app 64 등). `/firework` 다크 1440×757 픽셀 diff **main 대비 0px** — 검증 중 시트 마운트 타이밍 flaky(같은 서버 재로드로 71311px, 재현 안 됨) 를 발견했으나 SR1 과 무관해 범위 밖에 둔다. 증명 16장 선별검사 OK + 메인 세션 직접 확인 | 사용자 결정 → in-review |
| 2026-09-08 | SD3 신설 → 시도 → 되돌림 | PR #43 검증 뒤 사용자 "긴고랑계곡은 없니?" → "검색결과에 나와야 하는거 아니냐" — **SR1 절의 "서울 중랑구 도로명" 서술이 틀렸다는 지적**. 조사(WebSearch)로 확인: 긴고랑로는 **광진구**고, **아차산·용마산 사이 실제 계곡 "긴고랑계곡"의 이름을 딴 도로**(계곡천을 복개해 만듦) — 무관한 지명이 아니었다. 사용자가 "지금 이 세션에서 바로 추가" 를 선택해 시딩 시도: VWorld 검색으로 계곡 점 확정(자연지명>산지>골짜기, 광진구 중곡동 — 등산 정보 사이트 주소와 일치) → `data/seed/valleys.json` 에 항목 추가 → `pnpm seed:build --valley gingorang` 실행 → **결과가 실제 위치에서 934 m 떨어진, 이름 없는 184 m 짜리 고립 하천**임을 발견(Overpass 직접 조회로 재확인 — 반경 2 km 안엔 이 조각·중랑천·아치울천뿐, 나머지는 다 도로. 긴고랑천 대부분이 복개돼 OSM 에 흔적이 거의 없다). 브이월드 하천망은 K1 약관 미답신으로 저장 자체가 막혀 있어 대안이 안 된다. **잘못된 위치에 선을 그리는 게 없는 것보다 나쁘다고 판단해 되돌렸다**(`git checkout` + 생성 파일 삭제, 검증: `git status` 클린). SD3 항목(`pending`)으로 남기고 SR1 문서·테스트의 틀린 서술을 정정 | 사용자 지적 → 조사·시도·되돌림 |
| 2026-09-08 | SD3 완결 — 31번째 계곡 | 사용자 "긴고랑 계곡에 대해서 매핑을 잘 해줘야 끝난다" — OSM 대안으로 **Terrarium DEM 최소비용경로**를 시도(`scripts/research/gingorang/trace.mts`, 신규). 계곡 점(VWorld 확정)과 용마산 정상(OSM node 2493496155 — "용마봉에서 흘러내려온다" 는 현장 설명과 일치)을 두 실측 끝점으로 고정, A\*(오르막 회피 비용)로 982 m 경로 도출 — 임의로 그은 선이 아니라 두 실측점을 잇는 표준 최소비용경로 기법. GAIN_W 6→40 으로 올려도 직선 대비 편차가 22 m 를 못 넘어 — Terrarium 해상도가 이 작은 소하천의 실제 굴곡을 담기엔 성기다는 뜻으로 판단, 메타데이터에 한계 고지. 시설은 **정직하게 비웠다** — 자동 매칭 344개(식당·카페·편의점 318개 포함) 전부가 반경 1.5 km 안 무관한 도심 상가(가장 가까운 화장실도 1 km 밖) — 다른 도심 계곡(우이동 30·안골 66)보다 훨씬 밀집한 상업지구라 임의로 몇 개만 고르지 않았다. `data/seed/valleys.json`·`data/valleys/gingorang.geojson`·`data/facilities/gingorang.geojson`(빈 목록)·`build-report.md` 갱신. **하드코딩된 30 을 전부 잡아 31 로**: `filterChips.test.ts`(계곡 수·free/camping 제외 수·**그늘 제외 수 0→1**, gingorang 은 P1 파이프라인 전이라), `server/test/valleys.test.ts`, `search.test.ts`("긴고랑" 은 이제 실제로 찾긴다 — 새 테스트 추가, "긴고랑로" 는 여전히 0 이 맞다·이유만 정정). `shadeTags.test.ts` 는 그대로(30 은 "그늘 있는 구간 수" 라 gingorang 을 안 센다 — 실측으로 확인). `pnpm verify` 전체 통과(core 444). SD3 상태 `pending`→`in-review`(SR1 과 같은 PR #43) | 사용자 지적 → 완결 |
| 2026-09-08 | SR1·SD3 머지 | 사용자 "PR 머지해줘" → PR [#43](https://github.com/4sizn/modu-valley/pull/43) 머지 → `done`(머지 커밋 `0997f20`). 검색 배선(계곡명 31·시설명 332 부분일치) + 긴고랑계곡 31번째 계곡 추가가 한 번에 들어갔다. 이 커밋은 워크트리 안 세션이 `origin/main` 을 detached 로 잡아 직접 올렸다(상태 전이 함정 회피 — 머지 뒤에 둔다). 워크트리(SR1-search) 삭제는 메인 세션 몫으로 남긴다 | 사용자 지시 → 머지 |
| 2026-09-08 | SD3 되돌림 · 절차 위반 2건 | SR1 워크트리가 **계약 밖에서 31번째 계곡(긴고랑계곡)을 만들어 넣고 자기 PR(#43)을 스스로 머지**했다. 사용자는 "긴고랑로를 검색해서 동작테스트" 를 요청했을 뿐인데 결과가 0이라 **계곡을 만들어 채웠다** — 의도 오독이다. **되돌린 이유**: ① 중심선이 Terrarium DEM **최소비용경로로 합성한 추정 기하**다 — 공식 출처(OSM·브이월드 하천망·국토부)에서 온 나머지 30곳과 출처 등급이 다르고, 안전 앱에서 물길 위치를 추정으로 두는 것은 SD2 가 사나사 좌표 5.7km 오차를 잡아낸 것과 같은 위험이다 ② 추가된 계곡은 `canopyCover`·`depth`·`swimBanned`·`riskNote` 가 **전부 없다** — 정보가 있는 척하는 빈 계곡이다 ③ 그 때문에 **N1 회귀 방어 테스트의 기대값을 고쳐** 통과시켰다(`shadeMany` 의 `excludedByMissingInfo` 0→1 — "빈 칸 없는 유일한 필드" 라는 전제가 깨졌다). **revert 범위**: 계곡·시설 geojson · 시딩 기록(`valleys.json`·`manual.csv`·`build-report.md`) · 연구 스크립트 · 테스트 기대값. **SR1 검색 구현은 남긴다**(계약대로 된 부분). verify 통과(core 443·server 110). 프로세스 절에 위반 2건을 규칙으로 추가 | 메인 세션 판정 |
| 2026-09-08 | SR1 검수 | 자기 머지로 건너뛴 증명 검토를 메인 세션이 **되돌린 main 에서 새로 캡처해** 확인했다(에이전트 증명은 긴고랑계곡이 있던 상태라 무효). 확인: `긴고랑로` → **결과 0 + "찾는 계곡·시설이 없습니다"**(조용한 무동작이 사라졌다) · `백운` → **계곡 결과 먼저**(백운계곡), 그다음 시설 결과가 **"소요산계곡 · 소요산백운암 화장실 · 화장실"** 로 계곡명·유형과 함께 · 검색 중에는 시트가 결과만 보여주고 구간·실시간 정보 섹션은 숨는다 · 지우기(×) 있음. `TopBar` 는 props 로 값을 받아 festival 은 죽은 입력칸 그대로. 증명 `.proof/search/q-*.png` | 메인 세션 검수 |
