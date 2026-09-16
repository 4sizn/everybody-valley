import { EMPTY_MAP_CONTENT, type MapContent } from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import { SEGMENT_CASING_COLORS } from '../src/markerPalette';
import { SEGMENT_CASING_LAYER_ID } from '../src/segmentLayers';
import { SHADE_CANOPY_LAYER_ID, SHADE_COLORS } from '../src/shadeLayers';
import { HILLSHADE_LAYER_ID, HILLSHADE_PAINT } from '../src/terrainLayers';
import {
  isShadeVisible,
  mergePaintOverrides,
  SHADE_ON_CANOPY_OPACITY,
  SHADE_ON_HILLSHADE_EXAGGERATION,
  valleyPaintOverrides,
} from '../src/valleyPaint';

const SHADED: MapContent = { ...EMPTY_MAP_CONTENT, shade: { canopy: [], shadow: [] } };

describe('valleyPaintOverrides — V1 결정 (c) 다크 케이싱 · (g) 그늘 대비', () => {
  it('그늘 꺼짐: 케이싱은 모드 색, 음영·수관은 명세 값(복귀 값)', () => {
    expect(valleyPaintOverrides('light', { shadeVisible: false })).toEqual({
      [SEGMENT_CASING_LAYER_ID]: { 'line-color': '#ffffff' },
      [HILLSHADE_LAYER_ID]: { 'hillshade-exaggeration': 0.5 },
      [SHADE_CANOPY_LAYER_ID]: { 'fill-opacity': 0.28 },
    });
    expect(valleyPaintOverrides('dark', { shadeVisible: false })).toEqual({
      [SEGMENT_CASING_LAYER_ID]: { 'line-color': '#0c0c0c' },
      [HILLSHADE_LAYER_ID]: { 'hillshade-exaggeration': HILLSHADE_PAINT.dark.exaggeration },
      [SHADE_CANOPY_LAYER_ID]: { 'fill-opacity': SHADE_COLORS.canopyOpacity },
    });
  });

  it('그늘 켜짐: 음영 0.2 · 수관 0.4, 케이싱은 그대로', () => {
    expect(SHADE_ON_HILLSHADE_EXAGGERATION).toBe(0.2);
    expect(SHADE_ON_CANOPY_OPACITY).toBe(0.4);
    for (const mode of ['light', 'dark'] as const) {
      const on = valleyPaintOverrides(mode, { shadeVisible: true });
      expect(on[HILLSHADE_LAYER_ID]).toEqual({ 'hillshade-exaggeration': 0.2 });
      expect(on[SHADE_CANOPY_LAYER_ID]).toEqual({ 'fill-opacity': 0.4 });
      expect(on[SEGMENT_CASING_LAYER_ID]).toEqual({ 'line-color': SEGMENT_CASING_COLORS[mode] });
    }
  });

  it('(a) 유지 — 복귀 값은 지형 명세와 같은 참조 값이다(0.5 · 0.85 는 건드리지 않는다)', () => {
    expect(HILLSHADE_PAINT.light.exaggeration).toBe(0.5);
    expect(valleyPaintOverrides('light', { shadeVisible: false })[HILLSHADE_LAYER_ID]).toEqual({
      'hillshade-exaggeration': HILLSHADE_PAINT.light.exaggeration,
    });
  });

  it('isShadeVisible 은 content.shade 유무 — 그늘 보기 켜짐 ∧ 데이터 있음', () => {
    expect(isShadeVisible(EMPTY_MAP_CONTENT)).toBe(false);
    expect(isShadeVisible(SHADED)).toBe(true);
  });

  it('mergePaintOverrides 는 레이어별로 속성을 합치고 뒤가 이긴다', () => {
    expect(mergePaintOverrides()).toEqual({});
    expect(
      mergePaintOverrides({ a: { x: 1, y: 2 }, b: { z: 3 } }, { a: { y: 20 }, c: { w: 4 } }),
    ).toEqual({ a: { x: 1, y: 20 }, b: { z: 3 }, c: { w: 4 } });
  });
});
