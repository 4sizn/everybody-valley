/**
 * 네이티브(android/ios) 지도 엔진의 능력 매트릭스.
 *
 * `@maplibre/maplibre-react-native` 는 maplibre-native SDK 를 감싼 것이고,
 * web 의 maplibre-gl 과 제공 범위가 다르다. 이 표는 **"네이티브에서 안 되는
 * 것"을 코드로 적어 둔 문서**다. 값을 바꾸는 것만으로 UI 가 따라오게 해
 * 두었으니(표현 계층이 이 값을 읽는다), 래퍼가 기능을 열어 주면 화면 코드를
 * 다시 뒤질 필요가 없다.
 *
 * ── 안 되는 것
 *
 *  · **커스텀 레이어 / 카메라 행렬** → `particleLayer: false`
 *    래퍼가 렌더 콜백과 MVP 행렬을 노출하지 않는다. 데모의 불꽃은 매 프레임
 *    `defaultProjectionData.mainMatrix` 로 메르카토르 정점을 직접 투영하므로,
 *    같은 방식으로는 옮길 수 없다. 대안은 카메라 상태를 읽어 2D 화면 좌표로
 *    투영하는 오버레이(react-native-skia / expo-gl)이며, 3D 깊이와 건물
 *    가림이 사라지므로 "동일"이 아니라 **열화**다. 그래서 이번 라운드에서는
 *    켜지 않고, 표현 계층이 버튼을 비활성으로 둔다.
 *
 *  · **globe 투영** → `globeProjection: false`
 *    래퍼에 `setProjection` 이 없다. 데모의 '지구본에서 보기'는 줌 1.5 로
 *    멀어지는 카메라 이동으로만 재현된다 — 구체로 모핑하지는 않는다.
 *
 *  · **3D 지형** → `terrain: false`
 *    maplibre-native 에 3D terrain 이 없다(트래킹 #252, draft PR #4190 — 2026 내 릴리스
 *    보장 없음). 음영기복(`hillshade`)·고도색(`color-relief`)은 스타일 JSON 으로
 *    web 과 같이 그려지므로(C10a) 그것이 모바일 3D 느낌의 상한이다.
 *
 *  · **내장 확대·축소 버튼** → `builtInZoomControls: false`
 *    maplibre-gl 의 `NavigationControl` 에 대응하는 컨트롤이 래퍼에 없다.
 *    핀치·더블탭 줌은 SDK 가 처리하지만 눌러서 줌할 곳이 사라지므로,
 *    표현 계층이 이 값을 보고 자기 줌 버튼을 얹는다.
 *
 * ── 되는 것 (web 과 같은 스타일 JSON 으로 성립한다)
 *
 *  · `extrudedBuildings` / `localizedLabels` / `sky` — 명령형 API 대신
 *    스타일 JSON 을 미리 장식해 넣는다(`map/nativeStyle.ts`).
 *  · `cameraOffset` — 래퍼에 offset 이 없어 padding 으로 옮긴다
 *    (`NativeCameraController.toNativeStop`).
 */
import type { MapCapabilities } from '@modu-valley/core';

export const MAPLIBRE_NATIVE_CAPABILITIES: MapCapabilities = {
  engineName: 'maplibre-react-native',
  globeProjection: false,
  extrudedBuildings: true,
  particleLayer: false,
  localizedLabels: true,
  cameraOffset: true,
  sky: true,
  builtInZoomControls: false,
  terrain: false,
};
