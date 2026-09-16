# 아키텍처

## 왜 이렇게 나눴나

원본 데모는 936줄짜리 HTML 파일 하나입니다. 그 안에서
지도 SDK 호출·WebGL 셰이더·물리 시뮬레이션·DOM 조작·CSS 애니메이션·상태가
한 스코프에 섞여 있습니다. 파일 하나로 도는 예제로는 훌륭하지만, 세 플랫폼에
올리고 화면을 늘려야 하는 앱에서는 세 가지가 곧 문제가 됩니다.

1. **상태의 진실이 여러 곳에 있다** — DOM 클래스(`.down`, `.act`, `.on`)와
   모듈 지역 변수(`selected`, `layout`, `tour`, `busy`, `ti`)와 전역
   (`window.__fwOn`)이 각자 상태를 들고 있어 어긋나면 조용히 깨집니다.
2. **자원 회수 경로가 없다** — `setInterval`, 이벤트 리스너, GL 버퍼, 마커,
   Web Animation 을 만들어 놓고 되돌리지 않습니다. 화면이 하나인 페이지에서는
   티가 안 나지만 라우팅·핫리로드·재진입이 있으면 그대로 누수입니다.
3. **web 전용 API 가 로직에 얽혀 있다** — `document`, `maplibregl`,
   `localStorage`, Web Animations 가 도메인 규칙과 같은 줄에 있습니다.

그래서 **의존 방향이 한쪽으로만 흐르는 네 겹**으로 갈랐습니다.

```
apps/valley-map (표현)  ─┬─→ packages/core (도메인 + 애플리케이션)
packages/adapter-web    ─┤         ↑ 아무것도 import 하지 않는다
packages/adapter-native ─┘
                         └─→ packages/map-style (MapLibre 스타일 명세)
```

`packages/map-style` 는 계층이 아니라 **두 어댑터가 공유하는 데이터**입니다.
MapLibre 스타일 JSON(지도 팔레트와 재색칠 규칙, 밤하늘, 3D 건물, 한국어 라벨,
피처 레이어 셋 6종 — 그늘·물줄기 면·구간·흐름 점선·시설·명당 — 과 그 GeoJSON 변환)은 maplibre-gl 과
maplibre-native 가 같은 값을 읽습니다. 베이스맵은 openfreemap(D4) — 라이트는
`positron`, 다크는 `dark` — 이고 `composeMapStyle(style, mode)` 가 **팔레트 →
라벨 → 장식** 순서로 완성한 스타일 객체를 두 어댑터가 같은 시점(지도 생성 전)에
넘깁니다. 라이트는 valley-ds `map-palette.json` 값으로 재색칠(`applyMapPalette`,
레이어 type·source-layer·id 패턴 매칭)하고 계곡용 조정(녹지 불투명도↑·물줄기
선폭↑)을 얹으며, 다크는 openfreemap 원본 paint 를 그대로 두고 데모 장식(밤하늘·3D
건물)만 얹습니다. `MAP_LAYER_SETS` 가 그 목록이고, 두 어댑터와 네이티브 뷰가
같은 배열을 순회합니다. 셋 하나는 `kind`·소스·레이어·히트 레이어·의존 참조·GeoJSON
변환을 든 값이고, F4 부터 두 칸이 더 있습니다 — `interactiveLayerIds` 가 빈
**비인터랙티브 셋**(그늘 fill, `kind: 'shade'`; `isInteractiveLayerSet` 으로 갈라 press 배선을
건너뜁니다)과 **`placement`**(`placement.ts` — `'below-labels'` 는 첫 `symbol` 아래로 반투명
fill 이 라벨을 덮지 않게, `'below-waterway'` 는 물줄기 선 아래·숲 위; web 은
`findPlacementLayerId` 로 `addLayer(layer, beforeId)`, 네이티브는 엔진이 스타일을 게시할 때
같은 함수로 한 번 계산한 `MapScene.placementLayerIds` 를 `Layer.beforeId` 로). C10 부터
**지형**도 이 패키지의 값입니다 — `terrainLayers.ts` 의 Terrarium `raster-dem` 소스와
`color-relief`(고도색, 라이트만)·`hillshade`(음영기복, 모드별 값) 레이어를
`composeMapStyle(style, mode, { terrain: true })` 가 물줄기 아래에 끼웁니다. 계곡 장면만
켜고 festival 은 소스도 늘지 않으므로 `/firework` 는 그대로입니다. 색은 표현식 없이
리터럴입니다(maplibre-native iOS 의 hillshade 버그 #4296·#4453 회피). 같은 옵션이 봉우리
라벨(`peakLayers.ts`, openmaptiles `mountain_peak`)도 맨 위에 얹고, `terrain3d`(web) 이면
`symbol-height-offset` 으로 지면에서 띄웁니다. 물줄기는 두 레이어 셋입니다(C10c) — 구간
선을 코어의 순수 계산(`waterPolygonOf`)으로 부풀린 임시 폴리곤 fill(`waterLayers.ts`, R5
실폭 수계가 오면 데이터만 바뀝니다)과 구간 선 위의 흐름 점선(`flowLayers.ts`, MapLibre
"animate a line" 의 `line-dasharray` 14 단계 시퀀스). 점선을 프레임마다 갈아 끼우는 것은
어댑터(web rAF `WaterFlowController` / 네이티브 타이머 → `MapScene.layerPaintOverrides`)고,
언제 돌릴지는 코어 `WaterFlowCoordinator` 가 정합니다 — 계곡 장면·ready·시트 펴짐·앱
전면(`AppState.appActive`)일 때만. 같은 통로로 **상태 의존 paint**(V1, `valleyPaint.ts`)도
흐릅니다 — 레이어 셋은 모드·앱 상태를 모르므로 구간 케이싱 색(라이트 흰색·다크 `#0c0c0c`)과
그늘 대비(그늘 켜짐이면 음영 0.2·수관 0.4, 끄면 복귀)를 `valleyPaintOverrides(mode, { shadeVisible })`
가 값으로 돌려주고, web 은 `setPaintProperty`, 네이티브는 `layerPaintOverrides` 로 얹습니다.
그늘 상태는 포트를 넓히지 않고 `MapContent.shade` 의 유무로 읽습니다. 어느 한쪽
어댑터에 두고 다른 쪽에 복사하면 "파리티가 갈라졌는지"를 두 파일을 비교해야
알 수 있으므로 한 곳에 모았습니다. 이 패키지는 지도 SDK 를 import 하지 않고
명세 타입만 씁니다.

`packages/core` 는 `react`, `react-native`, `maplibre-gl`, DOM 을 **하나도
import 하지 않습니다.** 코어 tsconfig 는 `lib: ["ES2023"]` 만 켜고 DOM 을
빼두었으며, 실제로 쓰는 호스트 전역(`console`, 타이머, `performance`)만
`types/host.d.ts` 에 최소한으로 선언합니다. DOM 을 켜두면 `document` 가 타입에
잡혀 플랫폼 무관 계층에 브라우저 API 가 슬그머니 섞여도 컴파일이 통과하기
때문입니다. 이 선언 파일은 DOM 을 켜지 않는 세 패키지(core, map-style,
adapter-native)가 **같은 파일을** include 하므로 선언이 갈라질 수 없습니다.

## 계층

### `packages/core/src/shared` — 공용 기반

| 모듈 | 역할 | 데모의 무엇을 대체하나 |
| --- | --- | --- |
| `result.ts` | 예상된 실패를 값으로 | 던지거나 삼키던 실패 |
| `errors.ts` | `AppError` 계층 + 오류 코드 | `console.error` 후 계속 진행 |
| `logger/` | 로깅 포트 + 콘솔 구현 | 흩어진 `console.*` |
| `disposable.ts` | 정리 프로토콜 | 회수되지 않던 자원 |
| `async/cancellation.ts` | 취소 토큰 | `map.stop()` + `busy` 플래그 |
| `async/SerialTaskQueue.ts` | 겹침 정책 (preempt/queue/drop) | 같음 |
| `async/lifecycle.ts` | 생성→initialize→ready→dispose | 콜백 안에서 하던 초기화 |
| `events/Emitter.ts` | 타입 안전 이벤트 | `map.on(...)` 직접 배선 |
| `events/ObservableStore.ts` | 불변 스냅샷 + 구독 | DOM 클래스 + 지역 변수 |

`noConsole` 린트 규칙이 로깅 경계를 강제합니다 — `ConsoleLogger` 만 예외입니다.

### `packages/core/src/domain` — 순수 규칙

* `geo/` — `LngLat`·`Distance` 값 객체, 등장방형 거리(데모와 같은 공식),
  웹 메르카토르 투영(maplibre 와 같은 상수)
* `festival/` — `Spot`·`Festival` 엔티티, `SpotId` 브랜드 타입, 혼잡도
* `camera/` — `CameraPose`/`CameraTarget`/`CameraTransition` 와 **프리셋**.
  데모에 흩어져 있던 카메라 수치(`zoom:15.4`, `pitch:62`, `bearing:(tour*47)%360` …)가
  전부 `CameraPresets.ts` 한 곳에 모여 있습니다. 계곡 구간 상세(`focusSegment`)는 엔진의
  `MapCapabilities.terrain` 을 받아 3D 지형이 있으면 계곡 축을 가로질러(`valleyAxisBearing`,
  `geo/Bearing.ts`) pitch 58 로 눕히고, 없으면 평면에 가까운 시점을 유지합니다(C10b).
* `fireworks/` — **불꽃 물리 시뮬레이션**. 플랫폼 무관 순수 계산이며 결과는
  `Float32Array` 두 장입니다. GPU 에 올리는 방법은 모릅니다. 그래서 web 의
  WebGL 커스텀 레이어와 (향후) 네이티브 오버레이가 같은 시뮬레이션을 씁니다.
* `news/` — 티커 문구와 타이밍

### `packages/core/src/application` — 조립

* `ports/` — `MapEnginePort`, `StoragePort`, `FestivalRepositoryPort`,
  `ValleyRepositoryPort`, `MapCapabilities`, `MapContent`. 지도 엔진 계약은 피처 종류를 모릅니다 —
  `renderContent(MapContent)` 로 내용 스냅샷(명당·발사 지점·구간·시설·혼잡)을
  통째로 넘기고, `setSelection(MapSelection | null)` 로 선택을, `'feature-press'`
  (`MapFeatureRef`) 로 히트를 주고받습니다. festival 은 계곡 필드를 비워 둔 채
  같은 계약을 씁니다.
* `usecases/` — 사용자 의도 하나당 클래스 하나
* `state/` — `AppState` 스냅샷과 `SessionStore`(상태를 바꾸는 유일한 문)
* `MapContentComposer` — 계곡 장면의 지도 내용 조립. 바탕(구간·시설)은 적재 때 한 번
  굳히고 그늘 오버레이만 시각별 캐시로 갈아 끼웁니다(F4). 어댑터가 `MapContent` 필드를
  소스별 **참조 비교**로 다시 쓰기 때문에, 시각을 바꿀 때 구간 배열을 다시 만들면
  구간 소스가 쓸데없이 다시 쓰입니다 — 그 약속을 지키는 자리가 여기 하나입니다.
  `ToggleShade`·`SetShadeHour`·`LoadSession` 이 같은 인스턴스를 봅니다.
* `MapSession` — **화면 하나에 대응하는 파사드**. 표현 계층이 아는 것은 이
  클래스와 스냅샷뿐입니다. `dispose()` 한 번으로 엔진·타이머·큐·구독이 모두
  정리됩니다. 장면(`scene: 'festival' | 'valley'`)은 이 파사드의 **매개변수**입니다
  — 별도 세션 클래스가 아니라 `{ scene, repository | valleyRepository }` 유니온으로
  받고, 카메라 큐·플립·제스처·엔진 배선은 공유하며 적재(`LoadSessionUseCase`)·
  선택 유즈케이스(`SelectSpot` / `SelectSegment` / `SelectFacility`)·티커만 장면으로
  갈립니다. `AppState` 도 하나입니다 — festival 필드(`festival`·`selectedSpotId`)와
  valley 필드(`valleys`·`selectedSegmentId`·`selectedFacilityId`)가 함께 있고 다른
  장면의 필드는 `null` 로 남습니다.
* `SheetFlipCoordinator` — 시트 플립의 시간 축(230ms 접힘 → 교체 → 260ms 펴짐)
* `WaterFlowCoordinator` — 물줄기 흐름 애니메이션의 on/off 규칙(C10c). 스냅샷을 보고
  `engine.setWaterFlowEnabled` 를 값이 바뀔 때만 부릅니다. festival 은 항상 꺼짐.
* 베이스맵 헬스(C7) — 판정은 `domain/basemap/BaseMapHealth.ts` 의 순수 상태기계(첫 실패 arm →
  8초 동안 성공 없음 → `outage`, 타일 하나라도 오면 처음으로)이고, 시간 축은
  `BaseMapHealthMonitor`(주입 시계·타이머)입니다. 어댑터가 SDK 이벤트를 `failure()`/`success()` 로
  넣어 돌리고 `'basemap-health'` 이벤트로 올리면 세션이 `AppState.baseMapHealth` 로 실어 줍니다.
  "우리 베이스맵인가" 는 `isBaseMapUrl(url, hosts)` 와 `map-style` 의 `BASE_MAP_HOSTS`(openfreemap,
  DEM s3 경로)가 정합니다 — GeoJSON 소스·아이콘은 세지 않습니다. 재시도는 포트 `retryBaseMap()`
  (소스 reload). 스타일 자체 실패는 세션 `failed` → 표현 계층이 세션을 다시 만듭니다.

### 어댑터

`adapter-web` 은 maplibre-gl·DOM·localStorage 를 가둡니다. 지도 엔진은
`MapLibreEngine` 하나로 좁혀 두고, 그 안에서 다시 역할을 나눴습니다.

* `CameraController` — `flyTo`/`easeTo` 를 **취소 가능한 Promise** 로 감쌉니다
  (`moveend` 대기 + 취소 시 `map.stop()` + 이벤트 미발생 대비 타임아웃)
* `FeatureLayerController` — 레이어 셋 하나(GeoJSON 소스 + 레이어들 + 히트).
  `MAP_LAYER_SETS` 마다 하나씩 만들어지고, 소스가 의존하는 값의 참조가 바뀔
  때만 `setData` 한다
* `SelectionPinController` — 물방울 마커 한 개 규칙. 명당만 핀. 시설은 마커 자체가
  핀이라(C5) 레이어의 `selected` 가 핀 확대 + 흰 링으로 보이고, 구간은 `selected` 로 강조
* 베이스맵 헬스 배선(C7) — `map.on('error')` 의 소스 명세·요청 URL 이 `BASE_MAP_HOSTS` 면 실패
  (404 는 제외), `sourcedata` 에 `tile` 이 실린 것만 성공. `retryBaseMap` 은 베이스맵 소스의
  `setTiles`/`setUrl` 을 같은 값으로 다시 넣어 타일을 전부 다시 요청한다
* `MarkerIconRegistry` — 지연 마커 아이콘(C5). 스타일이 모르는 아이콘 ID 가 요청되면
  (`setMissingStyleImageResolver`) `map-style` 의 순수 SVG 팩토리(`facilityIcons.ts`,
  `facility/<type>[/selected]`)로 문자열을 만들어 `<img>` data URL 로 디코드한 뒤
  `addImage(pixelRatio 2)`. 같은 ID 동시 요청은 한 번만, 실패는 `Logger`, 어느 팩토리도
  모르는 ID 는 투명 1px 폴백(스프라이트 경고 억제 — `/firework` 는 이 폴백만 탄다).
  네이티브는 같은 팩토리로 빌드 때 구운 PNG(`scripts/icons`, `pnpm icons:build`) 36장을
  `<Images>` 로 같은 ID 에 등록한다 — 한 소스, 두 출력
* `fireworks/FireworkLayer` — 커스텀 레이어의 GL 자원 생애
* `fireworks/gl/` — 셰이더, 프로그램 래퍼, VAO 링 버퍼

`adapter-native` 는 maplibre-native(`@maplibre/maplibre-react-native`)와
AsyncStorage 를 가둡니다. 여기서 web 과 **구조가 한 번 갈립니다.**

maplibre-gl 은 명령형입니다 — `addLayer`, `setData`, `marker.remove()`. 그래서
어댑터가 지도 객체를 소유할 수 있습니다. maplibre-react-native 는 선언형이라
지도·소스·레이어·마커가 **React 엘리먼트**입니다. 그것들을 만드는 주체는 React
트리여야 하므로 어댑터가 지도를 소유할 수 없습니다.

그래서 포트의 명령형 계약을 **스냅샷 + 이벤트**로 번역하는 다리를 둡니다.

```
MapEnginePort 호출   ──▶ MapSurface.publish()   ──▶ MapScene 스냅샷 ──▶ <Map>/<Layer>/<Marker>
MapEnginePort 이벤트 ◀── MapSurface.report*()   ◀── onPress / onRegion* / onDidFinishLoadingStyle
moveCamera()         ──▶ MapSurface.moveCamera() ──▶ CameraRef.setStop()
```

* `MapSurface` — 유일한 통로. scene 스토어(`ObservableStore`) + 카메라 손잡이
  + 뷰가 되돌려 주는 이벤트. 소유자는 표현 계층(지도 뷰와 생애가 같다).
* `NativeMapEngine` — `MapEnginePort` 구현. `renderContent`/`setSelection` 은
  scene 게시(`sources[sourceId]`·`selectedPin`)로, `camera-change`/`feature-press`
  는 surface 이벤트에서 온다. 뷰는 소스 id 만 올리고 종류로 바꾸는 일은
  엔진이 한다.
* 베이스맵 헬스 배선(C7) — ready 뒤의 `onDidFailLoadingMap` 이 실패, `onDidFinishRenderingMapFully`
  가 성공. mbgl 은 오류난 타일도 완료로 치므로 실패 뒤 500ms 안의 성공 신호는 세지 않는다
  (`NATIVE_SUCCESS_QUIET_MS`). `retryBaseMap` 은 같은 스타일을 새 참조로 게시해 뷰가 다시 적용하게 한다
* `NativeCameraController` — 취소 가능한 카메라 이동. web 이 `moveend` 를
  기다리는 자리에서 `onRegionDidChange` 를 기다리고, `map.stop()` 자리에는
  duration 0 이동을 밀어 넣는다.
* `nativeStyle.ts` — 스타일 JSON 을 받아 `map-style` 의 `composeMapStyle` 로
  완성한다(팔레트 → 라벨 → 장식). web 의 `MapLibreEngine.#loadStyle` 과 같은
  순서·같은 함수다 — C2 부터 web 도 URL 대신 완성된 객체로 지도를 만든다.
* `AsyncKeyValueStorage` — `StoragePort` 구현. AsyncStorage 를 직접 import
  하지 않고 세 메서드짜리 계약으로 **주입받는다**.

이 패키지는 react·react-native·지도 SDK 를 **하나도 import 하지 않습니다.**
tsconfig 가 DOM 도 RN 도 켜지 않은 채 컴파일된다는 사실이 "애플리케이션
계층이 플랫폼 타입에 새지 않았다"는 증거입니다. 지도 SDK 타입은
`apps/valley-map/src/platform/native/` 안에만 있습니다.

### `apps/valley-map` — 표현

* `src/platform/mapPlatform.{web,native}.tsx` — 플랫폼 배선.
  Metro 가 확장자로 고르고, TypeScript 는 `mapPlatform.d.ts` 계약을 봅니다.
  web 은 DOM 노드 하나를 건네주면 끝이고, 네이티브는 `MapSurface` 를 건네고
  `platform/native/` 가 그 스냅샷을 그립니다(지도 SDK 타입은 그 폴더 안에만
  있습니다).
* `src/platform/useDismissRequest.ts` — "열린 것을 닫아라"의 플랫폼별 제스처.
  web 은 Esc, android 는 하드웨어 뒤로가기. 뒤로가기를 잡지 않으면 상세가
  열린 상태에서 앱이 종료됩니다.
* `src/theme/safeArea.tsx` — 안전 영역 provider 와 훅. 상단바·하단 내비·출처
  표기·시트 아래 여백이 노치와 홈 인디케이터를 피합니다(web 인셋은 0 이므로
  데모와 같은 위치입니다).
* `src/session/` — `SessionProvider`(DI 지점)와 `useAppState` 훅.
  `useSyncExternalStore` 를 쓰므로 상태 관리 라이브러리가 없고, 코어는 React 를
  모릅니다. 지도 엔진의 `styleMode` 는 `useTheme().mode` 에서 옵니다 — 테마와
  지도 팔레트가 함께 갈립니다(생성 시점 결정). **테마가 바뀌면 세션을 다시 만듭니다**
  (C9 결정 (d)) — 사용자 선택의 진실은 세션 상태 `AppState.themeMode`(`SetThemeModeUseCase`
  가 `STORAGE_KEYS.themeMode` 에 저장한 뒤 바꿉니다)이고, `SessionProvider` 가 그 값을
  `ThemeProvider` 의 `useThemePreference()` 로 올립니다. 팔레트가 갈리면 `styleMode` 가
  바뀌어 세션이 재생성되고, 새 세션은 현재 선택과 열려 있던 설정 면을 **씨앗**
  (`MapSessionDeps.seed`)으로 이어받아 화면이 튀지 않습니다. `ThemeProvider` 는 세션 바깥에
  있으므로 첫 페인트용 저장값은 `useStoredThemeMode` 가 같은 키를 `StoragePort` 로 한 번
  읽습니다. 결정 순서는 세션 선택 → 저장값 → `EXPO_PUBLIC_THEME`(개발용 강제) → 라이트(D1)
  이고, `system` 은 `useColorScheme()` 으로 풉니다(`theme/resolveThemeMode.ts`, 순수 TS).
  web 은 `+html.tsx` 의 인라인 스크립트가 같은 규칙으로 `data-theme` 을 첫 페인트 전에 맞춥니다.
* `src/app/` — 라우트 두 개. `index.tsx`(`/`, 계곡 화면)와 `firework.tsx`
  (`/firework`, 원본 데모 — 파리티 기준). 둘 다 `components/shell/MapScreen` 에
  장면(`SceneSource`)과 초기 중심만 넘깁니다.
* `src/components/` — RN 프리미티브 + `react-native-svg`. 세 플랫폼 공용.
  **도메인별로 나뉩니다**: `shell/`(두 장면이 공유하는 상단바·컨트롤·시트·내비·
  `MapScreen`), `festival/`(명당 목록·상세·프로그램 카드·티커), `valley/`(구간
  카드·구간 상세·시설 미니 행). 셸 컴포넌트는 세션의 `scene` 을 읽어 문구
  (`theme/copy.ts` 의 `FESTIVAL_COPY` / `VALLEY_COPY`)·버튼·시트 면을 고릅니다.
  시트의 세 번째 면 **설정**(`shell/SettingsFace.tsx`, C9)은 장면과 무관한 셸의 면입니다 —
  내비 설정 탭이 `MapSession.openSettings()` 로 열고(`OpenSettingsUseCase`, 상세에서는 선택을
  해제하며 곧장), ×·Esc·뒤로가기·다른 탭이 `closeSettings()` 로 목록에 되돌립니다. 목록 ↔
  설정은 기존 `SheetFlipCoordinator` 를 그대로 탑니다. 문구는 `SETTINGS_COPY`.
* `src/session/valleySource.ts` — 계곡 데이터 출처. 저장소 루트 `data/*.geojson` 을
  `scripts/sync-valley-data.mjs` 가 `assets/valley/*.json` 으로 복사하고(Metro 는
  `.geojson` 을 모릅니다), 같은 스크립트가 그늘 산출물 `data/shade/**`(P1)을
  `assets/valley/shade-bundle.json` **한 파일**로 합칩니다(Metro 는 정적 import 만 받아
  계곡 수만큼 파일을 손으로 import 할 수 없습니다; 산출물이 없으면 빈 합본). 이 파일이
  둘을 `loadValleyDataset` 으로 검증해 `InMemoryValleyRepository` 에 담습니다.
* `src/components/valley/ShadeHourTrack.tsx` — 그늘 시간 트랙(F4). 9개 정시 눌림
  눈금 + ‹ ›, 새 의존성 없음. `MapControls` 의 그늘 토글(나침반 아래, festival 의 불꽃
  버튼 자리)이 켜져 있을 때만 보이고, 좁은 화면에서는 티커 규칙처럼 컨트롤 행 위로
  올라갑니다.
* `src/animation/` — 플립·스태거·시트 이동을 RN `Animated` 로. `Easing.bezier`
  가 CSS `cubic-bezier()` 와 같은 곡선을 만들어 감각이 유지됩니다.
  목록 배치 전환(FLIP)만 플랫폼 분기입니다 — `useLayoutFlip.{web,native}.ts`.
* `src/app/+html.tsx` — **web 전용 CSS**. RN 스타일로 표현할 수 없는 것만
  담습니다(목록은 `docs/PARITY.md`).

## 네이티브를 채울 때 무엇이 바뀌었나

어댑터 한 겹과 그 겹을 그리는 플랫폼 배선 파일만 바뀌었습니다.
**도메인·유즈케이스·상태·컴포넌트 트리는 한 줄도 바뀌지 않았습니다.**
`packages/core/test/doubles/FakeMapEngine.ts` 가 그 계약을,
`packages/adapter-native/test/` 가 네이티브 구현을 각각 테스트로 고정합니다.

| 항목 | 상태 |
| --- | --- |
| 지도·명당 레이어·선택 핀 | ✅ `NativeMapEngine` + `platform/native/NativeMapView.tsx` |
| 3D 건물·한국어 라벨·밤하늘 | ✅ 스타일 JSON 을 미리 장식 (`nativeStyle.ts`) |
| 음영기복·고도색(계곡) | ✅ 같은 스타일 JSON — `composeMapStyle({ terrain })` (C10a) |
| 3D 지형(`setTerrain`) | ⛔ maplibre-native 에 없다(#252) — `terrain: false`, web 만(C10b: 배율 1.5 + 이동 뒤 중심 고도 보정). 구간 상세 카메라는 이 값을 읽어 지형이 있으면 pitch 58·계곡 축 가로지르기, 없으면 pitch 30 |
| 카메라 이동·취소·시트 회피 offset | ✅ `NativeCameraController` (offset → padding) |
| 영속 저장 | ✅ `AsyncKeyValueStorage` + AsyncStorage |
| 안전 영역(노치·홈 인디케이터) | ✅ `theme/safeArea.tsx` |
| 안드로이드 뒤로가기로 상세 닫기 | ✅ `platform/useDismissRequest.ts` |
| 핀치·더블탭·기울이기 제스처 | ✅ 코어의 `DEFAULT_MAP_GESTURES` 를 두 어댑터가 번역 |
| 확대·축소 버튼 | ✅ `MapControls` 의 `[− +]` 필 (`builtInZoomControls: false` 일 때만) |
| 불꽃 파티클 | ⛔ 구조적으로 불가 — `particleLayer: false` |
| globe 투영 | ⛔ 래퍼에 `setProjection` 이 없다 — 카메라 줌아웃으로만 재현 |
| 목록 배치 전환 FLIP | ⛔ 전환 없이 즉시 반영 (`useLayoutFlip.native.ts` 주석) |
| Pretendard 폰트 | ⛔ 시스템 폰트로 대체 |

남은 세 항목은 다음 라운드 후보입니다.

1. **목록 배치 전환** — Reanimated 의 layout animation(`LinearTransition`).
   FLIP 은 "바꾸기 전/후 화면 좌표"를 같은 프레임에 재는 기법인데 네이티브의
   `onLayout` 은 비동기라 그대로는 성립하지 않습니다. 새 의존성(reanimated +
   worklets + babel 설정)이 필요해 이번 라운드에서는 넣지 않았습니다.
2. **Pretendard** — `expo-font` 로 적재하려면 굵기별 파일을 따로 등록하고
   (`fontWeight` 가 커스텀 패밀리에서 안드로이드는 신뢰할 수 없습니다)
   토큰을 굵기 인식형으로 바꿔야 해서 컴포넌트 전반을 건드립니다.
3. **불꽃 파티클** — 열화를 감수한 2D 오버레이(react-native-skia / expo-gl)
   외에는 길이 없습니다. `NativeMapCapabilities.ts` 주석 참고.
