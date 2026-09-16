/**
 * 지형 구성(C10a) — DEM 소스 + 고도색·음영기복이 **계곡 장면에만**, **숲 위·물줄기 아래**에
 * 끼워지는지, 값이 결정 기록(2026-09-04 (b)(c)(g)(h)(i))과 같은지, festival 기본값에서는
 * 스타일이 바이트 단위로 같은지를 openfreemap 축소 픽스처로 고정한다.
 */
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import { composeMapStyle, withTerrain } from '../src/composeMapStyle';
import { PEAK_LABEL_LAYER_ID } from '../src/peakLayers';
import {
  findFirstSymbolLayerId,
  findFirstWaterwayLayerId,
  findPlacementLayerId,
  insertLayers,
} from '../src/placement';
import {
  COLOR_RELIEF_LAYER,
  COLOR_RELIEF_LAYER_ID,
  COLOR_RELIEF_OPACITY,
  COLOR_RELIEF_STOPS,
  HILLSHADE_LAYER_ID,
  HILLSHADE_PAINT,
  hillshadeLayer,
  TERRAIN_DEM_SOURCE,
  TERRAIN_DEM_SOURCE_ID,
  terrainLayers,
} from '../src/terrainLayers';
import darkFixture from './fixtures/dark.layers.json';
import positronFixture from './fixtures/positron.layers.json';

const positron = positronFixture as unknown as StyleSpecification;
const dark = darkFixture as unknown as StyleSpecification;

const ids = (style: StyleSpecification): string[] => style.layers.map((layer) => layer.id);

describe('placement — 배치 이름 → 기준 레이어', () => {
  it('positron·dark 모두 첫 symbol 과 waterway 선을 찾는다', () => {
    expect(findFirstSymbolLayerId(positron)).toBe('waterway_line_label');
    expect(findFirstWaterwayLayerId(positron)).toBe('waterway');
    expect(findFirstSymbolLayerId(dark)).toBe('water_name');
    expect(findFirstWaterwayLayerId(dark)).toBe('waterway');
    expect(findPlacementLayerId(positron, 'below-labels')).toBe('waterway_line_label');
    expect(findPlacementLayerId(positron, 'below-waterway')).toBe('waterway');
  });

  it('waterway 가 없으면 라벨 아래로 물러나고, 심볼도 없으면 맨 위(undefined)', () => {
    const labelsOnly = {
      layers: [
        { id: 'bg', type: 'background' },
        { id: 'lbl', type: 'symbol' },
      ],
    };
    expect(findPlacementLayerId(labelsOnly, 'below-waterway')).toBe('lbl');
    expect(
      findPlacementLayerId({ layers: [{ id: 'bg', type: 'background' }] }, 'below-labels'),
    ).toBe(undefined);
  });

  it('insertLayers 는 기준 앞에 순서대로 끼우고 원본을 바꾸지 않는다', () => {
    const before = ids(positron);
    const next = insertLayers(positron, terrainLayers('light'), 'below-waterway');
    expect(ids(positron)).toEqual(before);
    const nextIds = ids(next);
    const waterway = nextIds.indexOf('waterway');
    expect(nextIds[waterway - 2]).toBe(COLOR_RELIEF_LAYER_ID);
    expect(nextIds[waterway - 1]).toBe(HILLSHADE_LAYER_ID);
    // 숲 위
    expect(nextIds.indexOf('landcover_wood')).toBe(waterway - 3);
  });
});

describe('terrainLayers — 결정 기록 값', () => {
  it('DEM 소스는 Terrarium 인코딩·256 타일·maxzoom 15', () => {
    expect(TERRAIN_DEM_SOURCE.type).toBe('raster-dem');
    expect(TERRAIN_DEM_SOURCE.encoding).toBe('terrarium');
    expect(TERRAIN_DEM_SOURCE.tileSize).toBe(256);
    expect(TERRAIN_DEM_SOURCE.maxzoom).toBe(15);
    expect(TERRAIN_DEM_SOURCE.tiles?.[0]).toContain('elevation-tiles-prod/terrarium');
  });

  it('라이트 음영: 강도 0.5, 갈색 그림자·흰 하이라이트, 335°·viewport·standard, 색은 리터럴', () => {
    const layer = hillshadeLayer('light');
    expect(layer.source).toBe(TERRAIN_DEM_SOURCE_ID);
    expect(layer.paint).toEqual({
      'hillshade-exaggeration': 0.5,
      'hillshade-shadow-color': '#5a4a3a',
      'hillshade-highlight-color': '#ffffff',
      'hillshade-accent-color': '#6b6b5a',
      'hillshade-illumination-direction': 335,
      'hillshade-illumination-anchor': 'viewport',
      'hillshade-method': 'standard',
    });
    // 네이티브 iOS 버그(#4296·#4453) 회피 — 색에 표현식이 없어야 한다.
    for (const key of ['hillshade-shadow-color', 'hillshade-highlight-color'] as const) {
      expect(typeof HILLSHADE_PAINT.light.shadow).toBe('string');
      expect(typeof layer.paint?.[key]).toBe('string');
    }
  });

  it('다크 음영: 강도 0.35, 검정 그림자·회색 하이라이트 (결정 g)', () => {
    const layer = hillshadeLayer('dark');
    expect(layer.paint?.['hillshade-exaggeration']).toBe(0.35);
    expect(layer.paint?.['hillshade-shadow-color']).toBe('#000000');
    expect(layer.paint?.['hillshade-highlight-color']).toBe('#5a6068');
    expect(layer.paint?.['hillshade-accent-color']).toBe('#000000');
  });

  it('고도색: 50m 연녹 → 1100m 갈색 6단, opacity 0.85, 라이트만', () => {
    expect(COLOR_RELIEF_STOPS.map(([m]) => m)).toEqual([50, 200, 400, 600, 800, 1100]);
    expect(COLOR_RELIEF_STOPS.map(([, c]) => c)).toEqual([
      '#e9f2dc',
      '#d4e4b8',
      '#bfd39b',
      '#c8b98a',
      '#b89a72',
      '#a88062',
    ]);
    expect(COLOR_RELIEF_OPACITY).toBe(0.85);
    expect(COLOR_RELIEF_LAYER.paint?.['color-relief-color']).toEqual([
      'interpolate',
      ['linear'],
      ['elevation'],
      50,
      '#e9f2dc',
      200,
      '#d4e4b8',
      400,
      '#bfd39b',
      600,
      '#c8b98a',
      800,
      '#b89a72',
      1100,
      '#a88062',
    ]);
    expect(terrainLayers('light').map((layer) => layer.id)).toEqual([
      COLOR_RELIEF_LAYER_ID,
      HILLSHADE_LAYER_ID,
    ]);
    expect(terrainLayers('dark').map((layer) => layer.id)).toEqual([HILLSHADE_LAYER_ID]);
  });
});

describe('composeMapStyle — 지형 옵션', () => {
  it('기본값(festival)은 지형 옵션 이전과 같은 스타일 — 소스도 레이어도 늘지 않는다', () => {
    for (const [style, mode] of [
      [positron, 'light'],
      [dark, 'dark'],
    ] as const) {
      const plain = composeMapStyle(style, mode);
      const explicit = composeMapStyle(style, mode, { terrain: false });
      expect(plain.terrain).toBe(false);
      expect(plain.style).toEqual(explicit.style);
      expect(plain.style.sources[TERRAIN_DEM_SOURCE_ID]).toBeUndefined();
      expect(ids(plain.style)).not.toContain(HILLSHADE_LAYER_ID);
      expect(ids(plain.style)).not.toContain(COLOR_RELIEF_LAYER_ID);
    }
  });

  it('라이트 + terrain: DEM 소스 + 고도색·음영이 숲 위·waterway 아래, 재색칠 보고는 그대로', () => {
    const plain = composeMapStyle(positron, 'light');
    const composed = composeMapStyle(positron, 'light', { terrain: true });
    expect(composed.terrain).toBe(true);
    expect(composed.recolored).toBe(plain.recolored);
    expect(composed.unmatched).toEqual(plain.unmatched);
    expect(composed.style.sources[TERRAIN_DEM_SOURCE_ID]).toEqual(TERRAIN_DEM_SOURCE);

    const layerIds = ids(composed.style);
    const waterway = layerIds.indexOf('waterway');
    expect(layerIds.slice(waterway - 3, waterway + 1)).toEqual([
      'landcover_wood',
      COLOR_RELIEF_LAYER_ID,
      HILLSHADE_LAYER_ID,
      'waterway',
    ]);
    // 지형 레이어 둘과 봉우리 라벨(C10c) 외에는 같다.
    expect(
      layerIds.filter(
        (id) =>
          id !== COLOR_RELIEF_LAYER_ID && id !== HILLSHADE_LAYER_ID && id !== PEAK_LABEL_LAYER_ID,
      ),
    ).toEqual(ids(plain.style));
  });

  it('다크 + terrain: 음영만(고도색 없음), 다크 값', () => {
    const composed = composeMapStyle(dark, 'dark', { terrain: true });
    const layerIds = ids(composed.style);
    expect(layerIds).toContain(HILLSHADE_LAYER_ID);
    expect(layerIds).not.toContain(COLOR_RELIEF_LAYER_ID);
    expect(layerIds.indexOf(HILLSHADE_LAYER_ID)).toBe(layerIds.indexOf('waterway') - 1);
    const hillshade = composed.style.layers.find((layer) => layer.id === HILLSHADE_LAYER_ID);
    expect(hillshade?.type === 'hillshade' && hillshade.paint?.['hillshade-exaggeration']).toBe(
      0.35,
    );
  });

  it('withTerrain 은 원본을 변형하지 않는다', () => {
    const before = JSON.stringify(positron);
    withTerrain(positron, 'light');
    expect(JSON.stringify(positron)).toBe(before);
  });
});
