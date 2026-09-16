# data/seed — 시딩 입력 (사람이 편집하는 파일)

`pnpm seed:build`(`scripts/seed/README.md`) 의 입력. 자동 채움 결과(`data/valleys/`·`data/facilities/`)는 **직접 고치지 말고** 여기서 고친다.

| 파일 | 역할 | 편집 |
| --- | --- | --- |
| `valleys.json` | 계곡 30개 정본(R1 목록 그대로, 결정 (a)). 순서가 앱 목록 순서 | 보통 편집하지 않는다 |
| `manual.csv` | 구간 수기 항목(결정 (d)). 빌드가 빈 템플릿 행을 보충한다 — `value` 만 채우면 된다 | **사용자** |
| `splits.csv` | 상·중·하 분할 근거가 있는 계곡만(결정 (c)). 비어 있으면 전부 1구간 | 사용자 |
| `facilities-manual.csv` | 진입로·OSM 에 없는 시설(결정 (e)) | 사용자 |
| `std/` (gitignore) | data.go.kr 표준데이터 CSV(주차장·화장실) — `pnpm seed:std` 가 내려받는다 | 산출물(재다운로드 가능) |
| `source-comparison.{json,md}` | 좌표열 출처 비교표(결정 (b)) — `pnpm seed:compare` 산출 | 산출물 |
| `build-report.md` | 빌드 결과표(구간·시설·유역·접근) | 산출물 |

## manual.csv

```
valleyId,segmentId,field,value,sourceUrl,checkedAt,note,confidence
baegun-pocheon,baegun-pocheon-whole,depth,knee,https://www.pocheon.go.kr/...,2026-09-07,상류 무릎·중류 허리 혼재,medium
```

- `field`: `depth`(knee·waist·adult·mixed) · `bed`(gravel·rock·sand·mixed) · `swimBanned`(true·false) · `riskNote`(문장) ·
  `freeAccess` · `campingAllowed` · `petAllowed`(true·false) · `accessDifficulty`(easy·moderate·hard, 선택)
- `segmentId` 를 비우면 그 계곡의 모든 구간에 적용. `value` 가 비어 있는 행은 템플릿이라 무시된다.
- `sourceUrl`·`checkedAt`·`confidence` 는 파일에 쓰지 않고 이 CSV 에만 남는다 — 검수 추적의 진실. 채운 값의 출처는 꼭 적는다.
- **공식 출처만** 값으로 인정한다(사용자 결정, SD1b): 행안부 생활안전지도(safemap.go.kr), 지자체 go.kr, 국립공원공단·산림청·관광공사 or.kr. `confidence`: `high` = 생활안전지도·지자체 공고/보도자료, `medium` = 지자체 관광 페이지·휴양림 이용안내. `low` 는 쓰지 않는다 — 언론·블로그·정보 사이트 근거는 값을 비우고 note 에 '비공식 출처라 제거' 로 남긴다.
- swimBanned·riskNote·depth 는 `pnpm seed:safemap` 이 생활안전지도에서 덮어쓴다(매칭된 계곡만). 손으로 고치려면 그 행의 sourceUrl 을 safemap 이 아닌 공식 출처로 바꾼다(다음 실행이 다시 덮어쓰므로 스크립트 매칭 규칙을 먼저 바꾸는 편이 맞다).
- 같은 (계곡, 구간, 항목) 이 여러 행이면 아래 행이 이긴다.

## splits.csv

```
valleyId,segment,fromM,toM,splitBasis,sourceUrl,checkedAt,note
yongmunsan,upper,0,900,toponym,https://...,2026-09-07,용계골 합류점까지
yongmunsan,lower,900,2600,toponym,,,
```

- `fromM`·`toM`: 그 계곡 중심선(`data/valleys/<id>.geojson`, 상류 → 하류) 의 **상류 끝에서 잰 거리(m)**. 중심선 길이는 파일 `metadata.description` 에 있다.
- `splitBasis`: `toponym`(지명) · `safemap`(물놀이관리지역 구역) · `facility`(주차장·진입점). 근거 URL 을 `sourceUrl` 에.
- 행이 있는 계곡은 행대로만 잘린다(1구간 `whole` 이 사라진다). 구간 id 는 `<valleyId>-upper|mid|lower` 가 되므로 `manual.csv` 의 `segmentId` 도 그에 맞춘다(빌드가 템플릿 행을 새로 보충한다).

## facilities-manual.csv

```
id,valleyId,name,facilityType,lng,lat,capacity,feeNote,operatingHours,sourceUrl,checkedAt,note
baegun-pocheon-access-1,baegun-pocheon,백운계곡 입구 진입로,access,127.4312,38.0889,,,,https://...,2026-09-07,
```

- `facilityType`: parking · restroom · food · cafe · store · station · access · safety · etc. 좌표는 `[lng, lat]` 소수 6자리.
- 같은 `id` 가 자동 시설과 겹치면 수기가 이긴다(자동 값을 고치는 방법).
