import { EMPTY_MAP_CONTENT, type MapContent, type ShadeOverlay } from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import { isInteractiveLayerSet, sameDependencies } from '../src/layerSets';
import {
  SHADE_CANOPY_LAYER,
  SHADE_CANOPY_LAYER_ID,
  SHADE_COLORS,
  SHADE_LAYER_SET,
  SHADE_SHADOW_LAYER,
  SHADE_SHADOW_LAYER_ID,
  SHADE_SOURCE_ID,
  toShadeFeatureCollection,
} from '../src/shadeLayers';

/** 닫힌 사각 링 하나짜리 폴리곤. */
function square(lng: number, lat: number, size = 0.001) {
  return [
    [
      [lng, lat],
      [lng + size, lat],
      [lng + size, lat + size],
      [lng, lat + size],
      [lng, lat],
    ] as const,
  ] as const;
}

const CANOPY_A = square(127.26, 37.83);
const CANOPY_B = square(127.262, 37.831);
const SHADOW_A = square(127.264, 37.832);

const OVERLAY: ShadeOverlay = {
  canopy: [CANOPY_A, CANOPY_B],
  shadow: [SHADOW_A],
};

describe('toShadeFeatureCollection', () => {
  it('null 이면 빈 컬렉션 — 그늘이 꺼져 있거나 데이터가 없다', () => {
    expect(toShadeFeatureCollection(null)).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('수관 뒤에 그림자, 각 피처의 properties.layer 로 구분, 좌표 배열은 복사하지 않는다', () => {
    const collection = toShadeFeatureCollection(OVERLAY);
    expect(collection.features).toHaveLength(3);
    expect(collection.features.map((f) => f.properties.layer)).toEqual([
      'canopy',
      'canopy',
      'shadow',
    ]);
    for (const feature of collection.features) expect(feature.geometry.type).toBe('Polygon');
    // 참조 그대로 — 정점 수천 개를 복사하지 않는다.
    expect(collection.features[0]?.geometry.coordinates).toBe(CANOPY_A);
    expect(collection.features[2]?.geometry.coordinates).toBe(SHADOW_A);
  });
});

describe('SHADE_LAYER_SET', () => {
  it('한 소스, fill 레이어 2장 — properties.layer 필터로 갈라 결정 (d) 의 색을 준다', () => {
    expect(SHADE_LAYER_SET.kind).toBe('shade');
    expect(SHADE_LAYER_SET.sourceId).toBe(SHADE_SOURCE_ID);
    expect(SHADE_LAYER_SET.layers.map((layer) => layer.id)).toEqual([
      SHADE_CANOPY_LAYER_ID,
      SHADE_SHADOW_LAYER_ID,
    ]);
    for (const layer of SHADE_LAYER_SET.layers) {
      expect(layer.type).toBe('fill');
      expect('source' in layer && layer.source).toBe(SHADE_SOURCE_ID);
    }
    expect(SHADE_CANOPY_LAYER.filter).toEqual(['==', ['get', 'layer'], 'canopy']);
    expect(SHADE_SHADOW_LAYER.filter).toEqual(['==', ['get', 'layer'], 'shadow']);
    expect(SHADE_CANOPY_LAYER.paint).toEqual({
      'fill-color': SHADE_COLORS.canopy,
      'fill-opacity': SHADE_COLORS.canopyOpacity,
    });
    expect(SHADE_SHADOW_LAYER.paint).toEqual({
      'fill-color': SHADE_COLORS.shadow,
      'fill-opacity': SHADE_COLORS.shadowOpacity,
    });
    expect(SHADE_COLORS).toEqual({
      canopy: '#1f4d2e',
      canopyOpacity: 0.28,
      shadow: '#1c3a5e',
      shadowOpacity: 0.32,
    });
  });

  it('히트 대상이 아니고 라벨 아래에 그린다 — 결정 (e)', () => {
    expect(SHADE_LAYER_SET.interactiveLayerIds).toEqual([]);
    expect(isInteractiveLayerSet(SHADE_LAYER_SET)).toBe(false);
    expect(SHADE_LAYER_SET.readFeatureId({ layer: 'canopy' })).toBeUndefined();
    expect(SHADE_LAYER_SET.placement).toBe('below-labels');
  });

  it('의존 배열은 content.shade 하나 — 선택·구간·시설이 바뀌어도 다시 쓰지 않는다', () => {
    const content: MapContent = { ...EMPTY_MAP_CONTENT, shade: OVERLAY };
    expect(SHADE_LAYER_SET.dependencies(content, null)).toEqual([OVERLAY]);
    expect(SHADE_LAYER_SET.toFeatureCollection(content, null).features).toHaveLength(3);
    expect(SHADE_LAYER_SET.toFeatureCollection(EMPTY_MAP_CONTENT, null).features).toEqual([]);

    const withSegments: MapContent = { ...content, segments: [], crowd: new Map() };
    expect(
      sameDependencies(
        SHADE_LAYER_SET.dependencies(content, null),
        SHADE_LAYER_SET.dependencies(withSegments, null),
      ),
    ).toBe(true);

    const nextHour: MapContent = { ...content, shade: { ...OVERLAY, shadow: [] } };
    expect(
      sameDependencies(
        SHADE_LAYER_SET.dependencies(content, null),
        SHADE_LAYER_SET.dependencies(nextHour, null),
      ),
    ).toBe(false);
  });
});
