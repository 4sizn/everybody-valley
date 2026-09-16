/**
 * @modu-valley/adapter-native — android/ios 어댑터.
 *
 * maplibre-native 기반 지도 엔진과 비동기 저장 어댑터가 여기 있다.
 * web 어댑터와 마찬가지로 코어는 이 패키지를 모른다 — 의존 방향은 항상
 * 어댑터 → 코어다.
 *
 * 한 가지가 web 과 다르다. 선언형 래퍼에서는 지도 객체를 어댑터가 소유할 수
 * 없으므로, 지도·소스·레이어·마커의 **렌더링은 표현 계층**이 하고 이 패키지는
 * `MapSurface` 를 통해 그릴 것을 게시하고 지도 이벤트를 받는다. 덕분에 이
 * 패키지는 react·react-native 를 import 하지 않고, DOM 도 RN 도 켜지 않은
 * 채로 컴파일된다 — 애플리케이션 계층이 플랫폼 API 에 새지 않았다는 증거가
 * 그대로 남는다.
 */

export {
  EMPTY_LAYER_PAINT_OVERRIDES,
  EMPTY_MAP_SCENE,
  EMPTY_PLACEMENT_LAYER_IDS,
  EMPTY_SCENE_SOURCES,
  type LayerPaintOverrides,
  type MapScene,
  type NativeCameraStop,
  type NativeLngLat,
  type NativeViewPadding,
  type NativeViewState,
  type PlacementLayerIds,
  type SceneSources,
  type SelectedPin,
} from './map/MapScene';
export {
  type MapCameraDriver,
  MapSurface,
  type MapSurfaceEvents,
} from './map/MapSurface';
export {
  NativeCameraController,
  type NativeCameraControllerOptions,
  toNativeStop,
} from './map/NativeCameraController';
export {
  NATIVE_SUCCESS_QUIET_MS,
  NativeMapEngine,
  type NativeMapEngineOptions,
} from './map/NativeMapEngine';
export { type LoadMapStyleOptions, loadMapStyle } from './map/nativeStyle';
export { MAPLIBRE_NATIVE_CAPABILITIES } from './NativeMapCapabilities';
export {
  AsyncKeyValueStorage,
  type AsyncKeyValueStorageOptions,
  type AsyncKeyValueStore,
} from './storage/AsyncKeyValueStorage';
