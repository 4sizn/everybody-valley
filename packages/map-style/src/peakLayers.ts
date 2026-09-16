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
import { OPENMAPTILES_SOURCE } from './baseStyle';
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
