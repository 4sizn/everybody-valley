/**
 * GeoJSON 속성을 읽는 공용 관문.
 *
 * 지도 SDK 가 돌려주는 `properties` 는 web·네이티브 모두 `unknown` 수준의
 * 값이다(네이티브는 브리지를 건너오며 타입이 사라진다). 피처 종류마다 같은
 * 검사를 반복하지 않도록 여기 한 곳에 둔다.
 */
import type { GeoJSONSourceSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { FeatureCollection } from 'geojson';

export const EMPTY_FEATURE_COLLECTION: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

/** 빈 GeoJSON 소스 명세. 스타일 로드 직후 소스를 먼저 만들고 데이터는 뒤에 넣는다. */
export const EMPTY_GEOJSON_SOURCE: GeoJSONSourceSpecification = {
  type: 'geojson',
  data: EMPTY_FEATURE_COLLECTION,
};

/** `properties[key]` 가 문자열이면 그 값, 아니면 `undefined`. */
export function readStringProperty(properties: unknown, key: string): string | undefined {
  if (properties === null || typeof properties !== 'object') return undefined;
  const value = (properties as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}
