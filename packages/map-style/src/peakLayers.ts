/**
 * 봉우리 라벨 명세 — openmaptiles `mountain_peak` 심볼 "▲ 이름 표고m" (C10c, 결정 (f)).
 *
 * positron·dark 는 이 소스 레이어를 쓰지 않는다. 계곡 화면에서는 골짜기 양쪽 능선의
 * 이름·높이가 지형을 읽는 단서라 심볼 하나를 얹는다. 줌 11 부터, 표고 높은 봉우리가
 * 먼저 자리를 잡는다(`symbol-sort-key` 오름차순 → 음의 표고).
 *
 * 색은 `applyMapPalette` 의 `label-poi` 규칙과 같은 값(`poiText` / `labelHalo`)을 모드별로
 * 직접 넣는다 — 이 레이어는 재색칠 **뒤**에 끼워지므로 규칙을 타지 않고, 다크는 재색칠을
 * 하지 않지만 다크 팔레트의 같은 키를 쓴다.
 *
 * web(3D 지형)에서는 `symbol-height-offset` 으로 라벨을 지면에서 띄운다 — 지형에 박힌
 * 라벨은 앞 능선에 가려진다. maplibre-gl 6.6 의 속성이고 네이티브 스타일 파서는 모르므로
 * `heightOffset` 이 참일 때만 넣는다(`composeMapStyle` 의 `terrain3d`).
 */
import type {
  ExpressionSpecification,
  SymbolLayerSpecification,
} from '@maplibre/maplibre-gl-style-spec';
import type { MapContent, Peak } from '@modu-valley/core';
import type { FeatureCollection, Point } from 'geojson';
import { OPENMAPTILES_SOURCE } from './baseStyle';
import { EMPTY_GEOJSON_SOURCE } from './featureProperties';
import type { FeatureLayerSet } from './layerSets';
import { MAP_PALETTES, type MapStyleMode } from './palette';

export const PEAK_LABEL_LAYER_ID = 'terrain-peak-label';
export const PEAK_MIN_ZOOM = 11;
/** 3D 지형 위에서 라벨을 띄우는 높이(m, 지면 기준). 능선 앞뒤 가림을 피하는 최소치. */
export const PEAK_HEIGHT_OFFSET_M = 40;

/** "▲ 이름 표고m". 이름은 한국어 폴백(`LOCALIZED_TEXT_FIELD` 와 같은 순서), 표고가 없으면 이름만. */
export const PEAK_TEXT_FIELD: ExpressionSpecification = [
  'concat',
  '▲ ',
  [
    'coalesce',
    ['get', 'name:ko'],
    ['get', 'name:nonlatin'],
    ['get', 'name'],
    ['get', 'name:latin'],
  ],
  ['case', ['has', 'ele'], ['concat', ' ', ['to-string', ['get', 'ele']], 'm'], ''],
];

export type PeakLabelOptions = {
  /** `symbol-height-offset` 을 넣는가 — web 3D 지형에서만. */
  readonly heightOffset: boolean;
};

export function peakLabelLayer(
  mode: MapStyleMode,
  options: PeakLabelOptions,
): SymbolLayerSpecification {
  const palette = MAP_PALETTES[mode];
  const layout: SymbolLayerSpecification['layout'] = {
    'text-field': PEAK_TEXT_FIELD,
    'text-font': ['Noto Sans Regular'],
    'text-size': 12,
    'text-anchor': 'bottom',
    'text-offset': [0, -0.4],
    'text-max-width': 12,
    // 표고 높은 순 — 작을수록 먼저 배치되므로 음의 표고.
    'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'ele'], 0]],
  };
  if (options.heightOffset) {
    // maplibre-gl 6.6 전용 속성 — 명세 타입(26.2.1)에 아직 없어 경계에서 한 번 넓힌다.
    Object.assign(layout, {
      'symbol-height-offset': PEAK_HEIGHT_OFFSET_M,
      'symbol-height-anchor': 'ground',
    });
  }
  return {
    id: PEAK_LABEL_LAYER_ID,
    type: 'symbol',
    source: OPENMAPTILES_SOURCE,
    'source-layer': 'mountain_peak',
    minzoom: PEAK_MIN_ZOOM,
    filter: ['==', ['geometry-type'], 'Point'],
    layout,
    paint: {
      'text-color': palette.poiText,
      'text-halo-color': palette.labelHalo,
      'text-halo-width': 1.4,
    },
  };
}

// ── 자체 봉우리 소스 (2026-09-23) ─────────────────────────────────────

/**
 * 계곡 주변 봉우리 — **GeoJSON 소스** 라벨. 위 타일 라벨은 3D 지형 + 타일 최대 줌(14) 초과에서
 * MapLibre 가 그리지 않아(단독 재현 z13.9 → 2개, z14.1 → 0개) 계곡 화면 기본 줌 14.2·15.5 에서
 * 늘 비었다. GeoJSON 소스는 오버줌이 18 부터라 그 문제가 없다. 데이터는 `MapContent.peaks`
 * (OSM `natural=peak`, `scripts/seed/peaks.mts`). 줌 10 부터, 표고 높은 순으로 자리를 잡고,
 * 타일 라벨과 같은 자리(z11~13.9)에서는 충돌 규칙이 하나만 남긴다. 색은 명당 라벨과 같은
 * 흰 글자 + 어두운 테 — 지형 위 어느 모드에서나 읽힌다.
 */
export const PEAK_SOURCE_ID = 'peaks';
export const VALLEY_PEAK_LABEL_LAYER_ID = 'valley-peak-label';
export const VALLEY_PEAK_MIN_ZOOM = 10;

export type PeakFeatureProperties = {
  readonly valleyId: string;
  readonly name: string;
  readonly ele: number | null;
};

export const VALLEY_PEAK_LABEL_LAYER: SymbolLayerSpecification = {
  id: VALLEY_PEAK_LABEL_LAYER_ID,
  type: 'symbol',
  source: PEAK_SOURCE_ID,
  minzoom: VALLEY_PEAK_MIN_ZOOM,
  layout: {
    'text-field': [
      'concat',
      '▲ ',
      ['get', 'name'],
      ['case', ['has', 'ele'], ['concat', ' ', ['to-string', ['get', 'ele']], 'm'], ''],
    ],
    'text-font': ['Noto Sans Bold'],
    'text-size': 12,
    'text-anchor': 'bottom',
    'text-offset': [0, -0.4],
    'text-max-width': 12,
    'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'ele'], 0]],
  },
  paint: {
    'text-color': '#ffffff',
    'text-halo-color': 'rgba(0,0,0,.8)',
    'text-halo-width': 1.5,
  },
};

export function toPeakFeatureCollection(
  peaks: readonly Peak[],
): FeatureCollection<Point, PeakFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: peaks.map((peak) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [peak.position.lng, peak.position.lat] },
      properties: {
        valleyId: peak.valleyId,
        name: peak.name,
        ele: peak.elevationM ?? null,
      },
    })),
  };
}

/** 봉우리 레이어 셋 — 비인터랙티브(눌러도 선택이 아니다). 소스는 `content.peaks` 참조에만 의존한다. */
export const PEAK_LAYER_SET: FeatureLayerSet = {
  kind: 'peak',
  sourceId: PEAK_SOURCE_ID,
  emptySource: EMPTY_GEOJSON_SOURCE,
  layers: [VALLEY_PEAK_LABEL_LAYER],
  interactiveLayerIds: [],
  readFeatureId: () => undefined,
  dependencies: (content: MapContent) => [content.peaks],
  toFeatureCollection: (content) => toPeakFeatureCollection(content.peaks),
};
