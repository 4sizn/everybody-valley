/**
 * 물줄기 면·흐름 점선·봉우리 라벨 명세 (C10c).
 */
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { EMPTY_MAP_CONTENT, type MapContent } from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import { composeMapStyle } from '../src/composeMapStyle';
import {
  FLOW_DASH_LAYER_ID,
  FLOW_DASH_SEQUENCE,
  FLOW_FRAME_MS,
  FLOW_LAYER_SET,
  flowDashArray,
  flowStepAt,
  toFlowFeatureCollection,
} from '../src/flowLayers';
import { sameDependencies } from '../src/layerSets';
import { DARK_MAP_PALETTE, LIGHT_MAP_PALETTE } from '../src/palette';
import { PEAK_HEIGHT_OFFSET_M, PEAK_LABEL_LAYER_ID, peakLabelLayer } from '../src/peakLayers';
import { toWaterFeatureCollection, WATER_LAYER_SET } from '../src/waterLayers';
import { CROWD, FACILITIES, SEGMENTS } from './fixtures';
import positronFixture from './fixtures/positron.layers.json';

const positron = positronFixture as unknown as StyleSpecification;

const CONTENT: MapContent = {
  ...EMPTY_MAP_CONTENT,
  segments: SEGMENTS,
  facilities: FACILITIES,
  crowd: CROWD,
};

describe('waterLayers — 구간 → 폭 있는 폴리곤', () => {
  it('구간마다 닫힌 폴리곤 하나, 위치 속성', () => {
    const collection = toWaterFeatureCollection(SEGMENTS);
    expect(collection.features).toHaveLength(3);
    for (const [index, feature] of collection.features.entries()) {
      const ring = feature.geometry.coordinates[0] ?? [];
      expect(ring.length).toBe((SEGMENTS[index]?.path.length ?? 0) * 2 + 1);
      expect(ring[0]).toEqual(ring[ring.length - 1]);
      expect(feature.properties.position).toBe(SEGMENTS[index]?.position);
    }
  });

  it('구간 배열 참조에만 의존한다 — 선택·혼잡이 바뀌어도 다시 쓰지 않는다', () => {
    const base = WATER_LAYER_SET.dependencies(CONTENT, null);
    const segment = SEGMENTS[1];
    if (segment === undefined) throw new Error('fixture');
    expect(
      sameDependencies(base, WATER_LAYER_SET.dependencies(CONTENT, { kind: 'segment', segment })),
    ).toBe(true);
    expect(
      sameDependencies(base, WATER_LAYER_SET.dependencies({ ...CONTENT, crowd: new Map() }, null)),
    ).toBe(true);
    expect(
      sameDependencies(base, WATER_LAYER_SET.dependencies({ ...CONTENT, segments: [] }, null)),
    ).toBe(false);
  });
});

describe('flowLayers — 점선 시퀀스', () => {
  it('14 단계, 60ms 프레임, 단계는 시간에서 순환한다', () => {
    expect(FLOW_DASH_SEQUENCE).toHaveLength(14);
    expect(FLOW_FRAME_MS).toBe(60);
    expect(flowStepAt(0)).toBe(0);
    expect(flowStepAt(59)).toBe(0);
    expect(flowStepAt(60)).toBe(1);
    expect(flowStepAt(14 * 60)).toBe(0);
    expect(flowDashArray(0)).toEqual([0, 4, 3]);
    expect(flowDashArray(14)).toEqual([0, 4, 3]);
    expect(flowDashArray(-1)).toEqual([0, 3.5, 3, 0.5]);
    // 가변 사본 — 원본 시퀀스를 건드리지 않는다.
    const copy = flowDashArray(1);
    copy[0] = 99;
    expect(FLOW_DASH_SEQUENCE[1]).toEqual([0.5, 4, 2.5]);
  });

  it('점선 레이어의 초기 dasharray 는 0 단계, 중심선은 상류→하류 좌표열 그대로', () => {
    const dash = FLOW_LAYER_SET.layers.find((layer) => layer.id === FLOW_DASH_LAYER_ID);
    expect(dash?.type === 'line' && dash.paint?.['line-dasharray']).toEqual([0, 4, 3]);
    const collection = toFlowFeatureCollection(SEGMENTS);
    expect(collection.features[0]?.geometry.coordinates[0]).toEqual([127.2612, 37.8341]);
    expect(FLOW_LAYER_SET.toFeatureCollection(EMPTY_MAP_CONTENT, null).features).toEqual([]);
  });
});

describe('peakLayers — 봉우리 라벨', () => {
  it('mountain_peak 심볼, 줌 11+, 표고 내림차순, 모드별 label-poi 색', () => {
    const light = peakLabelLayer('light', { heightOffset: false });
    expect(light['source-layer']).toBe('mountain_peak');
    expect(light.minzoom).toBe(11);
    expect(light.layout?.['symbol-sort-key']).toEqual(['-', 0, ['coalesce', ['get', 'ele'], 0]]);
    expect(light.paint?.['text-color']).toBe(LIGHT_MAP_PALETTE.poiText);
    expect(light.paint?.['text-halo-color']).toBe(LIGHT_MAP_PALETTE.labelHalo);
    expect(JSON.stringify(light.layout?.['text-field'])).toContain('▲ ');
    expect(light.layout).not.toHaveProperty('symbol-height-offset');

    const dark = peakLabelLayer('dark', { heightOffset: true });
    expect(dark.paint?.['text-color']).toBe(DARK_MAP_PALETTE.poiText);
    expect(dark.layout).toMatchObject({
      'symbol-height-offset': PEAK_HEIGHT_OFFSET_M,
      'symbol-height-anchor': 'ground',
    });
  });

  it('composeMapStyle terrain 은 봉우리 라벨을 맨 위에 얹고, terrain3d 일 때만 높이 오프셋', () => {
    const flat = composeMapStyle(positron, 'light', { terrain: true });
    const last = flat.style.layers.at(-1);
    expect(last?.id).toBe(PEAK_LABEL_LAYER_ID);
    expect(last?.type === 'symbol' && last.layout).not.toHaveProperty('symbol-height-offset');

    const web = composeMapStyle(positron, 'light', { terrain: true, terrain3d: true });
    const peak = web.style.layers.find((layer) => layer.id === PEAK_LABEL_LAYER_ID);
    expect(peak?.type === 'symbol' && peak.layout).toHaveProperty('symbol-height-offset');

    // festival 기본값에는 없다.
    expect(composeMapStyle(positron, 'light').style.layers.map((l) => l.id)).not.toContain(
      PEAK_LABEL_LAYER_ID,
    );
  });
});
