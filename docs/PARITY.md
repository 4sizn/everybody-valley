# 파리티 — 데모와 무엇이 같고 무엇이 다른가

기준 파일: `docs/references/firework-map-clone.html` (936줄)

파리티 대상 라우트는 **`/firework`** 입니다(F1 이후). 기본 라우트 `/` 는 계곡
화면이며 이 문서의 측정 대상이 아닙니다 — 같은 셸(`components/shell/*`)을 쓰므로
셸의 배치 수치는 공유되지만, 시트 내용·컨트롤 구성(불꽃·지구본 없음)·문구가
다릅니다.

## 검증 방법

`1440×900` 뷰포트에서 두 페이지를 같은 브라우저로 열고 대응 요소의
`getBoundingClientRect()` 와 계산 스타일을 비교했습니다.

측정된 값 (ref = 데모, port = 포팅본). F1b(2026-09-03, 라우트 `/firework` 로 이동·
셸을 `components/shell/*` 로 분리한 뒤) 같은 뷰포트에서 재측정해 아래 13행과 CTA
폭이 모두 같음을 확인했다 — 회귀 게이트. C9(2026-09-06, 시트에 설정 면 추가·테마
선택 영속)에서도 같은 뷰포트(1440×757)에서 main 과 branch 의 13행·CTA·컨트롤 좌표가
전부 같았고, 설정 면을 열고 닫은 뒤의 배치도 같았다. 저장된 테마 선택은 다크 강제
(`EXPO_PUBLIC_THEME=dark`)보다 우선하므로 파리티 측정은 저장값을 비운 상태에서 한다.
C7(2026-09-06, 베이스맵 헬스 배너·전면 재시도)에서도 같은 뷰포트에서 main 과 branch 의 18키
(13행 + CTA + 컨트롤 + 시트 높이)가 전부 같았고, 불꽃 off + 티커 숨김 + 9초 뒤 픽셀 diff 0
이었다 — 헬스 배너는 장애(`baseMapHealth.outage`)일 때만 DOM 에 생기므로 정상 화면은 바뀌지 않는다.

| 요소 | x | y | w | h |
| --- | --- | --- | --- | --- |
| 상단바 | 16 / 16 | 16 / 16 | 1408 / 1408 | 48 / 48 |
| 브랜드명 | 31 / 31 | 30 / 30 | 48 / 48 | 20 / 20 |
| CLONE 칩 | 171 / 171 | 31 / 31 | 49 / 49 | 18 / 18 |
| 제보 버튼 | 864 / 864 | 352 / 352 | 120 / 120 | 48 / 48 |
| 티커 | 456 / 456 | 360 / 360 | 300 / 300 | 36 / 36 |
| 시트 | 440 / 440 | 416 / 416 | 560 / 560 | 341 / 341 |
| 제목(h1) | 456 / 456 | 443.4 / 443.4 | 204 / 204 | 26 / 26 |
| CTA 행 | 456 / 456 | 492.4 / 492.4 | 528 / 528 | 40 / 40 |
| 프로그램 카드 1 | 456 / 456 | 582.4 / 582.4 | 528 / 528 | 104 / 104 |
| 세그먼트 바 | 916 / 916 | 822.4 / 822.4 | 68 / 68 | 32 / 32 |
| 명당 행 1 | 456 / 456 | 888.4 / 888.4 | 528 / 528 | 60 / 60 |
| 내비 | 587 / 587 | 691 / 691 | 266 / 266 | 50 / 50 |
| 크레딧 | 16 / 16 | 736 / 736 | 172 / 172 | 13 / 13 |

시트 CTA 버튼 (두 버튼이 모두 `flex:1` 인 상세 패널이 특히 민감합니다 —
데모의 primary 는 자체 padding 이 없어 브라우저 `<button>` 기본 6px 이 남고,
그 12px 이 폭 배분을 바꿉니다):

| 면 | ghost | primary |
| --- | --- | --- |
| 목록 (ref / port) | x894.5 w89.5 / 동일 | x456 w430.5 / 동일 |
| 상세 (ref / port) | x456 w273 / 동일 | x737 w247 / 동일 |

배치 전환 후:

| 배치 | 항목 폭 | 항목 높이 | 열 간격 |
| --- | --- | --- | --- |
| 행 (ref / port) | 528 / 528 | 60 / 60 | dy 68 / 68 |
| 타일 (ref / port) | 260 / 260 | 107 / 107 | dx 268 / 268 |

전환 소요 시간 (명당 클릭 → 상세, Esc → 목록):

| | 상세 열림 | 목록 복귀 |
| --- | --- | --- |
| 데모 | 263ms | 263ms |
| 포팅본 | 265ms | 276ms |

거리 라벨은 단위 테스트로 고정했습니다 (`packages/core/test/distance.test.ts`).
데모가 화면에 그리는 문자열 그대로입니다 — 132m / 872m / 1.1km / 2.4km /
1.4km / 3.3km.

## 데모 코드가 어디로 갔나

| 데모 | 포팅본 |
| --- | --- |
| `:root` 커스텀 프로퍼티 | `apps/valley-map/src/theme/tokens.ts` |
| `LAUNCH`, `SPOTS` | `packages/core/src/data/seoulFireworks2026.ts` |
| `distLabel()` | `packages/core/src/domain/geo/Distance.ts` |
| `new maplibregl.Map({...})` + `style.load` | `packages/adapter-web/src/map/MapLibreEngine.ts` (web) · `packages/adapter-native/src/map/NativeMapEngine.ts` (네이티브) |
| `map.setSky`, `3d-buildings`, 라벨 한국어화 | `packages/map-style/src/baseStyle.ts` (다크 전용 장식; 라이트 지도 재색칠은 `applyMapPalette.ts`) |
| `spot-glow` / `spot-dot` / `spot-label` | `packages/map-style/src/spotLayers.ts` (`SPOT_LAYER_SET`) + `adapter-web/.../FeatureLayerController.ts` · `apps/valley-map/src/platform/native/NativeMapView.tsx` |
| `setPin()` | `packages/adapter-web/src/map/SelectionPinController.ts` · `apps/valley-map/src/platform/native/SelectionPin.tsx` |
| `fireworkLayer()` 의 물리 | `packages/core/src/domain/fireworks/ParticleSimulation.ts` |
| `fireworkLayer()` 의 GL | `packages/adapter-web/src/fireworks/` |
| `setInterval(spawn, 620)` + 예비 발사 | `packages/core/src/domain/fireworks/BurstScheduler.ts` |
| 카메라 수치 (`flyTo`/`easeTo` 옵션들) | `packages/core/src/domain/camera/CameraPresets.ts` |
| `openSpot()` / `closeSpot()` | `SelectSpotUseCase` / `ClearSelectionUseCase` |
| `flipTo()` 2단계 전환 | `packages/core/src/application/SheetFlipCoordinator.ts` |
| `setLayout()` FLIP 애니메이션 | `apps/valley-map/src/animation/useLayoutFlip.web.ts` |
| `stagger()` | `apps/valley-map/src/animation/useStaggerEntrance.ts` |
| 티커 순환 | `packages/core/src/application/NewsTickerController.ts` |
| `localStorage` 배치 저장 | `StoragePort` + `adapter-web/.../WebStorage.ts` · `adapter-native/.../AsyncKeyValueStorage.ts` |
| 인라인 SVG 아이콘 | `apps/valley-map/src/icons/` (react-native-svg) |

## react-native 로 표현할 수 없어 CSS 로 남긴 것

`apps/valley-map/src/app/+html.tsx` 의 전역 스타일시트에만 있습니다.
컴포넌트는 `dataSet={{ mv: '...' }}` 로 슬롯 이름을 붙이고, CSS 가
`[data-mv="..."]` 로 얹습니다.

| CSS | 대상 |
| --- | --- |
| `backdrop-filter: blur(14px)` | 상단바 유리 효과 |
| 다층 `box-shadow` | 상단바·컨트롤·시트·내비·카드 (RN 의 shadow* 는 한 겹) |
| `inset box-shadow` | 내비 활성 탭 링 |
| `position: sticky` | 시트 손잡이 |
| `::-webkit-scrollbar` | 시트 스크롤바 숨김 |
| `@keyframes` | 티커 맥박, 선택 핀 낙하 |
| `:hover` | 원형 컨트롤·목록 행·CTA·내비 |
| `transition` | hover 전환, 티커 페이드 |
| `perspective` / `preserve-3d` / `backface-visibility` | 목록 배치 전환의 3D 접힘 |
| `filter: drop-shadow` | 선택 핀 그림자 |
| `font-variant-numeric: tabular-nums` | 거리 숫자 정렬 |
| `text-shadow` | 티커 문구 |

나머지(레이아웃·색·타이포·반경·플립·스태거·시트 이동)는 모두 RN 스타일과
`Animated` 에 있어 네이티브로 그대로 따라갑니다. 위 표에서 네이티브가
`Animated` 근사로 옮겨 간 것은 두 개입니다 — 선택 핀의 낙하(`@keyframes` →
같은 베지어의 `Animated.timing`)와 핀 그림자(`drop-shadow` → `shadow*`).
`:hover` 는 터치 기기에 대응되는 개념이 없으므로 네이티브에서는 없습니다.

## 네이티브(android/ios)에서 다른 것

web 은 데모 파리티 기준을 그대로 유지합니다. 아래는 **네이티브에서만** 다른
지점이고, 원인이 플랫폼 SDK 인지 이번 라운드의 범위인지 구분해 적었습니다.

### SDK 가 제공하지 않아 다른 것

| 항목 | 데모/web | 네이티브 | 원인 |
| --- | --- | --- | --- |
| 불꽃 파티클 | 커스텀 WebGL 레이어 | 없음 (버튼 흐림 + 안내) | 래퍼가 렌더 콜백·카메라 MVP 행렬을 노출하지 않는다 |
| globe 투영 | 줌아웃하면 구체로 모핑 | 멀어지기만 한다 | 래퍼에 `setProjection` 이 없다 |
| 최대 pitch | **60** (데모는 85) | 60 | maplibre-native 가 60 도 하드 상한이다(iOS `MLNMapView.maximumPitch`: "may not exceed 60 degrees regardless of this property"; Android `MAXIMUM_TILT` 도 60). 올릴 수 없으므로 동일 동작을 위해 web 을 내렸다 — `MAX_PITCH` 한 줄이고, 85 로 되돌리면 web 만 데모와 같아지고 네이티브와는 달라진다 |
| 비행 곡률 | `curve: 1.5` (순회 비행) | SDK 기본 곡선 | `CameraStop` 에 `curve` 가 없다 |
| `essential`(모션 축소 무시) | 있음 | 없음 | 같음 |
| 카메라 화면 offset | `offset: [0,-90]` | `padding.bottom: 180` | offset 이 없어 padding 으로 옮긴다. 유효 중심이 padding 의 절반만큼 밀리므로 두 배를 준다 (`NativeCameraController.toNativeStop`) |
| 카메라 이동 완료 신호 | `moveend` | `onRegionDidChange` | `CameraRef.setStop` 의 Promise 는 애니메이션 완료가 아니라 **명령 전달** 시점에 resolve 된다 |
| 애니메이션 정지 | `map.stop()` | duration 0 이동 | 정지 API 가 없다 |

### 이번 라운드에서 넣지 않은 것

| 항목 | 데모/web | 네이티브 | 왜 |
| --- | --- | --- | --- |
| 목록 배치 전환 (행 ↔ 타일) | FLIP + 3D 접힘 560ms | 즉시 반영 | FLIP 은 같은 프레임에 전/후 좌표를 재야 하는데 네이티브 `onLayout` 은 비동기다. Reanimated layout animation 이 필요하고 새 의존성(reanimated + worklets + babel)이 붙는다 |
| 본문 폰트 | Pretendard (CDN) | 시스템 폰트 | RN 은 커스텀 패밀리에서 `fontWeight` 를 신뢰할 수 없어(안드로이드) 굵기별 패밀리를 등록하고 토큰을 굵기 인식형으로 바꿔야 한다 |
| 확대·축소 버튼의 출처 | maplibre-gl `NavigationControl` | 앱이 그린 `[− +]` 필 | 래퍼에 대응 컨트롤이 없다. 능력 매트릭스의 `builtInZoomControls` 를 읽어 엔진이 그려 주지 않는 쪽에서만 앱 필이 나타난다 — 두 벌로 겹치지 않는다 |

### 제스처 — 정책은 한 곳, 번역은 두 곳

두 SDK 기본값에 맡기면 어느 제스처가 켜져 있는지가 플랫폼마다 갈립니다.
실제로 그렇게 두었다가 web 과 네이티브의 핀치 동작이 어긋났습니다. 정책은
`packages/core/src/domain/camera/MapGestures.ts` 의 `DEFAULT_MAP_GESTURES`
한 곳에 값으로 있고, `MapSession.initialize` 가 `MapEnginePort.setGestures`
로 한 번 내려보냅니다. 어댑터는 자기 SDK 로 **번역만** 합니다.

| 정책 | web (maplibre-gl) | native (maplibre-react-native) |
| --- | --- | --- |
| `pan` | `map.dragPan` | `dragPan` |
| `pinchZoom` | `map.touchZoomRotate` | `touchZoom` |
| `pinchRotate` = **true** | `touchZoomRotate.enableRotation()` + `map.dragRotate.enable()` | `touchRotate={true}` |
| `doubleTapZoom` | `map.doubleClickZoom` | `doubleTapZoom` |
| `quickZoom` | (핀치와 같은 핸들러 — 분리 불가) | `doubleTapHoldZoom` |
| `dragPitch` | `map.touchPitch` | `touchPitch` |

핀치 회전은 **세 플랫폼 모두 켜져 있습니다**(2026-09-08 사용자 요청). 오래 꺼 두었던
이유는 데모가 방위를 **의도적으로** 정하기 때문입니다(`tourStep` 의 47도 증가,
`inspectNearby` 의 70도 회전, 나침반 버튼). 핀치 중 방위가 흔들리는 것은 두 엔진이 모두
가진 회전 임계값과, 언제든 정북으로 되돌리는 나침반 버튼이 막습니다.

회전 축(`around`)은 **두 손가락의 중간점**입니다. maplibre-gl 은 핀치 중간점을 `around` 로
넘기고 축을 특정 손가락으로 바꾸는 옵션이 없습니다(`enable({ around: 'center' })` 로 화면
중앙 고정만 가능). 회전 뒤 중심이 조금 옮겨져 있고, 나침반 버튼은 방위만 정북으로 돌립니다.

**web 에서는 이 값이 마우스 회전(`dragRotate`)까지 함께 켭니다** — 우클릭(맥 트랙패드 두
손가락 클릭) 또는 ctrl+좌클릭 드래그. 좌우가 방위, 상하가 기울기(`mousePitch` 가 같은
핸들러)입니다. 브라우저는 트랙패드의 회전 제스처를 페이지로 전달하지 않으므로 데스크톱에서는
이 경로가 유일한 회전 수단입니다.

### 회전량 — 실측 (2026-09-08)

같은 "두 손가락 60도 비틀기" 가 두 엔진에서 같은 방위 변화를 만들지 않습니다.

| 표면 | 시계 방향 60도 스윕 | 반시계 60도 스윕 | 재현성 |
| --- | --- | --- | --- |
| web (390×844, CDP 터치 두 점) | 방위 **−47.5°** | **+47.5°** | 반복해도 같은 값 |
| web (360×740) | −45° | +45° | 같음 |
| iOS 시뮬레이터 (iPhone 17 Pro) | 방위 **−58.6°** | **+83.5 ~ +98.7°** | 시계는 반경 40·60·100 에서 모두 58.5~58.7°, 반시계만 편차 |

web 이 스윕보다 12도 적게 도는 것은 `ROTATION_THRESHOLD = 25`/핀치 원주(지름 200px 에서
약 14도)가 먼저 소진되기 때문입니다. iOS 는 거의 1:1 로 따라옵니다.

**iOS 의 반시계 편차는 시뮬레이터 입력 특성으로 보입니다** — 시뮬레이터는 ⌥ 를 누르면
커서 위치와 **화면 중심 대칭점**을 두 터치로 합성합니다. 즉 두 번째 손가락을 우리가 정할 수
없고, 커서 원호의 중심이 화면 중심과 조금 어긋나면 손가락쌍의 각도 변화가 스윕과 달라집니다
(반경을 줄일수록 반시계 값이 커진 것이 이 설명과 맞습니다: 100 → 83.5°, 40 → 98.7°).
실기기 두 손가락에는 이 대칭 제약이 없으므로 **실기기 확인이 필요한 항목**으로 남깁니다.

**안드로이드는 코드로만 켜져 있습니다**(같은 `touchRotate` prop). 이 개발 환경에 Android
SDK·에뮬레이터가 없어 실행 검증을 하지 못했습니다.

### 시뮬레이터에서 회전을 재현하는 방법

1. `cd apps/valley-map && pnpm ios` (첫 실행은 `expo prebuild --platform ios` + CocoaPods).
   `xcodebuild` 가 "requires Xcode" 로 실패하면
   `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` 를 앞에 붙입니다.
2. 시뮬레이터에서 **⌥(Option) 을 누르면 터치 점이 두 개** 보입니다 — 하나는 커서, 하나는
   화면 중심 대칭점입니다.
3. ⌥ 를 누른 채 **직선으로 끌면 핀치 줌**, **원을 그리면 회전**입니다(⌥⇧ 는 두 점을 그대로
   평행 이동 = 핀치 중심 옮기기).
4. 자동화가 필요하면 `.proof/pinch-rotate-ios/` 를 만든 CGEvent 도구처럼 ⌥ 를 유지한 채
   원호로 드래그하면 됩니다 — `orca computer drag` 는 모디파이어를 잡아 주지 않습니다.
5. 시트가 펼쳐져 있으면 아래쪽 터치 점이 **시트(필터 칩)** 에 떨어져 회전 대신 탭이 됩니다.
   시트를 `peek` 으로 접고 하십시오(실측 중 실제로 필터가 켜졌습니다).

옮길 수 없는 차이는 넷입니다.

* **회전량** — 위 실측 표 참고(같은 60도 스윕에 web −47.5° / iOS −58.6°). 회전 임계값이
  엔진마다 다르고 네이티브 래퍼는 임계값·배율 API 를 노출하지 않습니다.
* **줌 배율·임계값** — 같은 물리적 핀치 거리가 두 엔진에서 같은 줌 변화량을
  만들지 않습니다. maplibre-gl 은 `touchZoomRotate.setZoomRate` 로 조절할 수
  있지만 네이티브 래퍼는 대응 API 를 노출하지 않습니다.
* **빠른 줌(더블탭 후 드래그)** — web 에서는 핀치와 같은 핸들러라 핀치를
  켜면 함께 켜지고 따로 끌 수 없습니다. 네이티브는 독립 boolean 입니다.
* **최대 pitch** — 위 표 참고(60 으로 통일).

SDK 나침반은 네이티브에서 끕니다. 데모는 자체 나침반(`.ctrl`)과 maplibre 의
`NavigationControl` 나침반을 **둘 다** 띄우는데, 좁은 화면에서는 겹쳐 보일
뿐입니다. 어트리뷰션 버튼은 web 과 같게 남기고 위치도 같은 자리
(하단 내비 위 74px)로 맞췄습니다.

### 네이티브에서 **더 하는** 것

데모에 없던, 휴대폰에서 반드시 필요한 처리입니다.

* **안전 영역** — 상단바는 상태바·노치 아래로, 하단 내비와 출처 표기는 홈
  인디케이터 위로, 시트 내부 아래 여백도 그만큼 늘어납니다
  (`apps/valley-map/src/theme/safeArea.tsx`). web 인셋은 0 이라 파리티에
  영향이 없습니다.
* **안드로이드 뒤로가기** — 상세가 열려 있으면 닫고, 없으면 OS 에 넘깁니다.
  잡지 않으면 상세를 닫으려다 앱이 종료됩니다
  (`apps/valley-map/src/platform/useDismissRequest.ts`).
* **스타일 장식 순서 역전** — 래퍼가 `setSky`/`setLayoutProperty`/`addLayer`
  를 노출하지 않아, 스타일 JSON 을 먼저 받아 장식한 뒤 지도를 띄웁니다.
  결과는 web 과 같고, 화면이 뜬 뒤 레이어가 얹히며 깜빡이지 않습니다.
* **확대·축소 필** — `[− +]` 를 제보 버튼과 **같은 행**에 둡니다. 오른쪽
  컨트롤 열은 이미 세로로 꽉 차 있어(휴대폰에서 나침반 위 여유가 약 70pt),
  세로로 한 칸 더 쌓으면 나침반이 상단바 뒤로 밀립니다. 가로로 두면 세로
  공간을 전혀 쓰지 않습니다.
* **좁은 화면의 티커 위치** — 데모는 컬럼 560px 를 전제로 티커와 오른쪽
  컨트롤을 같은 높이에 둡니다. 휴대폰은 컬럼이 그보다 좁아 문구가 제보·줌
  버튼에 가려지므로, 컬럼이 온전한 폭을 못 쓰는 화면에서만 티커를 그 행 위로
  올립니다(`components/shell/MapScreen.tsx`). 데스크톱 web 은 데모와 같은 20px 그대로입니다.

네이티브 어댑터의 계약은 `packages/adapter-native/test/` 가 고정합니다
(22 tests) — 스타일 장식, 초기화 순서와 취소, scene 게시, 카메라 정착·취소,
offset → padding 변환, 능력 부족의 정직한 실패.

## 의도적으로 다르게 한 것

### 1. 나침반 바늘의 초기 각도 — **데모의 버그를 고쳤습니다**

데모는 `map.on('rotate')` 안에서만 바늘 각도를 씁니다. 초기 bearing 이 -22도인데도
지도를 한 번 돌리기 전까지 바늘은 정북을 가리켜, 나침반이 지도와 어긋나 있습니다.
포팅본은 카메라 스냅샷을 그대로 반영해 처음부터 맞는 방향을 가리킵니다.
데모와 동일한 첫 화면이 필요하면 `MapControls.tsx` 의 주석 지점에서 되돌릴 수 있습니다.

### 2. 시트 손잡이 드래그 — **데모에서 이미 죽어 있는 코드입니다**

데모는 손잡이에 `onclick` 토글과 pointerdown/up 드래그 판정을 **동시에** 걸어
둡니다. `pointerup` 이 먼저 절대값을 정하고 이어서 `click` 이 다시 토글하므로
드래그는 서로 상쇄돼 아무 효과가 없고, 관측되는 동작은 "손잡이를 누르면 토글"
뿐입니다. 포팅본은 그 **관측되는 결과**만 구현했고, 상쇄되는 드래그 코드는
옮기지 않았습니다.

### 3. `styleimagemissing` → `setMissingStyleImageResolver`

데모는 `styleimagemissing` 이벤트에서 없는 아이콘을 투명 1px 로 채워 경고를
없앱니다. MapLibre 6 에서 이 이벤트는 **해결자를 거친 뒤에도 없을 때** 발화하는
사후 통보로 바뀌어, 같은 코드로는 경고가 남습니다. v6 의 지정된 통로인
`setMissingStyleImageResolver` 로 옮겨 같은 결과를 냅니다.

### 4. MapLibre 5 → 6 로 인한 호출부 변경 (결과는 동일)

* `antialias: true` → `canvasContextAttributes: { antialias: true }`
* `defaultProjectionData.mainMatrix` 가 `Float32Array | Float64Array` 가 되어
  `uniformMatrix4fv` 에 넘기기 전 32비트로 옮깁니다
* 워커가 별도 ESM 파일이 되어 `setWorkerUrl` + 정적 자산 배치가 필요합니다
  (README 참고)

### 5. 데모에 없던 상태

데모는 데이터가 스크립트에 박혀 있어 "로딩 중"이 존재하지 않습니다. 저장소
포트가 들어오면서 `status: 'idle' | 'initializing' | 'ready' | 'failed'` 가
생겼고, 준비 전에는 시트 내부를 비워 둡니다(깜빡임을 만들지 않을 만큼만).

## 데모의 함정을 그대로 물려받은 것

데모 주석이 경고한 문제들은 같은 방식으로 회피했습니다.

* **VAO 없이 `enableVertexAttribArray`** 를 부르면 MapLibre 의 GL 상태 캐시와
  어긋나 이후 드로우콜이 `INVALID_OPERATION` 을 뱉습니다 → `VertexRing` 이
  속성 설정을 VAO 안에 가둡니다.
* **같은 버퍼를 매 프레임 덮어쓰면** 드라이버가 셰도우 카피를 버립니다
  ("READ-usage buffer was written, then fenced") → 3칸 링 버퍼를 돌려 씁니다.
* **globe 전환 중 커스텀 레이어를 그리면** 좌표가 깨집니다 →
  `projectionTransition > 0` 이면 렌더를 건너뜁니다.
* **`flyTo`/`easeTo` 연타** 시 타일 캐시 갱신과 경합합니다 → 카메라 명령이
  모두 `preempt` 모드의 단일 큐를 지나갑니다.
* **살아 있는 파티클이 없을 때 `triggerRepaint()`** 를 부르지 않습니다.
