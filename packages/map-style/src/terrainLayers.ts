/**
 * 지형 소스·음영기복·고도별 색 명세 (C10a).
 *
 * 계곡에서 3D 건물에 대응하는 것은 **지형**이다. DEM(`raster-dem`) 소스 하나에
 * 레이어 둘을 얹는다 — `color-relief`(고도별 색, 아래) → `hillshade`(음영기복, 위).
 * 둘 다 web(maplibre-gl 6.6) 과 네이티브(maplibre-native, RN 11.3.8) 가 스타일 JSON
 * 에서 그대로 읽으므로 이 파일이 두 플랫폼의 유일한 값이다. 이 단계가 모바일 3D
 * 느낌의 상한이고, web 의 3D 지형(`setTerrain`)은 C10b 에서 같은 소스를 쓴다.
 *
 * **계곡 장면에만** 얹는다. `composeMapStyle(style, mode, { terrain: true })` 가 소스와
 * 레이어를 스타일에 넣고, festival(`/firework`)은 소스도 추가하지 않는다(CLAUDE.md 보존).
 *
 * 배치는 `'below-waterway'` — 숲(`landcover_wood`) 위·물줄기 아래(결정 (a)). 스파이크에서
 * 확인한 유일하게 녹지 톤이 사는 자리다: 숲 아래는 회백색 지형도가 되고, 라벨 아래
 * 맨 위는 도로가 탁해진다.
 *
 * 네이티브 주의 — 색은 **표현식 없이 리터럴**로 둔다. maplibre-native iOS 6.24+ 는
 * `hillshade-shadow-color`·`highlight-color` 에 표현식을 거부하고(#4296) 런타임 setter 에
 * 스칼라를 넣으면 크래시한다(#4453). 스타일 JSON 에 리터럴로 실어 두면 두 경로를 모두
 * 피한다(RN `<Layer>` 로 얹지 않는 이유이기도 하다). iOS 시뮬레이터 확인은 PR 게이트.
 *
 * 값의 출처: docs/TODO.md C10 결정 확정(2026-09-04) (b)(c)(g)(h)(i).
 */
import type {
  ColorReliefLayerSpecification,
  HillshadeLayerSpecification,
  LayerSpecification,
  RasterDEMSourceSpecification,
} from '@maplibre/maplibre-gl-style-spec';
import type { MapStyleMode } from './palette';
import type { LayerPlacement } from './placement';

export const TERRAIN_DEM_SOURCE_ID = 'terrain-dem';

/**
 * AWS Open Data Terrarium 타일 — 무키·무료·CORS 허용, SRTM 30m 급. openfreemap 에는
 * 지형 타일이 없다. GLO-30(Mapterhorn) 교체는 D4 갱신으로 분리(docs/TODO.md).
 */
export const TERRAIN_DEM_SOURCE: RasterDEMSourceSpecification = {
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 15,
  attribution: 'Terrain: Mapzen/AWS Open Data',
};

/**
 * web 3D 지형(`map.setTerrain`)의 배율 — C10 결정 (d). 1.0 은 스파이크에서 납작했고 2.0 은
 * 절벽이 과장돼 도로가 떠 보였다. 네이티브는 3D 지형이 없어 이 값을 읽지 않는다
 * (`MapCapabilities.terrain: false`). 지형 고도 보정(`setCenterElevation`)은 원시 m 를
 * 쓰므로 이 배율과 무관하다.
 */
export const TERRAIN_EXAGGERATION = 1.5;

export const HILLSHADE_LAYER_ID = 'terrain-hillshade';
export const COLOR_RELIEF_LAYER_ID = 'terrain-color-relief';

/** 지형 레이어가 끼워지는 자리. 숲 위·물줄기 아래. */
export const TERRAIN_PLACEMENT: LayerPlacement = 'below-waterway';

export type HillshadePaint = {
  readonly exaggeration: number;
  readonly shadow: string;
  readonly highlight: string;
  readonly accent: string;
};

/**
 * 모드별 음영 값.
 *   light  결정 (b)(c) — 강도 0.5, 따뜻한 갈색 그림자·흰 하이라이트. 라이트 팔레트의
 *          옅은 녹지 위에 산등성이가 갈색으로 서고, F4 그늘 폴리곤(남청)과 계열이 갈린다.
 *   dark   결정 (g) — 강도 0.35, 검정 그림자·회색 하이라이트. 다크 계곡 화면은 계약 밖
 *          이지만 지형이 읽히게는 둔다. `/firework` 다크는 이 값을 받지 않는다(festival).
 */
export const HILLSHADE_PAINT: Readonly<Record<MapStyleMode, HillshadePaint>> = {
  light: { exaggeration: 0.5, shadow: '#5a4a3a', highlight: '#ffffff', accent: '#6b6b5a' },
  dark: { exaggeration: 0.35, shadow: '#000000', highlight: '#5a6068', accent: '#000000' },
};

/** 결정 (c): 북서(335°)에서 비추는 빛, 화면 기준(viewport) 고정. 결정 (h): standard. */
export const HILLSHADE_ILLUMINATION_DIRECTION = 335;
export const HILLSHADE_METHOD = 'standard';

export function hillshadeLayer(mode: MapStyleMode): HillshadeLayerSpecification {
  const paint = HILLSHADE_PAINT[mode];
  return {
    id: HILLSHADE_LAYER_ID,
    type: 'hillshade',
    source: TERRAIN_DEM_SOURCE_ID,
    paint: {
      'hillshade-exaggeration': paint.exaggeration,
      'hillshade-shadow-color': paint.shadow,
      'hillshade-highlight-color': paint.highlight,
      'hillshade-accent-color': paint.accent,
      'hillshade-illumination-direction': HILLSHADE_ILLUMINATION_DIRECTION,
      'hillshade-illumination-anchor': 'viewport',
      'hillshade-method': HILLSHADE_METHOD,
    },
  };
}

/**
 * 결정 (i) I2 "진하게" — 계곡 바닥(50m 연녹)에서 능선(1100m 갈색)으로. 라이트 지도 전용:
 * 옅은 녹색 계열 팔레트라 다크 지도 위에서는 회색 지형을 뿌옇게 덮기만 한다(다크는
 * 음영만). 값은 스파이크 `?relief=1&reliefx=strong` 화면으로 확정했다.
 */
export const COLOR_RELIEF_STOPS: readonly (readonly [elevationM: number, color: string])[] = [
  [50, '#e9f2dc'],
  [200, '#d4e4b8'],
  [400, '#bfd39b'],
  [600, '#c8b98a'],
  [800, '#b89a72'],
  [1100, '#a88062'],
];
export const COLOR_RELIEF_OPACITY = 0.85;

export const COLOR_RELIEF_LAYER: ColorReliefLayerSpecification = {
  id: COLOR_RELIEF_LAYER_ID,
  type: 'color-relief',
  source: TERRAIN_DEM_SOURCE_ID,
  paint: {
    'color-relief-color': ['interpolate', ['linear'], ['elevation'], ...COLOR_RELIEF_STOPS.flat()],
    'color-relief-opacity': COLOR_RELIEF_OPACITY,
  },
};

/** 모드별 지형 레이어, 그리는 순서대로(고도색 아래 → 음영 위). 다크는 음영만. */
export function terrainLayers(mode: MapStyleMode): readonly LayerSpecification[] {
  return mode === 'light' ? [COLOR_RELIEF_LAYER, hillshadeLayer(mode)] : [hillshadeLayer(mode)];
}
