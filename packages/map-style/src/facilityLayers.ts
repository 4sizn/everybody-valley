/**
 * 계곡 시설 소스·레이어 명세 — Point 에 물방울 핀 아이콘 한 장 (C5).
 *
 * V1 (f) 의 흰 원(`valley-facility-dot`) + 이니셜 심볼(`valley-facility-initial`) 두 장을
 * **핀 심볼 레이어 한 장**으로 바꿨다. 아이콘은 `icon-image` 가 부르는 ID(`facility/<type>`,
 * 선택 `facility/<type>/selected`)로 정해지고, 그 ID 를 그림으로 바꾸는 것은 어댑터다 —
 * web 은 `facilityIcons.ts` 의 SVG 를 런타임에 래스터화하고, 네이티브는 같은 팩토리로 빌드 때
 * 구운 PNG 를 같은 ID 로 등록한다. 레이어 명세는 두 플랫폼에서 글자 하나 다르지 않다.
 *
 * 꼭짓점이 좌표다(`icon-anchor: bottom`). 선택 핀은 링 두께만큼 캔버스 안쪽에 꼭짓점이 있어
 * `icon-offset` 으로 그만큼 내린다 — 선택해도 핀이 위로 튀지 않는다. 핀은 충돌 회피 없이 항상
 * 그리고(`icon-allow-overlap`) 다른 라벨의 자리도 빼앗지 않는다(`icon-ignore-placement`) —
 * V1 의 원이 그랬다. 히트 대상은 이 레이어 하나다.
 *
 * 선택은 `properties.selected` 로 소스에 실린다(구간과 같은 이유 — 어댑터가 종류를 모른 채
 * `selected` 재주입만 한다). 유형색은 `FACILITY_COLORS`(스파이크 임시색 금지).
 */
import type {
  ExpressionSpecification,
  SymbolLayerSpecification,
} from '@maplibre/maplibre-gl-style-spec';
import {
  FACILITY_TYPES,
  type Facility,
  type FacilityType,
  type MapContent,
  type MapSelection,
  selectedIdOf,
} from '@modu-valley/core';
import type { FeatureCollection, Point } from 'geojson';
import {
  FACILITY_ICON_ID_PREFIX,
  FACILITY_ICON_SELECTED_SUFFIX,
  FACILITY_PIN_TIP_INSET,
} from './facilityIcons';
import { EMPTY_GEOJSON_SOURCE, readStringProperty } from './featureProperties';
import type { FeatureLayerSet } from './layerSets';

export const FACILITY_SOURCE_ID = 'valley-facilities';
export const FACILITY_PIN_LAYER_ID = 'valley-facility-pin';

export const FACILITY_INTERACTIVE_LAYER_IDS = [FACILITY_PIN_LAYER_ID] as const;

const IS_SELECTED: ExpressionSpecification = ['boolean', ['get', 'selected'], false];

/** `match` 표현식 몸통 — 9종을 모두 적는다(테스트가 `FACILITY_TYPES` 와 대조한다). */
function matchFacilityType(
  values: Readonly<Record<FacilityType, string>>,
  fallback: string,
): ExpressionSpecification {
  return [
    'match',
    ['get', 'facilityType'],
    ...FACILITY_TYPES.flatMap((type) => [type, values[type]]),
    fallback,
  ] as unknown as ExpressionSpecification;
}

/** 시설 종류 → ID 의 종류 조각. 모르는 종류는 `etc` 핀으로 — 아이콘이 없어 사라지는 일이 없다. */
const FACILITY_ICON_TYPE: ExpressionSpecification = matchFacilityType(
  Object.fromEntries(FACILITY_TYPES.map((type) => [type, type])) as Record<FacilityType, string>,
  'etc',
);

/**
 * `icon-image` — `facility/<type>` 에 선택이면 `/selected` 를 붙인다. `facilityIcons.ts` 의
 * `facilityIconId` 와 같은 규약을 표현식으로 적은 것이다(테스트가 두 쪽을 대조한다).
 */
export const FACILITY_ICON_IMAGE: ExpressionSpecification = [
  'concat',
  FACILITY_ICON_ID_PREFIX,
  FACILITY_ICON_TYPE,
  ['case', IS_SELECTED, FACILITY_ICON_SELECTED_SUFFIX, ''],
];

/** 꼭짓점 보정 — 선택 핀만 링 두께만큼 아래로. 단위는 아이콘 픽셀(`icon-size` 1). */
export const FACILITY_ICON_OFFSET: ExpressionSpecification = [
  'case',
  IS_SELECTED,
  ['literal', [0, FACILITY_PIN_TIP_INSET.selected]],
  ['literal', [0, FACILITY_PIN_TIP_INSET.base]],
];

export const FACILITY_PIN_LAYER: SymbolLayerSpecification = {
  id: FACILITY_PIN_LAYER_ID,
  type: 'symbol',
  source: FACILITY_SOURCE_ID,
  layout: {
    'icon-image': FACILITY_ICON_IMAGE,
    'icon-size': 1,
    'icon-anchor': 'bottom',
    'icon-offset': FACILITY_ICON_OFFSET,
    // 핀은 항상 보이고, 베이스맵 라벨의 자리를 빼앗지 않는다 — V1 의 원과 같은 태도.
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
};

export type FacilityFeatureProperties = {
  readonly facilityId: string;
  readonly valleyId: string;
  readonly name: string;
  readonly facilityType: FacilityType;
  readonly selected: boolean;
};

/** 시설 목록 + 선택 id → 소스 데이터. 좌표는 `[lng, lat]`. */
export function toFacilityFeatureCollection(
  facilities: readonly Facility[],
  selectedId: string | null = null,
): FeatureCollection<Point, FacilityFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: facilities.map((facility) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [facility.position.lng, facility.position.lat] },
      properties: {
        facilityId: facility.id,
        valleyId: facility.valleyId,
        name: facility.name,
        facilityType: facility.facilityType,
        selected: facility.id === selectedId,
      },
    })),
  };
}

/** 히트된 피처에서 시설 id 를 읽는다. */
export function readFacilityFeatureId(properties: unknown): string | undefined {
  return readStringProperty(properties, 'facilityId');
}

export const FACILITY_LAYER_SET: FeatureLayerSet = {
  kind: 'facility',
  sourceId: FACILITY_SOURCE_ID,
  emptySource: EMPTY_GEOJSON_SOURCE,
  layers: [FACILITY_PIN_LAYER],
  interactiveLayerIds: FACILITY_INTERACTIVE_LAYER_IDS,
  readFeatureId: readFacilityFeatureId,
  dependencies: (content: MapContent, selection: MapSelection | null) => [
    content.facilities,
    selectedIdOf(selection, 'facility'),
  ],
  toFeatureCollection: (content, selection) =>
    toFacilityFeatureCollection(content.facilities, selectedIdOf(selection, 'facility')),
};
