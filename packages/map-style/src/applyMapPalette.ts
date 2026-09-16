/**
 * 재색칠 — openfreemap 스타일의 paint 를 `MapPalette` 값으로 치환한 **새 스타일**을
 * 만든다. 원본은 변형하지 않는다(`decorateNightStyle` 과 같은 규약).
 *
 * 베이스맵은 D4 결정대로 openfreemap 을 그대로 쓰고(자체 타일은 v2), 색만
 * 클라이언트에서 덧씌운다. positron(라이트)과 dark 는 Positron/Dark Matter 계열이라
 * 레이어 골격이 같고 id 만 일부 다르다(`label_*` vs `place_*`, `park` vs
 * `landuse_park`). 그래서 레이어를 **id 가 아니라 type · source-layer · id 패턴**으로
 * 고른다 — 어느 쪽 스타일을 넣어도 같은 규칙이 맞는다.
 *
 * 매칭 규칙 (위에서부터, 첫 규칙만 적용)
 *
 * | 규칙               | 조건 (type · source-layer · id)                      | 치환                                   |
 * | ------------------ | ---------------------------------------------------- | -------------------------------------- |
 * | background         | background                                           | background-color ← background          |
 * | water              | fill · water                                         | fill-color ← water                     |
 * | waterway           | line · waterway                                      | line-color ← water, line-width ← 계곡  |
 * | park               | fill · park, 또는 fill · landuse · /park/            | fill-color ← park, fill-opacity ← 계곡 |
 * | landcover-wood     | fill · landcover · /wood|forest|grass/               | fill-color ← park, fill-opacity ← 계곡 |
 * | landuse-residential| fill · landuse · /residential/                       | fill-color ← residential z9→z12 보간   |
 * | building           | fill · building                                      | fill-color ← building                  |
 * | railway-dash       | line · transportation · /^railway.*dash/             | line-color ← background                |
 * | railway            | line · transportation · /^railway/                   | line-color ← railway                   |
 * | pier               | fill|line · transportation · /pier/                  | fill-/line-color ← background          |
 * | road-casing        | line · transportation · /casing/                     | line-color ← roadCasing                |
 * | road-motorway      | line · transportation · /motorway/                   | line-color ← roadMotorway              |
 * | road-primary       | line · transportation · /major|primary|secondary|tertiary|trunk/ | line-color ← roadPrimary   |
 * | road-minor         | line · transportation · /minor|path|track|service/   | line-color ← roadMinor                 |
 * | label-place        | symbol(text) · place                                 | text-color ← labelText, halo ← labelHalo |
 * | label-poi          | symbol(text) · poi|transportation_name|aerodrome_label|mountain_peak | text-color ← poiText, halo ← labelHalo |
 * | label-water        | symbol(text) · water_name|waterway                   | halo ← labelHalo (물 이름 색은 원본 유지 — 팔레트에 물 라벨 값이 없다) |
 * | label-other        | 그 밖의 symbol(text)                                 | halo ← labelHalo                       |
 *
 * 어느 규칙에도 걸리지 않는 레이어는 **그대로 둔다**(빙하·활주로·행정경계·일방통행
 * 아이콘 등). 어느 것이 남았는지는 `paintMapPalette` 의 `unmatched` 로 돌려주고,
 * 어댑터가 로그로 남긴다 — 스타일이 업데이트돼 레이어가 늘면 거기서 드러난다.
 *
 * 규칙 이름이 `landcover-wood` 처럼 팔레트에 없는 값을 `park` 로 대신하는 곳은
 * 의도된 것이다. 산지가 주 무대인데 valley-ds 팔레트는 도심용이라 숲 색이 없다.
 */
import type { LayerSpecification, StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import {
  MAP_PALETTES,
  type MapPalette,
  type MapStyleMode,
  VALLEY_PARK_OPACITY,
  VALLEY_WATERWAY_WIDTH,
} from './palette';

export type PaletteRuleName =
  | 'background'
  | 'water'
  | 'waterway'
  | 'park'
  | 'landcover-wood'
  | 'landuse-residential'
  | 'building'
  | 'railway-dash'
  | 'railway'
  | 'pier'
  | 'road-casing'
  | 'road-motorway'
  | 'road-primary'
  | 'road-minor'
  | 'label-place'
  | 'label-poi'
  | 'label-water'
  | 'label-other';

export type PaletteMatch = {
  readonly layerId: string;
  readonly rule: PaletteRuleName;
};

export type MapPaletteReport = {
  readonly style: StyleSpecification;
  /** 규칙이 적용된 레이어. 스타일 순서대로. */
  readonly matched: readonly PaletteMatch[];
  /** 어느 규칙에도 걸리지 않아 원본 그대로 남은 레이어 id. */
  readonly unmatched: readonly string[];
};

type Rule = {
  readonly name: PaletteRuleName;
  readonly matches: (layer: LayerSpecification) => boolean;
  readonly apply: (layer: LayerSpecification, palette: MapPalette) => LayerSpecification;
};

/** `source-layer` 는 background 레이어에 없다. 없으면 빈 문자열로 본다. */
function sourceLayerOf(layer: LayerSpecification): string {
  return 'source-layer' in layer && typeof layer['source-layer'] === 'string'
    ? layer['source-layer']
    : '';
}

function hasText(layer: LayerSpecification): boolean {
  return layer.type === 'symbol' && layer.layout?.['text-field'] !== undefined;
}

/** paint 몇 개를 덧쓴 사본. 타입은 레이어 종류별 paint 유니온이라 좁혀 쓴다. */
function withPaint(
  layer: LayerSpecification,
  paint: Readonly<Record<string, unknown>>,
): LayerSpecification {
  const current = 'paint' in layer && layer.paint !== undefined ? layer.paint : {};
  return { ...layer, paint: { ...current, ...paint } } as LayerSpecification;
}

function is(type: LayerSpecification['type'], sourceLayer: RegExp | string, id?: RegExp) {
  return (layer: LayerSpecification): boolean => {
    if (layer.type !== type) return false;
    const source = sourceLayerOf(layer);
    const sourceOk =
      typeof sourceLayer === 'string' ? source === sourceLayer : sourceLayer.test(source);
    if (!sourceOk) return false;
    return id === undefined ? true : id.test(layer.id);
  };
}

const RULES: readonly Rule[] = [
  {
    name: 'background',
    matches: (layer) => layer.type === 'background',
    apply: (layer, p) => withPaint(layer, { 'background-color': p.background }),
  },
  {
    name: 'water',
    matches: is('fill', 'water'),
    apply: (layer, p) => withPaint(layer, { 'fill-color': p.water }),
  },
  {
    name: 'waterway',
    matches: is('line', 'waterway'),
    apply: (layer, p) =>
      withPaint(layer, { 'line-color': p.water, 'line-width': VALLEY_WATERWAY_WIDTH }),
  },
  {
    name: 'park',
    matches: (layer) => is('fill', 'park')(layer) || is('fill', 'landuse', /park/)(layer),
    apply: (layer, p) =>
      withPaint(layer, { 'fill-color': p.park, 'fill-opacity': VALLEY_PARK_OPACITY }),
  },
  {
    name: 'landcover-wood',
    matches: is('fill', 'landcover', /wood|forest|grass/),
    // V1 (b): 숲·초지도 공원과 같은 색·같은 불투명도 곡선 — 산지가 주 무대라 셋이 한 덩어리로 읽혀야 한다.
    apply: (layer, p) =>
      withPaint(layer, { 'fill-color': p.park, 'fill-opacity': VALLEY_PARK_OPACITY }),
  },
  {
    name: 'landuse-residential',
    matches: is('fill', 'landuse', /residential/),
    apply: (layer, p) =>
      withPaint(layer, {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['zoom'],
          9,
          p.landuseResidential[0],
          12,
          p.landuseResidential[1],
        ],
      }),
  },
  {
    name: 'building',
    matches: is('fill', 'building'),
    apply: (layer, p) => withPaint(layer, { 'fill-color': p.building }),
  },
  {
    name: 'railway-dash',
    matches: is('line', 'transportation', /^railway.*dash/),
    apply: (layer, p) => withPaint(layer, { 'line-color': p.background }),
  },
  {
    name: 'railway',
    matches: is('line', 'transportation', /^railway/),
    apply: (layer, p) => withPaint(layer, { 'line-color': p.railway }),
  },
  {
    name: 'pier',
    matches: (layer) =>
      is('fill', 'transportation', /pier/)(layer) || is('line', 'transportation', /pier/)(layer),
    apply: (layer, p) =>
      withPaint(
        layer,
        layer.type === 'fill' ? { 'fill-color': p.background } : { 'line-color': p.background },
      ),
  },
  {
    name: 'road-casing',
    matches: is('line', 'transportation', /casing/),
    apply: (layer, p) => withPaint(layer, { 'line-color': p.roadCasing }),
  },
  {
    name: 'road-motorway',
    matches: is('line', 'transportation', /motorway/),
    apply: (layer, p) => withPaint(layer, { 'line-color': p.roadMotorway }),
  },
  {
    name: 'road-primary',
    matches: is('line', 'transportation', /major|primary|secondary|tertiary|trunk/),
    apply: (layer, p) => withPaint(layer, { 'line-color': p.roadPrimary }),
  },
  {
    name: 'road-minor',
    matches: is('line', 'transportation', /minor|path|track|service/),
    apply: (layer, p) => withPaint(layer, { 'line-color': p.roadMinor }),
  },
  {
    name: 'label-place',
    matches: (layer) => hasText(layer) && sourceLayerOf(layer) === 'place',
    apply: (layer, p) =>
      withPaint(layer, { 'text-color': p.labelText, 'text-halo-color': p.labelHalo }),
  },
  {
    name: 'label-poi',
    matches: (layer) =>
      hasText(layer) &&
      /^(poi|transportation_name|aerodrome_label|mountain_peak)$/.test(sourceLayerOf(layer)),
    apply: (layer, p) =>
      withPaint(layer, { 'text-color': p.poiText, 'text-halo-color': p.labelHalo }),
  },
  {
    name: 'label-water',
    matches: (layer) => hasText(layer) && /^(water_name|waterway)$/.test(sourceLayerOf(layer)),
    apply: (layer, p) => withPaint(layer, { 'text-halo-color': p.labelHalo }),
  },
  {
    name: 'label-other',
    matches: hasText,
    apply: (layer, p) => withPaint(layer, { 'text-halo-color': p.labelHalo }),
  },
];

/** 규칙 이름 목록 — 문서 표와 테스트가 같은 순서를 본다. */
export const PALETTE_RULE_NAMES: readonly PaletteRuleName[] = RULES.map((rule) => rule.name);

/**
 * 재색칠하고 무엇이 맞았는지까지 돌려준다. 어댑터는 `unmatched` 를 로그로 남긴다.
 */
export function paintMapPalette(style: StyleSpecification, mode: MapStyleMode): MapPaletteReport {
  const palette = MAP_PALETTES[mode];
  const matched: PaletteMatch[] = [];
  const unmatched: string[] = [];

  const layers = style.layers.map((layer) => {
    const rule = RULES.find((candidate) => candidate.matches(layer));
    if (rule === undefined) {
      unmatched.push(layer.id);
      return layer;
    }
    matched.push({ layerId: layer.id, rule: rule.name });
    return rule.apply(layer, palette);
  });

  return { style: { ...style, layers }, matched, unmatched };
}

/** `paintMapPalette` 의 스타일만. */
export function applyMapPalette(style: StyleSpecification, mode: MapStyleMode): StyleSpecification {
  return paintMapPalette(style, mode).style;
}
