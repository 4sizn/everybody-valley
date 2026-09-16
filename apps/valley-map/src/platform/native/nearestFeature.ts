/**
 * 겹친 탭에서 가장 가까운 시설(점 지오메트리)을 고른다 — web
 * `FeatureLayerController` 의 `nearestFeature` 네이티브 짝(X2).
 *
 * `maplibre-react-native` 의 `GeoJSONSource.onPress` 도 web 의
 * `queryRenderedFeatures` 와 같은 문제가 있다 — `event.nativeEvent.features`
 * 가 매칭된 피처를 화면 근접도가 아니라 내부 순서로 돌려준다. 시설이 몰린
 * 곳(상가 옆 주차장·공원 옆 화장실)에서 `[0]` 을 그대로 쓰면 탭한 핀이 아니라
 * 순서상 앞선 딴 시설이 선택된다.
 *
 * web 은 `map.project()` 로 화면 픽셀 거리를 재는데, 네이티브의 동기 project
 * API 는 없다(브릿지 호출은 비동기). 대신 `PressEvent.lngLat`(탭 지점의
 * 지리 좌표)과 각 피처 좌표의 거리로 가른다 — 시설이 겹칠 만큼 가까운
 * 범위에서는 위도에 따른 경도 축척 왜곡이 순서를 뒤집을 만큼 크지 않다.
 */
import type { LngLat } from '@maplibre/maplibre-react-native';

/** `Point` 지오메트리의 좌표만 — 그 외(선 등)는 거리 비교 대상이 아니다. */
function pointCoordinatesOf(feature: GeoJSON.Feature): [number, number] | undefined {
  return feature.geometry.type === 'Point'
    ? (feature.geometry.coordinates as [number, number])
    : undefined;
}

/** `target` 에 가장 가까운 피처. 점이 아닌 피처만 있으면 첫 피처를 그대로 쓴다. */
export function nearestFeatureByLngLat(
  target: LngLat,
  features: readonly GeoJSON.Feature[],
): GeoJSON.Feature | undefined {
  if (features.length <= 1) return features[0];

  let best: GeoJSON.Feature | undefined;
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  for (const feature of features) {
    const coordinates = pointCoordinatesOf(feature);
    if (coordinates === undefined) {
      best ??= feature;
      continue;
    }
    const dx = coordinates[0] - target[0];
    const dy = coordinates[1] - target[1];
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      best = feature;
    }
  }
  return best ?? features[0];
}
