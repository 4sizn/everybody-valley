/**
 * 계곡 장면의 **상태 의존 paint** — 레이어 명세가 값 하나로 고정할 수 없는 것들 (V1).
 *
 * 레이어 셋(`MAP_LAYER_SETS`)은 모드와 앱 상태를 모른다. 그런데 V1 은 두 가지를 요구한다.
 *   (c) 구간 케이싱 색은 모드에 따라 — 라이트 흰색, 다크 `#0c0c0c`.
 *   (g) 그늘 보기가 켜져 있으면 음영기복을 0.2 로 낮추고 수관을 0.4 로 올려 그늘 폴리곤이
 *       지형 질감과 겹쳐 뭉개지지 않게. 끄면 (a) 의 값(모드별 음영 강도·수관 0.28)으로 복귀.
 *
 * 두 어댑터가 **이 함수 하나**를 부른다 — web 은 `setPaintProperty`, 네이티브는
 * `MapScene.layerPaintOverrides`. 어느 한쪽에만 두면 파리티가 조용히 갈라진다(C10c 흐름 점선과
 * 같은 이유). 값은 항상 **전부** 돌려준다(켜진 값과 복귀 값 모두) — 어댑터가 "무엇을 되돌릴지"를
 * 알 필요 없이 결과를 그대로 얹으면 되게.
 *
 * 그늘 상태는 포트를 넓히지 않고 `MapContent.shade` 로 읽는다 — 그늘 보기가 켜져 있고 데이터가
 * 있을 때만 값이 있다(F4). 그늘 데이터가 없는 계곡은 켜도 폴리곤이 없으니 대비를 바꿀 이유도 없다.
 *
 * 네이티브 주의 — 음영기복은 스타일 JSON 의 레이어라 `<Layer>` 로 덧쓸 수 없고, iOS 는 hillshade
 * 런타임 setter 에서 크래시한다(#4453, `terrainLayers.ts`). 네이티브 뷰는 이 결과 중 레이어 셋에
 * 있는 것(케이싱·수관)만 얹고 음영기복 항목은 남겨 둔다 — 값은 게시되지만 그려지지 않는다.
 * docs/TODO.md V1 후속 제안.
 */
import type { MapContent } from '@modu-valley/core';
import type { MapStyleMode } from './palette';
import { SEGMENT_CASING_COLORS } from './palette';
import { SEGMENT_CASING_LAYER_ID } from './segmentLayers';
import { SHADE_CANOPY_LAYER_ID, SHADE_COLORS } from './shadeLayers';
import { HILLSHADE_LAYER_ID, HILLSHADE_PAINT } from './terrainLayers';

/** 레이어 id → 덧쓸 paint 속성. 네이티브 `MapScene.layerPaintOverrides` 와 같은 모양. */
export type PaintOverrides = Readonly<Record<string, Readonly<Record<string, unknown>>>>;
export const EMPTY_PAINT_OVERRIDES: PaintOverrides = {};

/** V1 결정 (g) — 그늘 켜짐 상태의 음영 강도와 수관 불투명도. */
export const SHADE_ON_HILLSHADE_EXAGGERATION = 0.2;
export const SHADE_ON_CANOPY_OPACITY = 0.4;

export type ValleyPaintState = {
  /** 그늘 오버레이가 지도에 있는가 — `isShadeVisible(content)`. */
  readonly shadeVisible: boolean;
};

/** `MapContent` 에서 그늘 켜짐을 읽는다. 두 어댑터가 같은 판정을 쓴다. */
export function isShadeVisible(content: MapContent): boolean {
  return content.shade !== null;
}

/**
 * 모드·그늘 상태 → 덧쓸 paint. 항상 세 레이어 모두 — 되돌릴 값도 여기서 나온다.
 * 같은 입력이면 깊은 값이 같으므로 어댑터는 `shadeVisible` 이 바뀌었을 때만 부르면 된다.
 */
export function valleyPaintOverrides(mode: MapStyleMode, state: ValleyPaintState): PaintOverrides {
  return {
    [SEGMENT_CASING_LAYER_ID]: { 'line-color': SEGMENT_CASING_COLORS[mode] },
    [HILLSHADE_LAYER_ID]: {
      'hillshade-exaggeration': state.shadeVisible
        ? SHADE_ON_HILLSHADE_EXAGGERATION
        : HILLSHADE_PAINT[mode].exaggeration,
    },
    [SHADE_CANOPY_LAYER_ID]: {
      'fill-opacity': state.shadeVisible ? SHADE_ON_CANOPY_OPACITY : SHADE_COLORS.canopyOpacity,
    },
  };
}

/** 두 덧쓰기를 합친다 — 같은 레이어면 속성 단위로 뒤가 이긴다(흐름 점선 + 계곡 paint). */
export function mergePaintOverrides(...parts: readonly PaintOverrides[]): PaintOverrides {
  const merged: Record<string, Record<string, unknown>> = {};
  for (const part of parts) {
    for (const [layerId, paint] of Object.entries(part)) {
      merged[layerId] = { ...merged[layerId], ...paint };
    }
  }
  return merged;
}
