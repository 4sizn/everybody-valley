/**
 * 물줄기 흐름 애니메이션 소스·레이어 명세 (C10c, 결정 (j)).
 *
 * MapLibre 공식 "animate a line" 패턴 — 구간 중심선 위에 흰 점선을 얹고, 어댑터가
 * `line-dasharray` 를 `FLOW_DASH_SEQUENCE` 순서로 갈아 끼우면 점선이 상류→하류로 흘러가
 * 보인다. `line-dasharray` 는 web·native 가 모두 읽는 paint 속성이라 **두 플랫폼 공통**인
 * 유일한 흐름 표현이다(수면 셰이더는 web 전용이라 L1). 프레임 교체는 어댑터의 일이고
 * (web rAF / 네이티브 타이머), 켜고 끄는 규칙은 코어 `WaterFlowCoordinator` 가 정한다.
 *
 * 구간 선(상태색) **위**에 그린다 — 선 아래에 두면 굵은 상태색 선에 가려 점선이 안 보인다.
 * 바탕선(옅은 흰 선)은 점선이 지나는 길을 살짝 밝혀 흐름이 끊겨 보이지 않게 한다.
 */
import type { LineLayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { MapContent, Segment } from '@modu-valley/core';
import type { FeatureCollection, LineString } from 'geojson';
import { EMPTY_GEOJSON_SOURCE } from './featureProperties';
import type { FeatureLayerSet } from './layerSets';

export const FLOW_SOURCE_ID = 'valley-flow';
export const FLOW_BASE_LAYER_ID = 'valley-flow-base';
export const FLOW_DASH_LAYER_ID = 'valley-flow-dash';

/**
 * 점선 위상 시퀀스 — MapLibre 예제 그대로(dash 3 · gap 4 를 0.5 씩 밀어 14 단계). 한 바퀴
 * 돌면 처음과 이어진다. 어댑터는 `FLOW_FRAME_MS` 마다 다음 단계로 간다.
 */
export const FLOW_DASH_SEQUENCE: readonly (readonly number[])[] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
];

/** 단계 하나가 머무는 시간. 14 단계 × 60ms ≈ 0.84s 에 한 주기 — 스파이크에서 "흐른다"로 읽힌 속도. */
export const FLOW_FRAME_MS = 60;

/** 경과 시간(ms) → 시퀀스 단계. 어댑터 둘이 같은 식을 쓴다. */
export function flowStepAt(elapsedMs: number): number {
  return Math.floor(elapsedMs / FLOW_FRAME_MS) % FLOW_DASH_SEQUENCE.length;
}

/** 단계 → `line-dasharray` 값(가변 사본 — 지도 SDK 가 가변 배열을 요구한다). */
export function flowDashArray(step: number): number[] {
  const index =
    ((step % FLOW_DASH_SEQUENCE.length) + FLOW_DASH_SEQUENCE.length) % FLOW_DASH_SEQUENCE.length;
  return [...(FLOW_DASH_SEQUENCE[index] as readonly number[])];
}

export const FLOW_LINE_WIDTH = 2;

export const FLOW_BASE_LAYER: LineLayerSpecification = {
  id: FLOW_BASE_LAYER_ID,
  type: 'line',
  source: FLOW_SOURCE_ID,
  layout: { 'line-cap': 'round' },
  paint: {
    'line-color': '#ffffff',
    'line-width': FLOW_LINE_WIDTH,
    'line-opacity': 0.35,
  },
};

export const FLOW_DASH_LAYER: LineLayerSpecification = {
  id: FLOW_DASH_LAYER_ID,
  type: 'line',
  source: FLOW_SOURCE_ID,
  layout: { 'line-cap': 'round' },
  paint: {
    'line-color': '#ffffff',
    'line-width': FLOW_LINE_WIDTH,
    'line-opacity': 0.9,
    'line-dasharray': flowDashArray(0),
  },
};

export type FlowFeatureProperties = {
  readonly segmentId: string;
};

/** 구간 목록 → 중심선 컬렉션. 상류→하류 순서의 좌표열이라 점선이 그 방향으로 흐른다. */
export function toFlowFeatureCollection(
  segments: readonly Segment[],
): FeatureCollection<LineString, FlowFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: segments.map((segment) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: segment.path.map((point) => [point.lng, point.lat]),
      },
      properties: { segmentId: segment.id },
    })),
  };
}

export const FLOW_LAYER_SET: FeatureLayerSet = {
  kind: 'flow',
  sourceId: FLOW_SOURCE_ID,
  emptySource: EMPTY_GEOJSON_SOURCE,
  layers: [FLOW_BASE_LAYER, FLOW_DASH_LAYER],
  interactiveLayerIds: [],
  readFeatureId: () => undefined,
  dependencies: (content: MapContent) => [content.segments],
  toFeatureCollection: (content) => toFlowFeatureCollection(content.segments),
};
