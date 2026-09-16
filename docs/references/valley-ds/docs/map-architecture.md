# 지도 아키텍처 분석 — spotts.kr/firework

DevTools 실측 + 번들 심볼 복원. 2026-09-01 기준.
번들에 export 이름이 그대로 남아 있어 모듈 구조까지 복원 가능했습니다.

표기: **[확정]** 직접 관측 · **[추정]** 근거 있는 추론 · **[미확인]** 확인 못 함

---

## 1. 렌더러 구성 [확정]

```
<MapShell>                  라우트별 오버레이/시트 정책 (MapShellContext)
 └ <MapLibreMap>            base map health 감시 래퍼 (onError / onSourceData)
    └ <MapView>             react-map-gl <Map> 얇은 래핑
       └ maplibre-gl v6.6.0
```

실제 props (번들 원문):

```jsx
<Map
  mapStyle={styleByMode[mode]}                     // /api/map/style/{dark|light}
  canvasContextAttributes={{ antialias: true }}
  localIdeographFontFamily={
    "'Geist','Apple SD Gothic Neo','Noto Sans CJK KR','Malgun Gothic', sans-serif"
  }
  workerUrl={props.workerUrl ?? "/maplibre-gl/maplibre-gl-worker.mjs"}
  dragPan={{ linearity: 1, deceleration: 2300, maxSpeed: 2200 }}   // MAP_PAN_INERTIA
  attributionControl={{ compact: true }}
  initialViewState={computeInitialMapView(lastLocation ?? SEOUL_CITY_HALL, insets)}
  onError={noteBaseMapFailure}
  onSourceData={noteBaseMapSuccess}
/>
```

런타임 실측값:

| 항목 | 값 |
|---|---|
| minZoom / maxZoom | -2 / 22 (기본값 그대로) |
| minPitch / maxPitch | 0 / 85 |
| maxBounds | null (제한 없음) |
| renderWorldCopies | true |
| terrain | 미사용 |
| 컨트롤 | attribution 하나뿐 — Navigation/Geolocate 컨트롤 안 씀, 직접 만든 FAB로 대체 |
| 워커 | self-host (`/maplibre-gl/maplibre-gl-worker.mjs`, ESM) |

초기 카메라는 `localStorage["spot:home:last-location:v1"]`에서 마지막 위치 복원 →
없으면 `SEOUL_CITY_HALL = { longitude: 126.9784, latitude: 37.5666 }`.

---

## 2. 모듈 아키텍처 [확정]

### 훅 레이어 — 관심사가 완전히 분리돼 있음

| 훅 | 역할 |
|---|---|
| `useMapShell` / `MapShellContext` | 라우트 ↔ 지도 셸 연결 |
| `useMapLifecycle` | 로드/언마운트 |
| `useMapCamera`, `useMapCameraCommands` | easeTo 래퍼 |
| `useMapCommandStore` (zustand) | 명령 버스 — `panCommand` / `addCommand`를 증가 id로 발행 |
| `useMapViewport`, `useMapViewportReport` | 뷰포트 상태·보고 |
| `useMapPicking`, `useMapPick`, `useMapPickStore` | 지도에서 좌표 찍기 모드 |
| `useMapClickRouting`, `useMapLongPress` | 클릭→라우팅, 롱프레스 |
| `useMapGestureStore`, `useMapImmersiveStore`, `useMapOverlayStore` | 제스처·몰입·오버레이 상태 |
| `usePinLayerBelow`, `useMinZoomActive` | 레이어 순서, 줌 게이팅 |
| `usePublishedMapStyle` | 스타일 원격 로딩 |

### 레이어 컴포넌트

`FireworkMapLayers` · `FireworkSubwayLayer` · `FireworkRouteLayer` · `SubwayMapLayer` ·
`FavoriteLayers` · `PublicPlacesLayer` · `SpecialPlacesLayer` · `OriginDataLayers` ·
`RouteDirectionsLayer` · `FolderRouteLayer` · `AreaMapLayers` · `AreaMap3DLayer` · `ThreeSceneLayer`

**하이브리드 패턴**: 레이어는 JSX로 선언하지만 내부는 `useMap().current.getMap()`으로
인스턴스를 잡아 명령형으로 `addSource`/`addLayer`. react-map-gl의 `<Source>/<Layer>`는 안 씁니다.

> 왜 이렇게 하는가 — 표현식이 긴 심볼 레이어를 JSX prop으로 들고 있으면 매 렌더 diff 비용이 크고,
> 아이콘 로딩·필터 재평가 같은 명령형 작업을 섞기 어렵습니다. 계곡도 같은 선택을 권합니다.

### 슬롯 기반 레이어 순서

`AREA_MAP_SLOT_TOP / SYMBOLS / POI / PARKING / REFERENCE` + `isTopLayer` + `usePinLayerBelow`.
`beforeId` 문자열을 코드 여기저기 흩뿌리지 않고 슬롯 상수로 관리합니다.
firework 레이어들은 실측상 스타일 최상단에 순서대로 append돼 있습니다.

---

## 3. 아이콘 파이프라인 [확정] — 가장 잘 만든 부분

MapLibre v6의 `setMissingStyleImageResolver`를 사용 (v5 `styleimagemissing` 이벤트의 대체).

```js
// 맵 인스턴스당 resolver 레지스트리를 WeakMap에 두고 여러 레이어가 공유
map.setMissingStyleImageResolver(async (id) => {
  await Promise.all([...resolvers].map((r) => r(id)));
});

// 개별 resolver
async (id) => {
  if (!alive(map) || map.hasImage(id)) return;
  const inflight = pending.get(id);
  if (inflight) return inflight;              // 중복 요청 차단
  const svg = buildSvg(id);                   // id → SVG 문자열
  if (!svg) return;
  const p = toImageBitmap(svg).then((bmp) => {
    if (alive(map) && !map.hasImage(id))
      map.addImage(id, bmp, { pixelRatio: MARKER_ICON_PIXEL_RATIO }); // 2
  });
  pending.set(id, p);
  try { await p; } finally { pending.delete(id); }
}
```

언마운트 시 자기 resolver만 빼고, 마지막 하나가 빠지면 `setMissingStyleImageResolver(null)`.

### 규격

| 상수 | 값 |
|---|---|
| `MARKER_ICON_DP` | 40 |
| `MARKER_ICON_RASTER_PX` | 80 |
| `MARKER_ICON_PIXEL_RATIO` | 2 |
| `MARKER_PIN_DP_W × H` | 30 × 38 |
| `MARKER_BUBBLE_CONTENT_TO_TIP_DP` | 11 |
| `BASE_MAP_MAKI_ICON_SIZE` | 24 |
| `MARKER_STROKE` | `{ light: "#ffffff", dark: "#1c1c1e" }` |

### 아이콘 ID가 곧 명세

```
firework-marker:spot
firework-marker:spot-selected
firework-marker:facility:restroom
seoul-bike-marker:low
seoul-bike-marker:selected:available
```

레이어에서 `["concat", "firework-marker:facility:", ["match", ["get","facilityType"], ...]]`로 조립.
없는 ID가 나오면 resolver가 그 자리에서 굽습니다.

### SVG 팩토리

`markerPinIconSvg` / `markerMakiPinIconSvg` / `markerMakiPinGlyphSvg` /
`markerPlainCircleSvg` / `markerTextBubbleSvg` / `markerGlyphIconSvg`
(+ `MARKER_PIN_BODY_PATH_D`, `MARKER_PIN_BORDER_PATH_D`, `MARKER_PIN_BODY_TRANSFORM`)

### 테마 전환

`refreshMarkerIconsByPrefix(prefix)` → 같은 ID로 다시 그려 넣고 `map.triggerRepaint()`.
`style.load`마다 재실행하고, 완료 후 필터를 강제 재평가합니다:

```js
for (const id of [SPOT_LAYER, FACILITY_LAYER, FACILITY_DETAIL_LAYER])
  if (map.getLayer(id)) map.setFilter(id, map.getFilter(id) ?? null);
```

### 프리로드

`preloadMarkerIcons(map, combos)`로 첫 렌더 전 필요한 것만 굽고 나머지는 lazy.
`deriveVisibleIconCombos` / `preloadVisibleIcons`가 "지금 화면에 나올 조합"만 계산합니다.

### 베이스맵 POI도 런타임 재색칠

`applyBaseMapMakiPoiLayers`가 OMT `class`를 `spotts-poi-dark:{class}`로 치환하고
`BASE_MAP_MAKI_ICON_COLOR_BY_NAME`으로 색을 입힙니다.
**스프라이트를 다시 굽지 않고 테마별 POI 아이콘을 만드는 방법.**

---

## 4. 인터랙션 [확정]

- react-map-gl `interactiveLayerIds`에 `FIREWORK_INTERACTIVE_LAYER_IDS` 전달.
  라이브러리가 `mousemove`에서 hover 결과를 캐시했다가 `click` 때 `e.features`로 재사용
  → 클릭마다 `queryRenderedFeatures` 재호출하지 않음
- **선택 상태는 `feature-state`가 아니라 properties**:
  `selected: true`를 심어 `setData` 전체 재주입. 모든 표현식이 `["get","selected"]`.
  피처 100~2,700개 규모라 성능보다 코드 단순함을 택한 것으로 보입니다 [추정]
- `getPlaceNameAtPoint`: `queryRenderedFeatures`에서 `sourceLayer === "poi"`를 찾아
  `name:ko` → `name` 순으로 폴백
- 롱프레스 → 좌표 픽 모드(`useMapPickStore`, `classifyMapPickPurpose`, `buildMapPickPinSpec`),
  픽 열기/닫기를 `track("map_pick_opened"/"map_pick_closed")`로 계측

---

## 5. 카메라 [확정] — 계곡에 제일 중요한 부분

바텀시트가 덮는 만큼 지도 중심을 **위로 밀어** 보정합니다.

```js
map.easeTo({
  center: [lng, lat],
  zoom: opts.zoom ?? FOCUS_ZOOM,                                  // 15
  offset: [0, opts.offsetY ?? -measuredCenterOffsetPx()],
  duration: opts.duration ?? focusDurationMs(cameraPanDistancePx(map, target)),
});
```

- `cameraPanDistancePx(map, target)` = `hypot(project(target) - project(center))`
  → **이동 거리에 비례한 duration**. 가까운 이동은 짧게, 먼 이동은 길게
- `measuredCenterOffsetPx` / `measuredTopInsetPx` / `snapCenterOffsetPx(snap)`
  → 현재 시트 스냅과 상단 인셋을 실측해 "실제로 보이는 사각형"의 중심을 구함
- `isMapCoveredBySheet(map)`: 남은 지도 높이가 컨테이너의 **25% 미만**이면 덮인 것으로 판정
  → 시트를 `middle` 스냅으로 낮춘 뒤 카메라 이동
- `getVisibleRectCorners` / `getVisibleCenterCoords` — fitBounds 대신 가시 사각형 기준 계산
- 여러 좌표를 담을 때는 `scalePoint`로 가장 가까운 점 기준 비례 축소 (fitBounds 미사용)

### 시트 스냅 포인트

| 라우트 | snap points |
|---|---|
| home / explore | `["106px", "540px", "100%"]` |
| list | `["106px", "360px", "100%"]` |
| firework | `[m, "360px", "100%"]` |
| firework feed | `[m, "360px", "80%"]` |
| firework spots | `[m, "60%"]` |
| place | `["192px", "368px", "80%"]` |
| folder timeline | `["266px"]` |

`snapPointToRatio` / `snapPointToOffsetExpr` / `snapPointsToMaxHeightExpr`로 px·% 혼용을 처리하고,
URL에서 스냅을 읽습니다(`readStopSnapFromUrl`) — **시트 위치가 URL 상태**.

---

## 6. 줌 상수 [확정]

| 상수 | 값 | 의미 |
|---|---|---|
| `INITIAL_ZOOM` / `FOCUS_ZOOM` / `LOCATE_MIN_ZOOM` | 15 | 진입 · 포커스 · 내 위치 |
| `FIREWORK_MIN_ZOOM` | 11.8 | 행사 레이어 등장 |
| `LABEL_MIN_ZOOM` | 9 | 라벨 |
| `CATEGORY_LABEL_MIN_ZOOM` | 13.5 | 카테고리 라벨 |
| `SUBWAY_LINE_MIN_ZOOM` / `SUBWAY_MIN_ZOOM` | 12 / 15 | 노선 → 역 |
| `PLACE_TILE_MIN_ZOOM` / `MAX_ZOOM` | 13 / 20 | 장소 타일 |
| `PROXIMITY_BUBBLE_RADIUS_PX` | 150 | 근접 말풍선 반경 |

---

## 7. 위치 추적 [확정]

```js
navigator.geolocation.watchPosition(onFix, noop, {
  enableHighAccuracy: false,
  maximumAge: 30_000,
  timeout: 30_000,
});
```

- `visibilitychange`로 start/stop — 백그라운드에서 watch 중단
- heading은 `speed >= 2 m/s`일 때만 채택 (정지 상태 노이즈 제거)
- zustand store에 `location` / `accuracy` / `course` 저장
- 마지막 위치는 `localStorage["spot:home:last-location:v1"]`에 영속 → 다음 진입 초기 카메라
- 정밀 모드는 별도 경로: `PRECISION_MAX_AGE_MS` + `highAccuracy: true`,
  `STALE_FIX_MAX_AGE_MS`로 낡은 fix 거부

---

## 8. 장애 대응 [확정]

베이스맵 헬스 상태 기계가 따로 있습니다.

```
onError(e)
  └ isBaseMapResourceError(e, style, sources, origin)   // 같은 오리진 타일/스타일 오류만
      └ noteBaseMapFailure(health, now)
          └ armedAt 설정 → OUTAGE_SUSTAIN_MS 후 evaluateBaseMapOutage
              └ outage === true → <BaseMapOutageNotice onRetry={...}/>

onSourceData(e)
  └ e.tile 있고 isBaseMapSource(...) 일 때만
      └ noteBaseMapSuccess(health) + 타이머 해제
```

- 스타일 요청 자체가 실패하면 「지도를 불러오지 못했어요」 + `RetryState`
- 재시도는 `reloadBaseMapSources(map, origin)` — **소스만 다시 로드, 맵 재생성 없음**
- `isBaseMapSource` 판정 결과를 `Map`에 캐시해 매 이벤트 재계산 방지

---

## 9. 타일 서빙 [확정]

| 항목 | 값 |
|---|---|
| URL | `https://tile.spotts.kr/korea/{z}/{x}/{y}.mvt?v=20260830-054121` |
| Content-Type | `application/x-protobuf` |
| Cache-Control | `public, max-age=86400, stale-while-revalidate=604800` |
| 빈 타일 | **`204 No Content`** (404 아님) — MapLibre가 조용히 넘어가고 에러 카운터도 안 올라감 |
| 스프라이트 | `max-age=604800` |
| 스타일 JSON | `max-age=7200` (Vercel 캐시 HIT) |
| 타일셋 maxzoom | 14 → 그 이상은 오버줌. z14 타일 실측 2.7KB |
| 버전 관리 | 파일명 해시가 아니라 **URL 쿼리** `?v=날짜-시각` → CDN 퍼지 없이 배포 |

보조 타일 소스:
`DEFAULT_MAP_TILE_URL = "/api/map/map-tiles/{z}/{x}/{y}"` (본체는 자체 API로 프록시),
`ORIGIN_TILEJSON_URLS = { roadAddress, spot, entrance }` → `https://t.bdyne.us/*.json?t=1`

---

## 10. 이 페이지 밖의 지도 기능 [확정 — 번들에 동봉]

- **실내/구역 3D 지도**: `AreaMapScene3D`, `ThreeSceneLayer`, `AreaMap3DLayer` + Three.js 전체.
  `syncCamera`로 MapLibre 카메라를 Three 카메라에 미러링, `projByViewInv` 행렬로 레이캐스트 좌표 변환.
  층 선택(`AreaMapFloorPicker`), 주차 구획(`useParkingGeometryOverlay`, `findStallForPoint`),
  유닛/문/엘리베이터/에스컬레이터/계단/벽/창 레이어
- **라우팅**: `RouteDirectionsLayer`, `createRoutePath`, `routeWaypoints`, `chunkWaypoints`,
  `formatRouteDuration`, from/to 마커(`#22c55e` / `#ef4444`)
- **지오펜스**: `syncGeofences`, `ackGeofenceEvents`, `updateEnRouteProgress`, 자동 체크인
- **장소 타일**: `GEOJSON_PLACES_SOURCE_ID`, `placeIconImageExpression`, `createPlaceIconController`
- **북마크/폴더**: `BOOKMARK_ICON_LAYER_ID`, `FolderRouteLayer`, `FavoriteLayers`

---

## 11. 계곡 이식 체크리스트

### 먼저 베낄 것 3개 — 나중에 넣으면 구조를 다 뜯어야 함

1. **`setMissingStyleImageResolver` 기반 지연 아이콘 생성**
   → `src/lazy-marker-icons.ts`
2. **`easeTo({ offset })`로 바텀시트를 보정하는 카메라 훅**
   → `src/use-map-camera.ts`
3. **베이스맵 헬스 감시**
   → `src/base-map-health.ts`

### 데이터 준비 단계에서 미리 구울 것

- `mapIconTier` / `mapLabelTier` / `mapImportance` — 클러스터링 대신 티어로 밀도 제어
- 계곡 티어 예시: 유명 계곡 = 0, 지선 = 1, 소규모 소(沼)·명소 = 2
- 시설 좌표는 `[longitude, latitude]` WGS84 고정, 데이터셋 metadata에 `source` / `datasetVersion` / `collectedAt` 기록

### 계곡에만 추가로 필요한 축

**시간**. 계곡은 계절·시간대(오전 한산 → 오후 만차)가 핵심 정보인데 spotts에는 없는 축입니다.
마커 상태색 3단계(`#2f9e64` / `#e79b38` / `#d64545`)를 시간축에 연동하고,
카드 메타에 "지금 기준" 한 줄을 넣는 컴포넌트가 하나 더 필요합니다.

### 지도 스타일도 손봐야 함

원본은 도심 야경 기준이라 `park`가 z9→z12에서 불투명도 0.5→0.2로 **줄어듭니다**.
산·계곡이 주 무대면 반대로 녹지 불투명도를 높이고 `waterway-stream` 라인 폭을 키워
물줄기가 먼저 읽히게 해야 합니다.

---

## 미확인

- 타일 서버 구현체 (martin / tileserver-gl / pmtiles). CORS 노출 헤더가 safelist뿐이라
  `server` · `cf-cache-status`를 읽지 못했습니다
- `/api/map/map-tiles/{z}/{x}/{y}`의 실체 — 재타일링인지 단순 프록시인지
- `t.bdyne.us` 호스트의 정체와 spotts와의 관계
- `focusDurationMs`의 실제 곡선 (거리 비례인 건 확실, 계수 미확인)
- `setStyle` 호출 시 `diff` 옵션의 실제 값 — `styleDiffing` prop이 코드에 있고
  레이어 컴포넌트가 전부 `style.load`에 재적용 리스너를 다는 것까지는 확인 [추정]
