# scripts/seed — 계곡 실데이터 시딩 (SD1)

`docs/TODO.md` **SD1** 결정 (a)~(h) 를 구현한 스크립트. 계곡 30개(`data/seed/valleys.json`, R1 목록 그대로)에 대해
구간 GeoJSON `data/valleys/<valleyId>.geojson` 과 시설 GeoJSON `data/facilities/<valleyId>.geojson` 을 **자동 채움**으로 만들고,
사람이 채우는 항목은 `data/seed/manual.csv` 한 장에서 병합한다. 앱은 `apps/valley-map/scripts/sync-valley-data.mjs` 가 만든
합본(`valleys-bundle.json`·`facilities-bundle.json`)을 읽는다.

TypeScript(`.mts`, `tsx` 실행). `pnpm verify` 의 biome 검사를 받는다(`console` 금지 — `log.mts`). 타입 검사는 `npx tsc --noEmit -p scripts/seed/tsconfig.json`.

## 실행

```sh
pnpm seed:compare                       # (b) 출처 비교표 → data/seed/source-comparison.{json,md}
pnpm seed:build                         # 30개 자동 채움 → data/valleys·facilities, data/seed/build-report.md, manual.csv 템플릿 보충
pnpm seed:build --valley baegun-pocheon # 일부만 (긴고랑처럼 중심선을 손으로 만든 계곡은 구간 파일을 두고 시설만 갱신 — build.mts HAND_BUILT_CENTERLINE)
pnpm seed:build --shade                 # 쓰기 뒤 P1 그늘 파이프라인을 계곡별로(계곡당 ~35 s, 첫 실행은 자산 다운로드)
pnpm seed:build --only-shade            # 파일은 두고 그늘만
pnpm seed:elevation [--valley id] [--dry] # 중심선 표고 중앙값(Terrarium) → data/valleys/*.geojson `elevationM` (단풍 기온 보정)
pnpm seed:std                           # (e) 표준데이터 CSV 내려받기 → data/seed/std/ (주차장·화장실·휴지통·도시공원)
pnpm seed:playgrounds                   # (e) 행안부 어린이놀이시설 API 전수(약 8,500 요청, 하루 한 번) → data/seed/std/전국어린이놀이시설정보.csv
pnpm seed:peaks [--valley id]           # 계곡 주변 봉우리(OSM natural=peak, 중심선 3 km) → data/peaks/<id>.geojson (지도 라벨·"주변 산")
pnpm seed:safemap [--dry-run]           # (d) 생활안전지도 물놀이관리지역 → manual.csv 의 swimBanned·riskNote·depth (공식 출처)
```

```sh
python3 scripts/seed/access-xlsx.py --xlsx <고시 xlsx> --tag jungbu-2025 --agency 중부지방산림청 --url <고시 URL> \
    --season 2025-01-24:2025-05-15 --season 2025-11-01:2025-12-15   # 입산통제 고시 xlsx → data/seed/access/<tag>/
pnpm seed:access --tag jungbu-2025 [--probe 3] [--dry]              # 필지 지번 → 브이월드 PNU·폴리곤 → 계곡 교차 → data/access/<tag>.json
```

**입산통제(계곡 기준)** — 지방산림청 고시 첨부 xlsx 의 통제구역·등산로 필지 지번을 브이월드로 폴리곤화해 계곡 중심선 300 m 버퍼와
겹치는 계곡에 `closed-area` / `trail-open` / `trail-closed` 기록을 붙인다(basis `parcel`). 리·산 이름 대조는 하지 않는다 — 폴리곤이 없는
지자체 고시는 후속. 브이월드 폴리곤은 저장·캐시하지 않고 PNU 만 남긴다(약관 §19). 통제 기간은 `meta.json` 의 `seasons`. 결과 파일에는
계곡 id·기간·PNU·거리만 있다. `--probe N` 은 지역 필터를 무시하고 앞 N 필지로 브이월드 경로만 점검한다(파일을 쓰지 않는다).

키는 저장소 루트 `.env.local` 의 `VWORLD_API_KEY`(유역 코드·하천망 비교). 없으면 그 단계만 건너뛴다. 값은 로그·오류에 찍히지 않는다.
응답 캐시는 `scripts/seed/.cache/`(gitignore) — Overpass·Terrarium 만 저장하고, **브이월드 응답은 통계·코드만 남긴다**(약관 §19).
캐시를 지우면 다시 받는다(Overpass 는 요청 간 1 s, 브이월드 100 ms 이상 간격).

재실행은 안전하다: 자동 채움 → 수기 병합 순서라 수기 값이 덮이지 않고, 내용이 같으면 파일의 날짜(`datasetVersion`·`collectedAt`)도 바꾸지 않는다.
그늘 값(`shadeByHour`·`canopyCover`·`shadeRatio`)은 기존 파일에서 그대로 옮긴다.

## 단계 (결정 (h))

| 단계 | 소스 | 처리 | 모듈 |
| --- | --- | --- | --- |
| 계곡 목록 | `data/seed/valleys.json` (a) | id·name·region·lng·lat·source. 순서 = 앱 목록 순서 | `valleys.mts` |
| 출처 비교 | 브이월드 WFS `lt_c_wkmstrm` · Overpass `waterway~stream\|river` (b) | 계곡 점 반경 2 km: 하천망 피처 수·기하·정점/km·최근접 거리 vs OSM way 수·name·정점/km·길이. 판정 `recommended`(정밀도) / `stored`(실제 저장) | `compare.mts` `vworld.mts` `overpass.mts` |
| 좌표열 | OSM way (b) | 계곡 점에 가장 가까운 way 에서 시작해 끝 노드가 같은 way 를 이어 붙임(같은 이름 → 가장 긴 가지). 지류가 본류 옆구리로 합류하면 본류를 그 노드에서 잘라 하류만 이어 붙임. 방향은 OSM 규약(하류 방향) + Terrarium 표고 검증(20 m 넘게 거꾸로면 뒤집고 경고). 계곡 점 투영 지점에서 **상류 2 km · 하류 1 km** 절단 | `centerline.mts` |
| 구간 | `data/seed/splits.csv` (c) | 행이 없으면 **1구간 `whole`**(`splitBasis: none`). 행이 있으면 상류 끝 기준 `fromM~toM` 으로 상·중·하를 자르고 `splitBasis`(toponym·safemap·facility)를 남김 | `splits.mts` |
| 유역 코드 | 브이월드 WFS `lt_c_wkmsbsn` | 구간 중간점 → `sbsncd` 만 저장(`basinCode`). 폴리곤 저장 없음. 서버 `/api/basins` 와 같은 조회 | `vworld.mts` |
| 시설 | 표준데이터 CSV(`data/seed/std/`, 있을 때) + OSM amenity + `facilities-manual.csv` (e) | 계곡 점 반경 3 km. 같은 종류 50 m 안 중복 제거(표준↔OSM, 표준↔표준), 수기가 최종 | `facilities.mts` |
| 쓰레기통·놀이터 | 전국휴지통·도시공원(유희시설) 표준데이터 + 어린이놀이시설 API CSV + OSM `leisure=playground`·`amenity=waste_*\|recycling` (2026-09-23) | 정자처럼 **중심선 기준** `EXTRA_MAX_FROM_LINE_M` 1,200 m — 계곡 점 반경으로 받으면 하류 주택가 가로쓰레기통이 수백 개 들어온다. 놀이시설 API 는 운영·실외만 | `facilities.mts` `overpass.mts` |
| 봉우리 | OSM `natural=peak` + `name` (2026-09-23) | 중심선 bbox + 3 km 로 받아 중심선 거리 3 km 안만, `ele` 는 숫자로 풀리는 것만 `elevationM`. 앱은 자체 GeoJSON 소스로 "▲ 이름 표고m" 라벨을 그린다 — 베이스맵 타일 라벨은 3D 지형 + z ≥ 14 오버줌에서 MapLibre 가 그리지 않는다(실측) | `peaks.mts` `overpass.mts` |
| 접근 | 가장 가까운 주차장 ↔ 구간 시작점 | `accessDistanceM`(직선, 3 km 안일 때만) · `accessGradePct`(Terrarium 표고차 / 거리) | `build.mts` `elevation.mts` |
| 그늘·수관 | `scripts/shade`(P1) | `--shade` 로 계곡별 호출 → `shadeByHour`·`canopyCover`·`shadeRatio` 역기입 + `data/shade/<id>/` | `shade.mts` |
| 안전 항목 | 행안부 생활안전지도 물놀이관리지역 JSON (d) | 관할 시군 전수 조회(`.cache/safemap/`) → 중심선과 거리 매칭(1,500 m / 읍면·리 일치 2,500 m / 지점명 일치) → `manual.csv` 의 swimBanned(위험지역 → true)·riskNote(관리구분·최대/평균 수심 그대로)·depth(평균 수심 환산) 를 confidence `high` 로 덮어씀. 표 `data/seed/safemap-matches.md` | `safemap.mts` |
| 수기 병합 | `data/seed/manual.csv` (d) | depth·bed·swimBanned·riskNote·freeAccess·campingAllowed·petAllowed(+ accessDifficulty). `segmentId` 비우면 계곡 전체. **공식 출처만**(생활안전지도·지자체 go.kr·국립공원공단/산림청/관광공사 or.kr) — `confidence` 열 high(생활안전지도·지자체 공고)/medium(지자체 관광 페이지·휴양림), 언론·블로그는 값 없이 note 에 '비공식 출처라 제거' | `manual.mts` |
| 검증 | core `loadValleyBundle` | 30세트를 한 번에 로드 — 스키마 enum·기하·중복 id·계곡 불일치를 잡는다. 실패하면 아무 파일도 쓰지 않는다 | `build.mts` |
| 쓰기 | `data/valleys/*.geojson` · `data/facilities/*.geojson` | Prettier 식 포맷(`format.mts` = `scripts/shade/jsonfmt.py`) — 그늘 역기입과 바이트 호환. `metadata.verified: desk`, `sources[]`(OSM·Terrarium·브이월드·표준데이터 URL) | `format.mts` |
| 보고 | `data/seed/build-report.md` | 계곡별 구간 수·OSM 하천·중심선 길이·오프셋·표고·유역·주차장(표준/OSM/수기)·화장실·식음·접근 | `build.mts` |

## 사용자가 채울 것 (우선순위 순)

SD1a 는 수기 항목을 **전부 빈 칸**으로 두었고, SD1b 에서 **공식 출처만**으로 1차 채웠다(사용자 결정 "공식적인 정보 기반으로 세팅"): 생활안전지도(`pnpm seed:safemap`) + 지자체·휴양림·국립공원 페이지. 언론·블로그·정보 사이트 근거는 값 없이 note 만 남겼다. 남은 빈 칸을 채울 때도 같은 기준 — `sourceUrl` 은 go.kr / or.kr / safemap.go.kr, `confidence` 는 high(공고·생활안전지도) 또는 medium(관광 페이지·휴양림). `data/seed/README.md` 에 열 설명이 있다.

1. **`swimBanned` · `riskNote`** — 생활안전지도 물놀이관리지역(WMS 화면에서 확인, `docs/API_KEYS.md` §3)과 지자체 공고. 안전 정보라 가장 먼저.
2. **`depth` · `bed`** — 지자체 관광 페이지·블로그 3건 교차(R4 기준). 값은 knee·waist·adult·mixed / gravel·rock·sand·mixed.
3. **`freeAccess` · `campingAllowed` · `petAllowed`** — 지자체 공고(자릿세·야영 금지·반려동물).
4. `accessDifficulty`(easy·moderate·hard) — 자동 산출이 없어 선택 항목으로 열어 두었다.
5. 표준데이터는 `pnpm seed:std` 로 받는다(아래) — 새 배포본이 나오면 다시 받고 `pnpm seed:build`.
6. **`splits.csv`** — 지명(상류/중류/하류·○○골)·물놀이관리지역 구역·주차장/진입점으로 상·중·하 구분 근거가 있는 계곡만.
   `fromM`·`toM` 은 상류 끝에서 잰 거리(m). 근거 없는 계곡은 1구간으로 둔다(결정 (c)).
7. **`facilities-manual.csv`** — 진입로(`access`)·OSM 에 없는 매점·화장실. 좌표는 지도에서 읽어 소수 6자리.

## 표준데이터 CSV — `pnpm seed:std` 가 내려받는다

표준데이터 페이지의 "CSV 다운로드" 버튼은 서버 파일이 아니라 **브라우저가 두 JSON 엔드포인트로 조립**하는 것이다
(`/js/biz/mvc/std/std-download-manager.js`: `GET /download/columList.json?pk=…&ext=CSV` → 열 목록·건수, `GET /download/standard.json?publicDataPk=…&colNmList=…&perPage=10000&page=n` → 행).
둘 다 로그인 없이 응답한다(2026-09-06 Orca 브라우저에서 확인 — 처음 시도한 `stdFileDown.do` 404 는 존재하지 않는 폼 경로였다).
`std.mts` 가 같은 요청을 Node 로 하고 UTF-8(BOM) CSV 를 `data/seed/std/`(gitignore)에 쓴다. 요청 간 1 s.

```sh
pnpm seed:std              # 주차장 + 화장실 + 휴지통 + 도시공원
pnpm seed:std parking      # 하나만 (parking | restroom | bin | park)
pnpm seed:playgrounds      # 어린이놀이시설 API (표준데이터 아님 — 아래)
pnpm seed:build            # 매칭
```

| 데이터 | pk | 파일 | 쓰는 열 | 2026-09-06 실측 |
| --- | --- | --- | --- | --- |
| 전국주차장정보표준데이터 | 15012896 | `data/seed/std/전국주차장정보표준데이터.csv` | 주차장명·주차장관리번호·주차구획수·요금정보·평일운영시작/종료시각·위도·경도 | 18,878행, 좌표 있음 18,117 |
| 전국공중화장실표준데이터 | 15012892 | `data/seed/std/전국공중화장실표준데이터.csv` | 화장실명·개방시간·위도·경도 | 33,820행, 좌표 있음 27,040 — 페이지 고지("2025-02 좌표 제공 중단")와 달리 이 엔드포인트에는 좌표가 남아 있다 |
| 전국휴지통표준데이터 | 15129450 | `data/seed/std/전국휴지통표준데이터.csv` | 설치장소명·휴지통종류·위도·경도 | 3,732행(2026-09-23), 35개 지자체만 제공. 우리 계곡 관할 중엔 광진·강북(서울)·광주·파주·동두천 |
| 전국도시공원정보표준데이터 | 15012890 | `data/seed/std/전국도시공원정보표준데이터.csv` | 공원명·공원보유시설(유희시설)·위도·경도 — 유희시설이 비어 있지 않은 공원만 놀이터로 | 18,295행(2026-09-23), 유희시설 있는 공원 5,939 |

**어린이놀이시설 API**(행정안전부_전국어린이놀이시설정보서비스 15124519, `apis.data.go.kr/1741000/pfc3/getPfctInfo3`)는 표준데이터가 아니라 `serviceKey` 가 필요한 Open API 다 — `DATA_GO_KR_KEY_ENCODING` 으로 활용신청(자동승인, 2026-09-23 승인)해 두었다. 지역 필터 파라미터가 없고 `numOfRows` 가 10 으로 고정돼 전수 85,346건 = 8,535 요청. 개발계정 한도 10,000/일 이라 `pnpm seed:playgrounds` 는 **하루 한 번**만. 설치장소유형(도시공원·주택단지·야영장·유원지·식당…)·운영여부·실내외를 CSV 에 남기고, 시더는 운영·실외만 쓴다.

인코딩은 UTF-8(BOM)·EUC-KR 둘 다 읽는다. 파일이 없으면 경고만 내고 OSM·수기로 진행한다. 출처는 공공누리 1유형(출처표시) — 사용된 파일이 있는 계곡의 `metadata.sources` 에 페이지 URL 이 붙는다.

## 판단 (SD1a 에서 정한 것 — TODO SD1 절에 기록)

- **출처 비교 지표**: 하천망은 실폭 폴리곤이라 "정점/km" 를 외곽선 길이로 냈고 OSM 은 중심선 길이로 냈다 — 서로 다른 것의 밀도라 같은 잣대가 아니다.
  표는 결정 (b) 가 요구한 항목을 그대로 실었고, 판정 규칙(계곡 점 500 m 안을 지나고 밀도 ≥ OSM → 하천망 권고)은 `compare.mts` 상수로 두어 바꿀 수 있다.
- **저장은 전부 OSM**: 하천망 권고 13개도 브이월드 약관 답신 전이라 저장하지 않았다. 국토부 국가공간정보포털 하천망 파일이 오면 `stored` 를 바꾼다.
- **중심선 오프셋**: 계곡 점(R1 검색 결과·수기)이 OSM 하천에서 500 m 넘게 떨어진 계곡은 report 의 오프셋 열로 드러난다 — 계곡 점이 입구·호수·휴양림이거나
  OSM 이 그 골짜기 지류를 갖고 있지 않은 경우다. 좌표열은 그 계곡 점에 **가장 가까운** OSM 하천을 쓰므로 다른 물줄기일 수 있다. 사용자 확인 대상.
- **1구간**: 30개 전부 `whole` — 지명·물놀이관리지역·시설 근거를 계곡별로 확인하지 않은 채 나누지 않는다(결정 (c)). OSM 에 `○○골` 이름이 붙은 지류가 있는
  계곡(용문산·사나사·우이동)은 `splits.csv` 의 첫 후보다.

## 라이선스·출처 표기

- OpenStreetMap — © OpenStreetMap contributors, ODbL. 파일 `metadata.sources` 에 https://www.openstreetmap.org/copyright.
- 브이월드(국토교통부) — 표준유역 코드 조회에만 사용, 기하 미저장. 이용 표시 의무(약관 §13⑨)로 `sources` 에 남긴다.
- Terrarium(Mapzen/AWS Open Data) — 표고. https://registry.opendata.aws/terrain-tiles/
- 표준데이터(공공데이터포털, 공공누리 1유형, 출처표시) — 주차장 15012896 · 공중화장실 15012892. 매칭된 시설이 있는 계곡의 `sources` 에 붙는다.
- 앱 화면의 표기(목록 footer·설정 정보 카드)는 SD1b.
