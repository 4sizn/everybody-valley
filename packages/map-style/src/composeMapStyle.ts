/**
 * 스타일 구성 — 두 어댑터가 **같은 순서**로 스타일을 만든다: 팔레트 → 라벨 → 장식 → 지형.
 *
 * 모드별로 하는 일
 *
 *   light   `applyMapPalette(positron, 'light')` 로 재색칠 → 한국어 라벨 → 라이트
 *           3D 건물(`LIGHT_BUILDINGS_LAYER`). 하늘 없음. 흰색 한 가지 3D 는 밝은
 *           배경에서 덩어리로 뭉개져(C2 첫 실험) 높이별 회색 보간으로 바꿨다.
 *           `/firework` 의 3D 건물은 테마가 바뀌어도 유지한다(CLAUDE.md).
 *   dark    재색칠 **없음** — openfreemap `dark` 원본 paint 그대로. 다크 UI 토큰이
 *           그 지도 위에서 맞춰졌고 다크 회귀 계약이 "기존과 동일"이다. 한국어 라벨 →
 *           밤하늘 + 3D 건물(데모 장식). 다크 재색칠(`DARK_MAP_PALETTE`)은 값만
 *           들여 두었고 켜는 것은 별도 결정.
 *
 * 라벨 폴백은 두 모드가 같다(`LOCALIZED_TEXT_FIELD`).
 *
 * 지형(C10a)은 **옵션**이다. `terrain: true` 면 DEM 소스와 고도색·음영기복 레이어를
 * 물줄기 아래에 끼운다(`terrainLayers.ts`). 계곡 장면만 켜고 festival(`/firework`)은
 * 기본값(꺼짐)이라 소스 하나도 늘지 않는다 — 다크 회귀 계약이 그대로 성립한다.
 * 장면 판단을 어댑터 옵션(스타일 구성 시점)에 둔 이유: 두 플랫폼이 스타일 객체를
 * 지도 생성 전에 한 번 만들고, 그 뒤에는 레이어를 명령형으로 얹지 않는다.
 */
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { paintMapPalette } from './applyMapPalette';
import { decorateDay, decorateNight, localizeLabels } from './baseStyle';
import type { MapStyleMode } from './palette';
import { peakLabelLayer } from './peakLayers';
import { insertLayers } from './placement';
import {
  TERRAIN_DEM_SOURCE,
  TERRAIN_DEM_SOURCE_ID,
  TERRAIN_PLACEMENT,
  terrainLayers,
} from './terrainLayers';

export type MapStyleOptions = {
  /**
   * 지형 소스 + 고도색·음영기복 + 봉우리 라벨을 얹는가. 계곡 장면만 `true`. 기본 `false` 는
   * festival — `/firework` 의 스타일은 이 옵션 전과 바이트 단위로 같아야 한다.
   */
  readonly terrain?: boolean;
  /**
   * 엔진이 3D 지형(`setTerrain`)을 켜는가 — 봉우리 라벨을 `symbol-height-offset` 으로 지면에서
   * 띄운다(maplibre-gl 6.6 전용 속성, 네이티브 파서는 모른다). `terrain` 이 거짓이면 무시.
   */
  readonly terrain3d?: boolean;
};

export type ComposedMapStyle = {
  readonly style: StyleSpecification;
  readonly mode: MapStyleMode;
  /** 재색칠된 레이어 수. 다크는 0. */
  readonly recolored: number;
  /** 재색칠 규칙에 걸리지 않아 원본 그대로 남은 레이어 id. 다크는 빈 배열. */
  readonly unmatched: readonly string[];
  /** 지형 소스·레이어가 들어갔는가. */
  readonly terrain: boolean;
};

export function composeMapStyle(
  style: StyleSpecification,
  mode: MapStyleMode,
  options: MapStyleOptions = {},
): ComposedMapStyle {
  const terrain = options.terrain === true;
  const terrain3d = options.terrain3d === true;
  const finish = (decorated: StyleSpecification): StyleSpecification =>
    terrain ? withTerrain(decorated, mode, { terrain3d }) : decorated;

  if (mode === 'dark') {
    return {
      style: finish(decorateNight(localizeLabels(style))),
      mode,
      recolored: 0,
      unmatched: [],
      terrain,
    };
  }
  const painted = paintMapPalette(style, 'light');
  return {
    style: finish(decorateDay(localizeLabels(painted.style))),
    mode,
    recolored: painted.matched.length,
    unmatched: painted.unmatched,
    terrain,
  };
}

export type WithTerrainOptions = {
  readonly terrain3d: boolean;
};

/**
 * DEM 소스 + 모드별 지형 레이어(고도색 → 음영)를 물줄기 아래에, 봉우리 라벨을 맨 위에 끼운
 * **새 스타일**. 원본을 변형하지 않으므로 같은 스타일로 두 번 구성해도 레이어가 두 번
 * 끼워지지 않는다.
 */
export function withTerrain(
  style: StyleSpecification,
  mode: MapStyleMode,
  options: WithTerrainOptions = { terrain3d: false },
): StyleSpecification {
  const withSource: StyleSpecification = {
    ...style,
    sources: { ...style.sources, [TERRAIN_DEM_SOURCE_ID]: TERRAIN_DEM_SOURCE },
  };
  const relief = insertLayers(withSource, terrainLayers(mode), TERRAIN_PLACEMENT);
  // 봉우리 라벨은 다른 라벨과 같은 층 — 맨 위.
  return {
    ...relief,
    layers: [...relief.layers, peakLabelLayer(mode, { heightOffset: options.terrain3d })],
  };
}
