/**
 * 계곡 구간 소스·레이어 명세 — LineString 에 혼잡 상태색, 그 아래 케이싱 한 장.
 *
 * 선택은 feature-state 가 아니라 `properties.selected` 로 싣는다. spotts 와
 * 같은 방식(`setData` 재주입)이고, 피처 수백 개 규모에서는 단순함이 이긴다.
 * 네이티브 래퍼에 feature-state API 가 없다는 점도 같은 결론을 낸다.
 *
 * V1 (c) — 물줄기가 지형 질감(C10 음영·고도색) 위에서 **가장 먼저** 읽히게 두 가지를
 * 바꿨다. ① 선을 굵게(z11 3.5 → z14 4.5 → z16 10px, 선택은 한 단계 더) ② 상태색 선
 * 바깥에 흰 **케이싱** 레이어(`valley-segment-casing`)를 같은 소스로 한 장 더 그린다 —
 * 케이싱이 아래, 상태색 선이 위. 케이싱 색은 라이트 값이고 다크(`#0c0c0c`)는 어댑터가
 * `valleyPaintOverrides` 로 덧쓴다(레이어 셋은 모드를 모른다). 히트 대상은 상태색 선만 —
 * 케이싱까지 잡으면 인접한 두 구간의 경계에서 어느 쪽이 눌렸는지가 넓은 쪽으로 기운다.
 *
 * 라벨 `symbol` 레이어와 `mapImportance` 정렬은 F1 에서 필요해질 때 얹는다 —
 * 속성에는 미리 실어 둔다.
 */
import type {
  ExpressionSpecification,
  LineLayerSpecification,
} from '@maplibre/maplibre-gl-style-spec';
import {
  type CrowdStatus,
  type MapContent,
  type MapSelection,
  type Segment,
  type SegmentId,
  type SegmentPosition,
  selectedIdOf,
} from '@modu-valley/core';
import type { FeatureCollection, LineString } from 'geojson';
import { EMPTY_GEOJSON_SOURCE, readStringProperty } from './featureProperties';
import type { FeatureLayerSet } from './layerSets';
import { CROWD_STATUS_COLORS, SEGMENT_CASING_COLORS, SEGMENT_UNKNOWN_COLOR } from './markerPalette';

export const SEGMENT_SOURCE_ID = 'valley-segments';
export const SEGMENT_LINE_LAYER_ID = 'valley-segment-line';
export const SEGMENT_CASING_LAYER_ID = 'valley-segment-casing';

export const SEGMENT_INTERACTIVE_LAYER_IDS = [SEGMENT_LINE_LAYER_ID] as const;

const IS_SELECTED: ExpressionSpecification = ['boolean', ['get', 'selected'], false];

/** 혼잡 상태 → 선 색. 상태를 모르면 accent. */
export const SEGMENT_LINE_COLOR: ExpressionSpecification = [
  'match',
  ['get', 'crowd'],
  'available',
  CROWD_STATUS_COLORS.available,
  'low',
  CROWD_STATUS_COLORS.low,
  'busy',
  CROWD_STATUS_COLORS.busy,
  SEGMENT_UNKNOWN_COLOR,
];

/** 줌 스톱 하나의 `[기본, 선택]` 폭(px). */
export type SegmentWidthStop = readonly [zoom: number, base: number, selected: number];

/**
 * 상태색 선폭 — V1 결정 (c). 선택된 구간은 굵게. 줌에 따라 두께를 키워 멀리서도 상태색이 읽힌다.
 * 스톱 표를 값으로 두는 이유: 케이싱 폭과 함께 테스트가 표로 고정하고, R5(실폭 수계)에서
 * 폭을 다시 정할 때 표 하나만 바꾸면 되게.
 */
export const SEGMENT_LINE_WIDTH_STOPS: readonly SegmentWidthStop[] = [
  [11, 3.5, 5],
  [14, 4.5, 6.5],
  [16, 10, 13],
];

/** 케이싱 폭 — 상태색 선 양쪽에 약 1.75~2.5px 씩 보이도록 선폭보다 넓다. */
export const SEGMENT_CASING_WIDTH_STOPS: readonly SegmentWidthStop[] = [
  [11, 7, 9],
  [14, 8.5, 11],
  [16, 15, 19],
];

export const SEGMENT_CASING_OPACITY = 0.95;

/** 스톱 표 → `interpolate` 표현식. 각 스톱에서 선택 여부로 폭을 가른다. */
export function segmentWidthExpression(
  stops: readonly SegmentWidthStop[],
): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    ...stops.flatMap(([zoom, base, selected]) => [zoom, ['case', IS_SELECTED, selected, base]]),
  ] as ExpressionSpecification;
}

export const SEGMENT_CASING_LAYER: LineLayerSpecification = {
  id: SEGMENT_CASING_LAYER_ID,
  type: 'line',
  source: SEGMENT_SOURCE_ID,
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': SEGMENT_CASING_COLORS.light,
    'line-width': segmentWidthExpression(SEGMENT_CASING_WIDTH_STOPS),
    'line-opacity': SEGMENT_CASING_OPACITY,
  },
};

export const SEGMENT_LINE_LAYER: LineLayerSpecification = {
  id: SEGMENT_LINE_LAYER_ID,
  type: 'line',
  source: SEGMENT_SOURCE_ID,
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': SEGMENT_LINE_COLOR,
    'line-width': segmentWidthExpression(SEGMENT_LINE_WIDTH_STOPS),
    // 케이싱이 바탕을 가려 주므로 상태색은 불투명하게 — 반투명이면 케이싱 흰색이 섞여 탁해진다.
    'line-opacity': 1,
  },
};

export type SegmentFeatureProperties = {
  readonly segmentId: string;
  readonly valleyId: string;
  readonly valleyName: string;
  readonly position: SegmentPosition;
  /** 상태를 모르는 구간은 `'unknown'` — 표현식의 fallback 색을 받는다. */
  readonly crowd: CrowdStatus | 'unknown';
  readonly selected: boolean;
  /** symbol-sort-key 재료. 미지정은 `null`. */
  readonly mapImportance: number | null;
};

/** 구간 목록 + 혼잡 맵 + 선택 id → 소스 데이터. 좌표는 `[lng, lat]`. */
export function toSegmentFeatureCollection(
  segments: readonly Segment[],
  crowd: ReadonlyMap<SegmentId, CrowdStatus>,
  selectedId: string | null = null,
): FeatureCollection<LineString, SegmentFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: segments.map((segment) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: segment.path.map((point) => [point.lng, point.lat]),
      },
      properties: {
        segmentId: segment.id,
        valleyId: segment.valleyId,
        valleyName: segment.valleyName,
        position: segment.position,
        crowd: crowd.get(segment.id) ?? 'unknown',
        selected: segment.id === selectedId,
        mapImportance: segment.mapImportance ?? null,
      },
    })),
  };
}

/** 히트된 피처에서 구간 id 를 읽는다. */
export function readSegmentFeatureId(properties: unknown): string | undefined {
  return readStringProperty(properties, 'segmentId');
}

export const SEGMENT_LAYER_SET: FeatureLayerSet = {
  kind: 'segment',
  sourceId: SEGMENT_SOURCE_ID,
  emptySource: EMPTY_GEOJSON_SOURCE,
  // 케이싱 아래 → 상태색 선 위.
  layers: [SEGMENT_CASING_LAYER, SEGMENT_LINE_LAYER],
  interactiveLayerIds: SEGMENT_INTERACTIVE_LAYER_IDS,
  readFeatureId: readSegmentFeatureId,
  dependencies: (content: MapContent, selection: MapSelection | null) => [
    content.segments,
    content.crowd,
    selectedIdOf(selection, 'segment'),
  ],
  toFeatureCollection: (content, selection) =>
    toSegmentFeatureCollection(content.segments, content.crowd, selectedIdOf(selection, 'segment')),
};
