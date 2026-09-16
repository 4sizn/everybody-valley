/**
 * @modu-valley/adapter-web — web 플랫폼 어댑터.
 *
 * maplibre-gl(WebGL2)·DOM·localStorage 에 의존하는 모든 코드가 이 패키지에
 * 갇혀 있다. 코어는 이 패키지를 모른다 — 의존 방향은 항상 어댑터 → 코어다.
 */
export { FIREWORK_LAYER_ID, FireworkLayer, type FireworkLayerOptions } from './fireworks/index';
export { CameraController } from './map/CameraController';
export { FeatureLayerController } from './map/FeatureLayerController';
export {
  MAPLIBRE_CAPABILITIES,
  MapLibreEngine,
  type MapLibreEngineOptions,
} from './map/MapLibreEngine';
export { SELECTION_PIN_CLASS, SelectionPinController } from './map/SelectionPinController';
export { WebStorage } from './storage/index';
