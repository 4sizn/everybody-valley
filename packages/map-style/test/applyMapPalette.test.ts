/**
 * 재색칠·구성 규칙 — openfreemap positron/dark 의 축소 픽스처(`fixtures/*.layers.json`,
 * 레이어 id·type·source-layer·paint·라벨 text-field 만)로 고정한다.
 *
 * 고정하는 것: 치환 개수와 규칙별 대상, 미매칭 레이어 무변경, 계곡 조정 값,
 * 라벨 폴백 교체(이름을 읽지 않는 방패는 제외), 원본 불변, 모드별 장식 유무.
 */
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import {
  applyMapPalette,
  PALETTE_RULE_NAMES,
  type PaletteRuleName,
  paintMapPalette,
} from '../src/applyMapPalette';
import {
  BUILDINGS_LAYER_ID,
  decorateNightStyle,
  LIGHT_BUILDINGS_LAYER_ID,
  LOCALIZED_TEXT_FIELD,
  localizeLabels,
  readsNameProperty,
} from '../src/baseStyle';
import { composeMapStyle } from '../src/composeMapStyle';
import {
  CROWD_STATUS_COLORS,
  DARK_MAP_PALETTE,
  FACILITY_COLORS,
  LIGHT_MAP_PALETTE,
  MAP_PALETTES,
  VALLEY_PARK_OPACITY,
  VALLEY_WATERWAY_WIDTH,
} from '../src/palette';
import darkFixture from './fixtures/dark.layers.json';
import positronFixture from './fixtures/positron.layers.json';

const positron = positronFixture as unknown as StyleSpecification;
const dark = darkFixture as unknown as StyleSpecification;

function layerById(style: StyleSpecification, id: string) {
  const layer = style.layers.find((candidate) => candidate.id === id);
  if (layer === undefined) throw new Error(`fixture 에 ${id} 가 없다`);
  return layer as { paint?: Record<string, unknown>; layout?: Record<string, unknown> };
}

function byRule(report: ReturnType<typeof paintMapPalette>) {
  const grouped = new Map<PaletteRuleName, string[]>();
  for (const { layerId, rule } of report.matched) {
    grouped.set(rule, [...(grouped.get(rule) ?? []), layerId]);
  }
  return grouped;
}

describe('paintMapPalette — positron(라이트)', () => {
  const report = paintMapPalette(positron, 'light');
  const rules = byRule(report);
  const p = LIGHT_MAP_PALETTE;

  it('55 개 중 46 개를 치환하고 9 개는 그대로 둔다', () => {
    expect(positron.layers).toHaveLength(55);
    expect(report.matched).toHaveLength(46);
    expect(report.unmatched).toEqual([
      'landcover_ice_shelf',
      'landcover_glacier',
      'aeroway-taxiway',
      'aeroway-runway-casing',
      'aeroway-area',
      'aeroway-runway',
      'boundary_3',
      'boundary_2',
      'boundary_disputed',
    ]);
  });

  it('규칙별 대상 레이어가 표와 같다', () => {
    expect(rules.get('background')).toEqual(['background']);
    expect(rules.get('water')).toEqual(['water']);
    expect(rules.get('waterway')).toEqual(['waterway']);
    expect(rules.get('park')).toEqual(['park']);
    expect(rules.get('landcover-wood')).toEqual(['landcover_wood']);
    expect(rules.get('landuse-residential')).toEqual(['landuse_residential']);
    expect(rules.get('building')).toEqual(['building']);
    expect(rules.get('road-casing')).toEqual([
      'tunnel_motorway_casing',
      'highway_major_casing',
      'highway_motorway_casing',
      'highway_motorway_bridge_casing',
    ]);
    expect(rules.get('road-motorway')).toEqual([
      'tunnel_motorway_inner',
      'highway_motorway_inner',
      'highway_motorway_subtle',
      'highway_motorway_bridge_inner',
    ]);
    expect(rules.get('road-primary')).toEqual(['highway_major_inner', 'highway_major_subtle']);
    expect(rules.get('road-minor')).toEqual(['highway_path', 'highway_minor']);
    expect(rules.get('railway')).toEqual(['railway_transit', 'railway_service', 'railway']);
    expect(rules.get('railway-dash')).toEqual([
      'railway_transit_dashline',
      'railway_service_dashline',
      'railway_dashline',
    ]);
    expect(rules.get('pier')).toEqual(['road_area_pier', 'road_pier']);
    expect(rules.get('label-place')).toHaveLength(9);
    // 도로 번호 방패도 transportation_name 이라 POI 색을 받는다(text-field 는 바꾸지 않는다).
    expect(rules.get('label-poi')).toEqual([
      'highway-name-path',
      'highway-name-minor',
      'highway-name-major',
      'highway-shield-non-us',
      'highway-shield-us-interstate',
      'road_shield_us',
      'airport',
    ]);
    expect(rules.get('label-water')).toEqual([
      'waterway_line_label',
      'water_name_point_label',
      'water_name_line_label',
    ]);
    expect(rules.get('label-other')).toBeUndefined();
  });

  it('paint 가 팔레트 값으로 바뀐다', () => {
    const out = report.style;
    expect(layerById(out, 'background').paint?.['background-color']).toBe(p.background);
    expect(layerById(out, 'water').paint?.['fill-color']).toBe(p.water);
    expect(layerById(out, 'building').paint?.['fill-color']).toBe(p.building);
    expect(layerById(out, 'highway_major_casing').paint?.['line-color']).toBe(p.roadCasing);
    expect(layerById(out, 'highway_minor').paint?.['line-color']).toBe(p.roadMinor);
    expect(layerById(out, 'highway_major_inner').paint?.['line-color']).toBe(p.roadPrimary);
    expect(layerById(out, 'highway_motorway_inner').paint?.['line-color']).toBe(p.roadMotorway);
    expect(layerById(out, 'railway').paint?.['line-color']).toBe(p.railway);
    expect(layerById(out, 'railway_dashline').paint?.['line-color']).toBe(p.background);
    expect(layerById(out, 'landuse_residential').paint?.['fill-color']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      9,
      p.landuseResidential[0],
      12,
      p.landuseResidential[1],
    ]);
    expect(layerById(out, 'label_city').paint).toMatchObject({
      'text-color': p.labelText,
      'text-halo-color': p.labelHalo,
    });
    expect(layerById(out, 'highway-name-major').paint).toMatchObject({
      'text-color': p.poiText,
      'text-halo-color': p.labelHalo,
    });
  });

  it('물 이름 라벨은 후광만 바꾸고 글자색은 원본을 지킨다', () => {
    const before = layerById(positron, 'water_name_point_label').paint;
    const after = layerById(report.style, 'water_name_point_label').paint;
    expect(after?.['text-color']).toBe(before?.['text-color']);
    expect(after?.['text-halo-color']).toBe(p.labelHalo);
  });

  it('치환하지 않는 paint 속성은 그대로 남는다 (건물 외곽선·도로 폭·점선)', () => {
    const before = layerById(positron, 'building').paint;
    const after = layerById(report.style, 'building').paint;
    expect(after?.['fill-outline-color']).toBe(before?.['fill-outline-color']);
    expect(layerById(report.style, 'highway_major_casing').paint?.['line-width']).toEqual(
      layerById(positron, 'highway_major_casing').paint?.['line-width'],
    );
    expect(layerById(report.style, 'railway_dashline').paint?.['line-dasharray']).toEqual([3, 3]);
  });

  it('계곡 조정 — 공원 불투명도는 줌이 오를수록 커지고, 물줄기는 넓어진다', () => {
    const park = layerById(report.style, 'park').paint;
    expect(park?.['fill-color']).toBe(p.park);
    expect(park?.['fill-opacity']).toBe(VALLEY_PARK_OPACITY);
    // z9 0.2 → z12 0.4 → z14 0.55: 원본(0.5 → 0.2)의 반전, 상한은 V1 (b) 로 0.75 → 0.55.
    expect(VALLEY_PARK_OPACITY.slice(3)).toEqual([9, 0.2, 12, 0.4, 14, 0.55]);
    expect(p.park).toBe('#cfe0c0');

    const waterway = layerById(report.style, 'waterway').paint;
    expect(waterway?.['line-color']).toBe(p.water);
    expect(waterway?.['line-width']).toBe(VALLEY_WATERWAY_WIDTH);
    expect(layerById(positron, 'waterway').paint?.['line-width']).toBeUndefined();

    // 숲은 팔레트에 값이 없어 공원 색을 쓰고, V1 (b) 부터 불투명도 곡선도 공원과 같다.
    const wood = layerById(report.style, 'landcover_wood').paint;
    expect(wood?.['fill-color']).toBe(p.park);
    expect(wood?.['fill-opacity']).toBe(VALLEY_PARK_OPACITY);
    expect(layerById(positron, 'landcover_wood').paint?.['fill-opacity']).not.toEqual(
      VALLEY_PARK_OPACITY,
    );
  });

  it('미매칭 레이어는 참조까지 같다 (무변경)', () => {
    for (const id of report.unmatched) {
      expect(layerById(report.style, id)).toBe(layerById(positron, id));
    }
  });

  it('원본은 변형되지 않고 레이어 순서도 유지된다', () => {
    expect(layerById(positron, 'background').paint?.['background-color']).toBe('rgb(242,243,240)');
    expect(report.style.layers.map((layer) => layer.id)).toEqual(
      positron.layers.map((layer) => layer.id),
    );
    expect(applyMapPalette(positron, 'light')).toEqual(report.style);
  });
});

describe('paintMapPalette — dark 도 같은 규칙으로 맞는다', () => {
  const report = paintMapPalette(dark, 'dark');
  const rules = byRule(report);

  it('47 개 중 36 개를 치환한다 (id 가 달라도 type·source-layer 패턴으로 잡힌다)', () => {
    expect(report.matched).toHaveLength(36);
    expect(report.unmatched).toEqual([
      'landcover_ice_shelf',
      'landcover_glacier',
      'aeroway-taxiway',
      'aeroway-runway-casing',
      'aeroway-area',
      'aeroway-runway',
      'road_oneway',
      'road_oneway_opposite',
      'boundary_state',
      'boundary_country_z0-4',
      'boundary_country_z5-',
    ]);
    expect(rules.get('park')).toEqual(['landuse_park']);
    expect(rules.get('label-place')).toHaveLength(10);
    expect(rules.get('label-poi')).toEqual(['highway_name_other', 'highway_name_motorway']);
    expect(rules.get('label-water')).toEqual(['water_name']);
    expect(rules.get('railway')).toEqual(['railway_transit', 'railway_minor', 'railway']);
    expect(layerById(report.style, 'background').paint?.['background-color']).toBe(
      DARK_MAP_PALETTE.background,
    );
  });
});

describe('localizeLabels — 라벨 폴백 통일', () => {
  it('이름을 읽는 심볼만 name:ko → name:nonlatin → name → name:latin 으로 바꾼다', () => {
    expect(LOCALIZED_TEXT_FIELD).toEqual([
      'coalesce',
      ['get', 'name:ko'],
      ['get', 'name:nonlatin'],
      ['get', 'name'],
      ['get', 'name:latin'],
    ]);
    const out = localizeLabels(positron);
    const named = out.layers.filter(
      (layer) => layer.type === 'symbol' && layer.layout?.['text-field'] === LOCALIZED_TEXT_FIELD,
    );
    // 55 개 중 심볼 19: 이름 라벨 16 + 방패 3.
    expect(named).toHaveLength(16);
    for (const id of ['highway-shield-non-us', 'highway-shield-us-interstate', 'road_shield_us']) {
      expect(layerById(out, id).layout?.['text-field']).toEqual(['to-string', ['get', 'ref']]);
    }
    // 원본 불변.
    expect(layerById(positron, 'label_city').layout?.['text-field']).not.toEqual(
      LOCALIZED_TEXT_FIELD,
    );
  });

  it('readsNameProperty 는 표현식과 문자열 템플릿을 모두 본다', () => {
    expect(readsNameProperty(['get', 'name'])).toBe(true);
    expect(readsNameProperty(['coalesce', ['get', 'name_en'], ['get', 'name']])).toBe(true);
    expect(readsNameProperty('{name:latin}')).toBe(true);
    expect(readsNameProperty(['to-string', ['get', 'ref']])).toBe(false);
    expect(readsNameProperty(['get', 'ele'])).toBe(false);
    expect(readsNameProperty(undefined)).toBe(false);
  });
});

describe('composeMapStyle — 팔레트 → 라벨 → 장식', () => {
  it('라이트: 재색칠 + 라벨 + 라이트 3D 건물, 하늘 없음', () => {
    const composed = composeMapStyle(positron, 'light');
    expect(composed.mode).toBe('light');
    expect(composed.recolored).toBe(46);
    expect(composed.unmatched).toHaveLength(9);
    expect(composed.style.sky).toBeUndefined();
    const ids = composed.style.layers.map((layer) => layer.id);
    expect(ids).not.toContain(BUILDINGS_LAYER_ID);
    // /firework 의 3D 건물은 라이트에서도 유지 — 색만 라이트용, 위치는 첫 심볼 앞.
    expect(ids.indexOf(LIGHT_BUILDINGS_LAYER_ID)).toBe(ids.indexOf('waterway_line_label') - 1);
    expect(ids).toHaveLength(positron.layers.length + 1);
    const buildings = layerById(composed.style, LIGHT_BUILDINGS_LAYER_ID);
    expect(buildings.paint?.['fill-extrusion-height']).toEqual(
      layerById(decorateNightStyle(dark), BUILDINGS_LAYER_ID).paint?.['fill-extrusion-height'],
    );
    expect(layerById(composed.style, 'background').paint?.['background-color']).toBe(
      LIGHT_MAP_PALETTE.background,
    );
    expect(layerById(composed.style, 'label_city').layout?.['text-field']).toBe(
      LOCALIZED_TEXT_FIELD,
    );
  });

  it('다크: 재색칠 없이 라벨 + 밤하늘 + 3D 건물 — decorateNightStyle 과 같다', () => {
    const composed = composeMapStyle(dark, 'dark');
    expect(composed.recolored).toBe(0);
    expect(composed.unmatched).toEqual([]);
    expect(composed.style).toEqual(decorateNightStyle(dark));
    expect(composed.style.sky).toBeDefined();
    expect(layerById(composed.style, 'background').paint?.['background-color']).toBe(
      'rgb(12,12,12)',
    );
    // 건물은 첫 심볼(water_name) 바로 앞.
    const ids = composed.style.layers.map((layer) => layer.id);
    expect(ids.indexOf(BUILDINGS_LAYER_ID)).toBe(ids.indexOf('water_name') - 1);
    expect(ids).toHaveLength(dark.layers.length + 1);
    // 도로 번호 방패는 그대로.
    expect(layerById(composed.style, 'highway_name_motorway').layout?.['text-field']).toEqual([
      'to-string',
      ['get', 'ref'],
    ]);
  });
});

describe('팔레트 값', () => {
  it('두 모드가 같은 키를 갖고 값은 hex 이며, 규칙 이름은 중복이 없다', () => {
    expect(Object.keys(MAP_PALETTES.light).sort()).toEqual(Object.keys(MAP_PALETTES.dark).sort());
    for (const palette of Object.values(MAP_PALETTES)) {
      for (const [key, value] of Object.entries(palette)) {
        if (key === 'landuseResidential') continue;
        expect(value).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
    expect(new Set(PALETTE_RULE_NAMES).size).toBe(PALETTE_RULE_NAMES.length);
  });

  it('마커 팔레트 키는 C3 정규화(store·busy)를 따른다', () => {
    expect(Object.keys(FACILITY_COLORS)).toContain('store');
    expect(Object.keys(FACILITY_COLORS)).not.toContain('convenience');
    expect(Object.keys(CROWD_STATUS_COLORS)).toEqual(['available', 'low', 'busy']);
  });
});
