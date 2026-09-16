/**
 * 물줄기 폴리곤 소스·레이어 명세 — 구간 선을 폭 있는 면으로 (C10c, 결정 (j) J1).
 *
 * 폴리곤은 코어의 순수 계산(`waterPolygonOf`)이 만든다 — 상류 6m·중류 12m·하류 18m 띠.
 * R5(실폭 수계 폴리곤)가 오면 `toFeatureCollection` 만 실제 폴리곤을 읽도록 바뀌고 레이어
 * 명세는 그대로다. 3D 지형(web)에서는 fill 이 지형에 드레이프되어 골짜기 바닥에 놓인다.
 *
 * 구간 선(`valley-segment-line`, 혼잡 상태색) **아래**에 그린다 — 상태색을 폴리곤에 칠할지는
 * 다음 검토(docs/TODO.md C10 3단계). 히트 대상이 아니다(선이 받는다). 배치는 맨 위
 * (구간 선과 같은 층) — 폭이 수 px 라 라벨을 가리지 않는다.
 */
import type {
  FillLayerSpecification,
  LineLayerSpecification,
} from '@maplibre/maplibre-gl-style-spec';
import { type MapContent, type Segment, waterPolygonOf } from '@modu-valley/core';
import type { Feature, FeatureCollection, Polygon, Position } from 'geojson';
import { EMPTY_GEOJSON_SOURCE } from './featureProperties';
import type { FeatureLayerSet } from './layerSets';

export const WATER_SOURCE_ID = 'valley-water';
export const WATER_FILL_LAYER_ID = 'valley-water-fill';
export const WATER_EDGE_LAYER_ID = 'valley-water-edge';

/** 스파이크 `?poly=1` 에서 확정한 값 — 라이트 물색(`#a5d1f2`)보다 한 단계 짙어 물줄기가 먼저 읽힌다. */
export const WATER_COLORS = {
  fill: '#5fa8e0',
  fillOpacity: 0.85,
  edge: '#2f6fa8',
  edgeOpacity: 0.7,
} as const;

export const WATER_FILL_LAYER: FillLayerSpecification = {
  id: WATER_FILL_LAYER_ID,
  type: 'fill',
  source: WATER_SOURCE_ID,
  paint: {
    'fill-color': WATER_COLORS.fill,
    'fill-opacity': WATER_COLORS.fillOpacity,
  },
};

export const WATER_EDGE_LAYER: LineLayerSpecification = {
  id: WATER_EDGE_LAYER_ID,
  type: 'line',
  source: WATER_SOURCE_ID,
  paint: {
    'line-color': WATER_COLORS.edge,
    'line-width': 1,
    'line-opacity': WATER_COLORS.edgeOpacity,
  },
};

export type WaterFeatureProperties = {
  readonly segmentId: string;
  readonly position: Segment['position'];
};

/** 구간 목록 → 물줄기 폴리곤 컬렉션. 두 점 미만 구간은 없다(`Segment` 생성자가 보장). */
export function toWaterFeatureCollection(
  segments: readonly Segment[],
): FeatureCollection<Polygon, WaterFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: segments.map(
      (segment): Feature<Polygon, WaterFeatureProperties> => ({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [waterPolygonOf(segment) as unknown as Position[]],
        },
        properties: { segmentId: segment.id, position: segment.position },
      }),
    ),
  };
}

export const WATER_LAYER_SET: FeatureLayerSet = {
  kind: 'water',
  sourceId: WATER_SOURCE_ID,
  emptySource: EMPTY_GEOJSON_SOURCE,
  layers: [WATER_FILL_LAYER, WATER_EDGE_LAYER],
  interactiveLayerIds: [],
  readFeatureId: () => undefined,
  dependencies: (content: MapContent) => [content.segments],
  toFeatureCollection: (content) => toWaterFeatureCollection(content.segments),
};
