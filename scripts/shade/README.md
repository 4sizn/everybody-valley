# scripts/shade — 그늘 빌드 파이프라인 (P1)

계곡 구간 GeoJSON(`data/*.geojson`)을 입력으로, 위성 자산(지형 + 수관 높이)에서 **시간대별 그늘**을 계산해
(1) 구간 속성 `shadeByHour`·`canopyCover`·`shadeRatio` 를 입력 파일에 **역기입**하고,
(2) 지도 레이어용 폴리곤 `data/shade/<valleyId>/*.geojson` 과 `data/shade/index.json` 을 쓴다.

방법은 R3c(`scripts/research/shade-pilot/canopy/README.md`)가 판정한 것을 **그대로** 구현했다 — 새 판단 없음(`docs/TODO.md` P1·D6).
사람이 그늘 값을 적는 일은 없다(D6: 수기 금지). 연구 디렉터리는 기록으로 남기고, 필요한 함수만 이 패키지로 옮겼다.

## 설치

Python 3.9+ (macOS 시스템 파이썬으로 충분). `uv` 가 없어도 된다.

```bash
python3 -m venv scripts/shade/.venv
scripts/shade/.venv/bin/pip install -r scripts/shade/requirements.txt
# uv 가 있으면
uv venv scripts/shade/.venv && uv pip install --python scripts/shade/.venv/bin/python -r scripts/shade/requirements.txt
```

의존성(R3c 환경과 같다): numpy 2.0.2 · rasterio 1.4.3 · shapely 2.0.7 · pyproj 3.6.1 · astral 3.2. `.venv/`·`.cache/` 는 gitignore.

## 실행

```bash
pnpm shade:build                       # = data/examples/example-valley.geojson (+ example-facilities) → data/shade/
pnpm shade:build -- --valley sample    # 한 계곡만
pnpm shade:build -- --no-backfill      # 입력 파일은 건드리지 않고 레이어만

# 직접 호출
PYTHONPATH=scripts scripts/shade/.venv/bin/python -m shade build \
  --segments data/examples/example-valley.geojson --facilities data/examples/example-facilities.geojson --out data/shade/
```

환경이 없으면 `pnpm shade:build` 는 설치 명령을 안내하고 멈춘다. 첫 실행은 자산 다운로드(계곡당 GLO-30 46 MB + CHM 창 10~55 MB)로
1~2 분, 이후는 캐시로 수 초. 계산은 계곡 1개 9시각에 2 m 격자 ~3 s + 폴리곤 ~2 s.

## 무엇을 계산하나 (R3c 확정 방법)

| 항목 | 값 |
| --- | --- |
| 자산 | 지형 Copernicus **GLO-30**(30 m, 1° 타일 — bbox + 6 km 가 걸치는 타일 전부, 캐시) · 수관 Meta/WRI **1 m CHM**(z9 quadkey 타일의 bbox 창만 HTTP 범위 요청, 경계에 걸치면 이웃 병합) · `CHM_acquisition_date.tif` 창(촬영 연월) |
| 격자 | UTM(bbox 중심 경도로 존 선택) **2 m**, 코어 = 구간·시설 경계 + 250 m, caster 여유 +200 m |
| 지반 | GLO-30 은 DSM(수관 포함) → **지반 = GLO-30 − CHM 30 m 블록 평균**, 표면 = 지반 + CHM |
| 그늘(셀, 시각) | **CHM > 2 m**(나무 아래) ∪ **그림자 전파**(태양 반대 방향 스캔라인, H > 표면 + 0.1 m, Bresenham 열 이동) ∪ **30 m 지형 마스크**(6 km 지평선) |
| 시각 | 대표일 **2026-08-01**, KST **10~18 정시 9개** — `shadeByHour` 인덱스 = `shadow-<HH>` 파일 = F4 슬라이더 스톱 |
| 구간 속성 | 라인 **±25 m 버퍼**(끝 자름, R3c 권고 — 물 + 양안 자갈밭을 덮고 라인 오차에 견딤) 셀의 그늘 비율 `shadeByHour[9]`, CHM > 2 m 비율 `canopyCover`, `shadeRatio` = 12시 값(호환). 소수 3자리 |
| 폴리곤 | **분리형** — `canopy.geojson` 1장(시각 무관) + `shadow-10 … shadow-18.geojson` 9장(개방지에 드리운 그림자 = 시각 그늘 − 수관). 범위 **구간 회랑 ±200 m**(`--facilities` 를 주면 시설 반경 200 m 도 포함), 3×3 닫힘→열림, 4-연결, **최소 25 m²**, **단순화 2 m**(preserve_topology), WGS84 `[lng, lat]` **소수 5자리** |

## 출력 규약

```
data/shade/
  index.json                      계곡별 builtAt·bbox·자산 버전(타일/quadkey/CHM 촬영연월)·태양 위치·구간 값·파일 크기
  <valleyId>/
    canopy.geojson                수관(CHM > 2 m) 폴리곤 — F4 가 항상 그린다
    shadow-10.geojson … shadow-18.geojson   시각별 개방지 그림자 — 슬라이더 시각의 것을 canopy 위에 겹친다. 비어 있어도 파일은 있다
```

- 레이어 파일은 한 줄 압축 JSON. 루트 `metadata`: `description`·`source`·`datasetVersion`(`YYYY-MM-DD.0`)·`collectedAt`·`coordinateOrder`·`crs`·
  `representativeDate`·`hours`·`chmAcquisition`(예 `["2016-12","2018-03"]`)·`assets`·`method`·`generator`·`builtAt`·`layer`·(`timeLocal`).
  Feature `properties`: `{ valleyId, layer: "canopy" | "shadow", date, timeLocal? }`.
- **역기입**: 입력 파일의 각 구간 `properties` 에 `shadeByHour`·`canopyCover`·`shadeRatio` 를 쓴다. 기존 `shadeRatio` 자리에 끼우고(수기 값은 덮어씀),
  없으면 끝에 붙인다. 파일 포맷(Prettier 식 들여쓰기 2·좌표 한 줄)과 키 순서는 보존한다 — 원본을 같은 규칙으로 재출력해 바이트가 같은지
  먼저 확인하고, 다르면 경고를 낸다.
- **결정성**: 입력·자산이 같으면 재실행은 diff 를 만들지 않는다. `builtAt` 은 "산출물이 마지막으로 바뀐 시각" — 이전 `index.json` 의 값으로
  먼저 렌더해 디스크와 같으면 그대로 두고, 하나라도 다르면 지금 시각으로 다시 쓴다(`collectedAt`·`datasetVersion` 도 그 날짜).
- 앱은 `apps/valley-map/scripts/sync-valley-data.mjs` 가 `data/shade/**` 를 `assets/valley/shade-bundle.json` **한 파일**
  (`{ index, valleys: { <valleyId>: { canopy, shadow: { "10": …, "18": … } } } }`)로 합쳐 읽는다(F4). 개별 사본은 두지 않는다.

## 스키마·도메인

`data/.schema/valleys.schema.json` `segmentProps`: `shadeByHour`(array, 9개, 각 0~1), `canopyCover`(0~1), `shadeRatio`(정오 값(산출)).
`packages/core` — `Segment.shadeByHour`·`canopyCover`, `SHADE_HOURS`/`SHADE_HOUR_COUNT`/`SHADE_NOON_INDEX`, 로더는 길이 9 가 아니거나 원소가 0~1 을 벗어나면 거절.
3단계 표시(`dense ≥ 0.5 / moderate 0.25~0.5 / sparse < 0.25`)는 표현 계층이 `canopyCover` 로 만든다(R3c 권고, 계곡 여럿을 돌려 본 뒤 조정).

## 한계 고지 (화면 문구 초안)

> **위성 기반 추정(수관 2016~2018 촬영), 현장과 다를 수 있음.**

- 촬영 연도는 계곡마다 다르다 — 화면은 파일 `metadata.chmAcquisition`(또는 `index.json` `assets.chm.acquisition`)에서 읽어 넣는다.
  CHM 은 겨울·이른 봄 영상이 많아 활엽 수관이 **과소**(그늘이 실제보다 적게) 나올 수 있고, 벌채·생장 미반영, MAE 2.8 m, 큰 나무 과소.
- GLO-30 은 DSM 이라 지반 보정(30 m 평균 CHM 차감)은 근사 — 저고도(17~18시) 지형 자기그림자에 격자 무늬가 섞일 수 있다.
- 하천 물 폴리곤이 없어 "물가"는 라인 버퍼로 근사. 라인 위치 오차 5~10 m.
- 태양 위치는 계곡 bbox 중심 1점(수 km 안에서 방위 차 < 0.1°).

## 검증 (P1, 2026-09-03)

R3c 와 같은 구간(백운계곡 3구간, `scripts/research/shade-pilot/out/segments.geojson`)을 이 파이프라인으로 돌려 `result-2m.json` 의
25 m 버퍼 값과 비교했다 — PR 본문 표 참조(허용 ±0.02). 샘플 계곡(`data/examples/example-valley.geojson`)은 백운과 다른 위치라 직접 비교 대상이 아니다.

## 데이터 출처·라이선스

- Meta/WRI **Global Canopy Height Map v1** (Tolan et al. 2024) — CC-BY 4.0, `s3://dataforgood-fb-data/forests/v1/alsgedi_global_v6_float/`.
- Copernicus DEM **GLO-30** — Copernicus DEM Licence, `s3://copernicus-dem-30m`.
- 태양 위치 — `astral` 3.2 (Apache-2.0).

## 모듈

`settings.py` 상수 · `assets.py` 타일/quadkey 취득·캐시 · `grid.py` 30 m `Dem`(지평선)·2 m `Grid`(보정 지반) · `sun.py` · `shadow.py` 그림자 전파·그늘 마스크 ·
`segments.py` 입력·버퍼·회랑·구간 집계 · `polygons.py` 폴리곤화·레이어 · `jsonfmt.py` Prettier 식 JSON(역기입 포맷 보존) · `build.py` 오케스트레이션 · `__main__.py` CLI.
