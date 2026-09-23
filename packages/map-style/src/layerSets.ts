/**
 * 레이어 셋 레지스트리 — 두 어댑터가 **같은 목록**을 순회한다.
 *
 * 피처 종류 하나 = GeoJSON 소스 하나 + 레이어 몇 개 + 히트 대상 레이어 +
 * 속성에서 id 를 읽는 법 + `MapContent` 에서 데이터를 만드는 법. 이것을 한
 * 값으로 묶어 두면 어댑터는 종류를 몰라도 된다: 설치·갱신·히트·해제를
 * 목록 순회로 처리하고, 종류가 늘면 이 배열에 한 항목이 늘 뿐이다.
 *
 * `dependencies` 는 소스 데이터가 의존하는 값들의 참조 목록이다. 어댑터가
 * 이전 목록과 얕게 비교해 하나라도 바뀌었을 때만 `toFeatureCollection` 을
 * 다시 불러 `setData` 한다 — 선택이 바뀌었다고 명당 소스를 다시 쓰지 않고,
 * 명당이 바뀌었다고 구간 소스를 다시 쓰지 않는다.
 *
 * F4 에서 계약이 두 곳 넓어졌다.
 *   · **비인터랙티브 셋** — `interactiveLayerIds` 가 비면 히트 대상이 아니다. `kind` 는
 *     press 참조(`MapFeatureKind`)와 묶이지 않는 `'shade'` 를 가질 수 있고, 어댑터는
 *     `isInteractiveLayerSet` 으로 갈라 press 배선을 건너뛴다.
 *   · **`placement`** — 기본은 스타일 맨 위(라벨 위)다. 반투명 fill 은 라벨을 덮으면
 *     읽기가 나빠지므로 `'below-labels'`(첫 `symbol` 레이어 아래)를 고를 수 있다.
 */
import type {
  GeoJSONSourceSpecification,
  LayerSpecification,
} from '@maplibre/maplibre-gl-style-spec';
import {
  MAP_FEATURE_KINDS,
  type MapContent,
  type MapFeatureKind,
  type MapSelection,
} from '@modu-valley/core';
import type { FeatureCollection } from 'geojson';
import { FACILITY_LAYER_SET } from './facilityLayers';
import { FLOW_LAYER_SET } from './flowLayers';
import { LAND_LAYER_SET } from './landLayers';
import { PEAK_LAYER_SET } from './peakLayers';
import type { LayerPlacement } from './placement';
import { SEGMENT_LAYER_SET } from './segmentLayers';
import { SHADE_LAYER_SET } from './shadeLayers';
import { SPOT_LAYER_SET } from './spotLayers';
import { WATER_LAYER_SET } from './waterLayers';

/** 레이어 셋의 종류 — press 가 가능한 피처 종류 + 배경처럼 깔리는 그늘·물줄기 면·흐름 점선(비인터랙티브). */
export type MapLayerKind = MapFeatureKind | 'shade' | 'water' | 'flow' | 'land' | 'peak';

/**
 * 그리는 위치. 생략 = 스타일 맨 위(기존 동작). 이름별 기준 레이어는 `placement.ts` —
 * `'below-labels'` 는 첫 `symbol` 아래(라벨 아래, 도로·물 위, 3D 건물보다도 아래),
 * `'below-waterway'` 는 물줄기 선 아래(숲 위). 두 어댑터가 `findPlacementLayerId` 로 푼다.
 */
export type { LayerPlacement } from './placement';

export type FeatureLayerSet = {
  readonly kind: MapLayerKind;
  readonly sourceId: string;
  readonly emptySource: GeoJSONSourceSpecification;
  /** 그리는 순서대로. 아래 레이어가 먼저 온다. */
  readonly layers: readonly LayerSpecification[];
  /** 클릭·터치 히트에 포함되는 레이어 id. `layers` 의 부분집합. 비면 히트 대상이 아니다. */
  readonly interactiveLayerIds: readonly string[];
  /** 히트된 피처의 `properties` 에서 도메인 id 를 읽는다. 비인터랙티브 셋은 항상 `undefined`. */
  readonly readFeatureId: (properties: unknown) => string | undefined;
  /** 스타일 안에서 끼워 넣는 자리. 생략하면 맨 위. */
  readonly placement?: LayerPlacement;
  /** 이 소스의 데이터가 의존하는 값들. 참조가 모두 같으면 데이터도 같다. */
  readonly dependencies: (
    content: MapContent,
    selection: MapSelection | null,
  ) => readonly unknown[];
  readonly toFeatureCollection: (
    content: MapContent,
    selection: MapSelection | null,
  ) => FeatureCollection;
};

/** press 를 종류가 붙은 참조로 바꿀 수 있는 셋 — `kind` 가 `MapFeatureKind` 로 좁혀진다. */
export type InteractiveLayerSet = FeatureLayerSet & { readonly kind: MapFeatureKind };

/**
 * 지도에 얹는 모든 피처 종류. 순서 = 그리는 순서(그늘 fill 맨 아래 → 물줄기 면 → 구간 선 →
 * 흐름 점선 → 시설 점 → 봉우리 라벨 → 명당). 그늘은 `placement` 로 라벨 아래까지 내려가고, 나머지는
 * 스타일 맨 위에 이 순서로 쌓인다. 흐름 점선이 구간 선 위인 이유는 `flowLayers.ts`.
 * 두 어댑터와 네이티브 뷰가 이 배열 하나를 순회한다.
 */
export const MAP_LAYER_SETS: readonly FeatureLayerSet[] = [
  SHADE_LAYER_SET,
  LAND_LAYER_SET,
  WATER_LAYER_SET,
  SEGMENT_LAYER_SET,
  FLOW_LAYER_SET,
  FACILITY_LAYER_SET,
  PEAK_LAYER_SET,
  SPOT_LAYER_SET,
];

/** `sourceId` 로 레이어 셋을 찾는다. 네이티브가 press 이벤트의 소스를 종류로 바꿀 때 쓴다. */
export function findLayerSetBySource(sourceId: string): FeatureLayerSet | undefined {
  return MAP_LAYER_SETS.find((set) => set.sourceId === sourceId);
}

/**
 * press 배선 대상인가. 히트 레이어가 하나 이상 있고 `kind` 가 피처 종류일 때만 —
 * 두 어댑터가 `toMapFeatureRef` 를 부르기 전에 같은 판정을 거친다.
 */
export function isInteractiveLayerSet(set: FeatureLayerSet): set is InteractiveLayerSet {
  return (
    set.interactiveLayerIds.length > 0 &&
    (MAP_FEATURE_KINDS as readonly string[]).includes(set.kind)
  );
}

/** 의존 목록의 얕은 참조 비교. `previous` 가 없으면(첫 렌더) 다르다고 본다. */
export function sameDependencies(
  previous: readonly unknown[] | undefined,
  next: readonly unknown[],
): boolean {
  if (previous === undefined || previous.length !== next.length) return false;
  return previous.every((value, index) => value === next[index]);
}
