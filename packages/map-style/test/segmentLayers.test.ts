import { CROWD_STATUSES } from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import {
  CROWD_STATUS_COLORS,
  SEGMENT_CASING_COLORS,
  SEGMENT_UNKNOWN_COLOR,
} from '../src/markerPalette';
import {
  readSegmentFeatureId,
  SEGMENT_CASING_LAYER,
  SEGMENT_CASING_LAYER_ID,
  SEGMENT_CASING_WIDTH_STOPS,
  SEGMENT_LAYER_SET,
  SEGMENT_LINE_COLOR,
  SEGMENT_LINE_LAYER,
  SEGMENT_LINE_LAYER_ID,
  SEGMENT_LINE_WIDTH_STOPS,
  SEGMENT_SOURCE_ID,
  segmentWidthExpression,
  toSegmentFeatureCollection,
} from '../src/segmentLayers';
import { CROWD, LOWER, MID, SEGMENTS, UPPER } from './fixtures';

describe('toSegmentFeatureCollection', () => {
  it('구간마다 LineString 피처 하나, 좌표는 [lng, lat] 순서', () => {
    const collection = toSegmentFeatureCollection(SEGMENTS, CROWD);
    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features).toHaveLength(3);

    const first = collection.features[0];
    expect(first?.geometry.type).toBe('LineString');
    expect(first?.geometry.coordinates[0]).toEqual([127.2612, 37.8341]);
    expect(first?.geometry.coordinates).toHaveLength(UPPER.path.length);
  });

  it('혼잡 맵을 crowd 속성으로 옮기고, 없는 구간은 unknown', () => {
    const [upper, mid, lower] = toSegmentFeatureCollection(SEGMENTS, CROWD).features;
    expect(upper?.properties.crowd).toBe('available');
    expect(mid?.properties.crowd).toBe('busy');
    expect(lower?.properties.crowd).toBe('unknown');
  });

  it('선택 id 를 받은 구간만 selected 가 true', () => {
    const features = toSegmentFeatureCollection(SEGMENTS, CROWD, MID.id).features;
    expect(features.map((f) => f.properties.selected)).toEqual([false, true, false]);

    const none = toSegmentFeatureCollection(SEGMENTS, CROWD).features;
    expect(none.every((f) => f.properties.selected === false)).toBe(true);
  });

  it('도메인 속성을 그대로 싣고 미지정 mapImportance 는 null', () => {
    const [upper, mid] = toSegmentFeatureCollection(SEGMENTS, CROWD).features;
    expect(upper?.properties).toMatchObject({
      segmentId: 'sample-upper',
      valleyId: 'sample',
      valleyName: '샘플계곡',
      position: 'upper',
      mapImportance: 20,
    });
    expect(mid?.properties.mapImportance).toBeNull();
  });

  it('readSegmentFeatureId 는 만든 속성에서 id 를 되읽고, 남은 입력은 거절한다', () => {
    const feature = toSegmentFeatureCollection([LOWER], CROWD).features[0];
    expect(readSegmentFeatureId(feature?.properties)).toBe('sample-lower');
    expect(readSegmentFeatureId(undefined)).toBeUndefined();
    expect(readSegmentFeatureId(null)).toBeUndefined();
    expect(readSegmentFeatureId({ segmentId: 3 })).toBeUndefined();
    expect(readSegmentFeatureId({ spotId: 'x' })).toBeUndefined();
  });
});

describe('SEGMENT_LINE_LAYER', () => {
  it('소스를 가리키고 line-color 는 세 상태 + unknown accent 를 모두 다룬다', () => {
    expect(SEGMENT_LINE_LAYER.source).toBe(SEGMENT_SOURCE_ID);
    expect(SEGMENT_LINE_LAYER.type).toBe('line');

    const match = SEGMENT_LINE_COLOR as readonly unknown[];
    expect(match[0]).toBe('match');
    for (const status of CROWD_STATUSES) {
      const index = match.indexOf(status);
      expect(index).toBeGreaterThan(1);
      expect(match[index + 1]).toBe(CROWD_STATUS_COLORS[status]);
    }
    expect(match.at(-1)).toBe(SEGMENT_UNKNOWN_COLOR);
  });
});

describe('구간 케이싱 — V1 결정 (c)', () => {
  it('레이어 셋은 케이싱 → 상태색 선 순서, 히트 대상은 상태색 선만', () => {
    expect(SEGMENT_LAYER_SET.layers.map((layer) => layer.id)).toEqual([
      SEGMENT_CASING_LAYER_ID,
      SEGMENT_LINE_LAYER_ID,
    ]);
    expect(SEGMENT_LAYER_SET.interactiveLayerIds).toEqual([SEGMENT_LINE_LAYER_ID]);
    expect(SEGMENT_CASING_LAYER.source).toBe(SEGMENT_SOURCE_ID);
    expect(SEGMENT_CASING_LAYER.type).toBe('line');
  });

  it('폭 표: 선 z11 3.5/5 → z14 4.5/6.5 → z16 10/13, 케이싱 z11 7/9 → z14 8.5/11 → z16 15/19', () => {
    expect(SEGMENT_LINE_WIDTH_STOPS).toEqual([
      [11, 3.5, 5],
      [14, 4.5, 6.5],
      [16, 10, 13],
    ]);
    expect(SEGMENT_CASING_WIDTH_STOPS).toEqual([
      [11, 7, 9],
      [14, 8.5, 11],
      [16, 15, 19],
    ]);
    // 모든 스톱에서 케이싱이 선보다 넓어야 테두리가 보인다.
    SEGMENT_CASING_WIDTH_STOPS.forEach(([zoom, base, selected], index) => {
      const line = SEGMENT_LINE_WIDTH_STOPS[index];
      expect(line?.[0]).toBe(zoom);
      expect(base).toBeGreaterThan(line?.[1] ?? Number.POSITIVE_INFINITY);
      expect(selected).toBeGreaterThan(line?.[2] ?? Number.POSITIVE_INFINITY);
    });
  });

  it('폭 표현식은 줌 보간 안에서 선택 여부로 가른다', () => {
    expect(segmentWidthExpression([[11, 3.5, 5]])).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      11,
      ['case', ['boolean', ['get', 'selected'], false], 5, 3.5],
    ]);
    expect(SEGMENT_LINE_LAYER.paint?.['line-width']).toEqual(
      segmentWidthExpression(SEGMENT_LINE_WIDTH_STOPS),
    );
    expect(SEGMENT_CASING_LAYER.paint?.['line-width']).toEqual(
      segmentWidthExpression(SEGMENT_CASING_WIDTH_STOPS),
    );
  });

  it('케이싱은 라이트 흰색·0.95, 상태색 선은 불투명 — 다크 케이싱 값은 팔레트에 따로', () => {
    expect(SEGMENT_CASING_LAYER.paint?.['line-color']).toBe(SEGMENT_CASING_COLORS.light);
    expect(SEGMENT_CASING_LAYER.paint?.['line-opacity']).toBe(0.95);
    expect(SEGMENT_LINE_LAYER.paint?.['line-opacity']).toBe(1);
    expect(SEGMENT_CASING_COLORS).toEqual({ light: '#ffffff', dark: '#0c0c0c' });
  });
});
