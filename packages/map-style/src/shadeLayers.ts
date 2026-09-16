/**
 * 그늘 소스·레이어 명세 — 수관과 개방지 그림자 fill 2장 (F4).
 *
 * 한 소스에 두 레이어다. 수관(`layer: 'canopy'`)은 시각 무관, 그림자(`layer: 'shadow'`)는
 * 그 시각의 것 — 둘을 한 컬렉션에 실어 `setData` 가 한 번만 일어나게 하고, 레이어는
 * `properties.layer` 필터로 갈라 색을 달리 준다(결정 (d)).
 *
 * 색은 두 테마에 같은 값이다. 레이어 셋은 모드를 모르고, 다크 계곡 화면은 계약 밖이다
 * (C10 메모와 같은 태도). 라이트 지도에서 정한 값: 수관 진녹 0.28, 그림자 남청 0.32 —
 * 라이트 팔레트가 녹지를 이미 진하게 칠하므로(`VALLEY_PARK_OPACITY`) 그림자가 수관보다
 * 살짝 짙어 개방지의 그림자가 먼저 읽힌다.
 *
 * 히트 대상이 아니다(`interactiveLayerIds: []`) — 그늘 폴리곤 클릭 정보는 범위 밖이고,
 * 반투명 fill 이 구간 선 클릭을 가로채면 안 된다. 라벨 아래에 그린다(`placement`).
 */
import type {
  ExpressionSpecification,
  FillLayerSpecification,
} from '@maplibre/maplibre-gl-style-spec';
import type { MapContent, ShadeOverlay, ShadePolygon } from '@modu-valley/core';
import type { Feature, FeatureCollection, Polygon, Position } from 'geojson';
import { EMPTY_GEOJSON_SOURCE } from './featureProperties';
import type { FeatureLayerSet } from './layerSets';

export const SHADE_SOURCE_ID = 'valley-shade';
export const SHADE_CANOPY_LAYER_ID = 'valley-shade-canopy';
export const SHADE_SHADOW_LAYER_ID = 'valley-shade-shadow';

/** `properties.layer` 값. 산출 파일의 `layer` 속성과 같은 어휘다. */
export const SHADE_LAYER_KINDS = ['canopy', 'shadow'] as const;
export type ShadeLayerKind = (typeof SHADE_LAYER_KINDS)[number];

/** F4 결정 (d) — 라이트 지도 기준, 두 테마 공통. */
export const SHADE_COLORS = {
  canopy: '#1f4d2e',
  canopyOpacity: 0.28,
  shadow: '#1c3a5e',
  shadowOpacity: 0.32,
} as const;

function layerFilter(kind: ShadeLayerKind): ExpressionSpecification {
  return ['==', ['get', 'layer'], kind];
}

export const SHADE_CANOPY_LAYER: FillLayerSpecification = {
  id: SHADE_CANOPY_LAYER_ID,
  type: 'fill',
  source: SHADE_SOURCE_ID,
  filter: layerFilter('canopy'),
  // 사용자 요청: 수관 면은 숨기고 시간대별 개방지 그림자만 표시한다.
  layout: { visibility: 'none' },
  paint: {
    'fill-color': SHADE_COLORS.canopy,
    'fill-opacity': SHADE_COLORS.canopyOpacity,
  },
};

export const SHADE_SHADOW_LAYER: FillLayerSpecification = {
  id: SHADE_SHADOW_LAYER_ID,
  type: 'fill',
  source: SHADE_SOURCE_ID,
  filter: layerFilter('shadow'),
  paint: {
    'fill-color': SHADE_COLORS.shadow,
    'fill-opacity': SHADE_COLORS.shadowOpacity,
  },
};

export type ShadeFeatureProperties = {
  readonly layer: ShadeLayerKind;
};

/**
 * 오버레이 → 소스 데이터. 폴리곤 좌표 배열은 **복사하지 않고** 그대로 싣는다 —
 * 정점이 수천 개고, 지도 SDK 는 읽기만 한다. `ShadePolygon` 은 읽기 전용 튜플 배열이고
 * GeoJSON `Position` 은 가변 `number[]` 라 타입만 경계에서 한 번 바꾼다.
 */
export function toShadeFeatureCollection(
  overlay: ShadeOverlay | null,
): FeatureCollection<Polygon, ShadeFeatureProperties> {
  if (overlay === null) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: [
      ...overlay.canopy.map((polygon) => toFeature(polygon, 'canopy')),
      ...overlay.shadow.map((polygon) => toFeature(polygon, 'shadow')),
    ],
  };
}

function toFeature(
  polygon: ShadePolygon,
  layer: ShadeLayerKind,
): Feature<Polygon, ShadeFeatureProperties> {
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: polygon as unknown as Position[][] },
    properties: { layer },
  };
}

export const SHADE_LAYER_SET: FeatureLayerSet = {
  kind: 'shade',
  sourceId: SHADE_SOURCE_ID,
  emptySource: EMPTY_GEOJSON_SOURCE,
  layers: [SHADE_CANOPY_LAYER, SHADE_SHADOW_LAYER],
  interactiveLayerIds: [],
  readFeatureId: () => undefined,
  placement: 'below-labels',
  dependencies: (content: MapContent) => [content.shade],
  toFeatureCollection: (content) => toShadeFeatureCollection(content.shade),
};
