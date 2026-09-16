/**
 * 명당 마커 소스·레이어 명세 — 데모의 `spot-glow` / `spot-dot` / `spot-label`.
 *
 * GeoJSON 을 만드는 함수도 여기 둔다. 데모는 `properties.idx` 에 배열
 * 인덱스를 실어 클릭 핸들러에서 `+properties.idx` 로 되돌리는데, 목록 정렬이
 * 바뀌면 지도와 상세가 어긋나는 구조다. 안정된 `SpotId` 를 싣고, 읽는 쪽도
 * 같은 파일의 함수를 쓰게 해서 키가 갈라지지 않게 한다.
 */
import type {
  CircleLayerSpecification,
  GeoJSONSourceSpecification,
  SymbolLayerSpecification,
} from '@maplibre/maplibre-gl-style-spec';
import type { LngLat, MapContent, Spot } from '@modu-valley/core';
import type { FeatureCollection, Point } from 'geojson';
import { EMPTY_GEOJSON_SOURCE, readStringProperty } from './featureProperties';
import type { FeatureLayerSet } from './layerSets';

export const SPOT_SOURCE_ID = 'spots';
export const SPOT_GLOW_LAYER_ID = 'spot-glow';
export const SPOT_DOT_LAYER_ID = 'spot-dot';
export const SPOT_LABEL_LAYER_ID = 'spot-label';

/** 클릭 히트 영역에 포함되는 레이어들. 라벨·글로우까지 눌린다(데모와 동일). */
export const SPOT_INTERACTIVE_LAYER_IDS = [
  SPOT_DOT_LAYER_ID,
  SPOT_GLOW_LAYER_ID,
  SPOT_LABEL_LAYER_ID,
] as const;

export const EMPTY_SPOT_SOURCE: GeoJSONSourceSpecification = EMPTY_GEOJSON_SOURCE;

export const SPOT_GLOW_LAYER: CircleLayerSpecification = {
  id: SPOT_GLOW_LAYER_ID,
  type: 'circle',
  source: SPOT_SOURCE_ID,
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 10, 16, 26],
    'circle-color': ['get', 'color'],
    'circle-opacity': 0.16,
    'circle-blur': 0.9,
  },
};

export const SPOT_DOT_LAYER: CircleLayerSpecification = {
  id: SPOT_DOT_LAYER_ID,
  type: 'circle',
  source: SPOT_SOURCE_ID,
  paint: {
    'circle-radius': 6,
    'circle-color': ['get', 'color'],
    'circle-stroke-width': 2.5,
    'circle-stroke-color': 'rgba(255,255,255,.9)',
  },
};

export const SPOT_LABEL_LAYER: SymbolLayerSpecification = {
  id: SPOT_LABEL_LAYER_ID,
  type: 'symbol',
  source: SPOT_SOURCE_ID,
  layout: {
    // 이름 + 줄바꿈 + 거리(82% 크기). 데모의 format 표현 그대로.
    'text-field': [
      'format',
      ['get', 'name'],
      {},
      '\n',
      {},
      ['get', 'dist'],
      { 'font-scale': 0.82 },
    ],
    'text-font': ['Noto Sans Bold'],
    'text-size': 13,
    'text-offset': [0, -1.9],
    'text-anchor': 'bottom',
    'text-allow-overlap': false,
  },
  paint: {
    'text-color': '#ffffff',
    'text-halo-color': 'rgba(0,0,0,.85)',
    'text-halo-width': 1.6,
  },
};

export type SpotFeatureProperties = {
  readonly spotId: string;
  readonly name: string;
  readonly color: string;
  /** 라벨 두 번째 줄에 들어가는 거리 문자열. 데모의 `dist`. */
  readonly dist: string;
};

/**
 * 명당 목록 → 마커 소스 데이터. 거리 라벨 계산에 발사 지점이 필요하다.
 * 발사 지점이 없으면(festival 이 실리지 않은 지도) 거리 줄을 비운다.
 */
export function toSpotFeatureCollection(
  spots: readonly Spot[],
  launchSite: LngLat | null,
): FeatureCollection<Point, SpotFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: spots.map((spot) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [spot.position.lng, spot.position.lat] },
      properties: {
        spotId: spot.id,
        name: spot.name,
        color: spot.color,
        dist: launchSite === null ? '' : spot.distanceFrom(launchSite).format(),
      },
    })),
  };
}

/**
 * 히트된 피처에서 명당 id 를 읽는다.
 *
 * 지도 SDK 가 돌려주는 `properties` 는 web·네이티브 모두 `unknown` 수준의
 * 값이다(네이티브는 브리지를 건너오며 타입이 사라진다). 두 어댑터가 같은
 * 관문을 쓰도록 여기 둔다.
 */
export function readSpotFeatureId(properties: unknown): string | undefined {
  return readStringProperty(properties, 'spotId');
}

/**
 * 명당 레이어 셋. 값은 위의 데모 파리티 상수 그대로이고 목록으로 묶기만 했다.
 * 선택은 별도 핀이 맡으므로 소스 데이터는 선택에 의존하지 않는다.
 */
export const SPOT_LAYER_SET: FeatureLayerSet = {
  kind: 'spot',
  sourceId: SPOT_SOURCE_ID,
  emptySource: EMPTY_SPOT_SOURCE,
  layers: [SPOT_GLOW_LAYER, SPOT_DOT_LAYER, SPOT_LABEL_LAYER],
  interactiveLayerIds: SPOT_INTERACTIVE_LAYER_IDS,
  readFeatureId: readSpotFeatureId,
  dependencies: (content: MapContent) => [content.spots, content.launchSite],
  toFeatureCollection: (content) => toSpotFeatureCollection(content.spots, content.launchSite),
};
