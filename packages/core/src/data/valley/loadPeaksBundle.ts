/**
 * 봉우리 합본 → `Peak[]`. `peaks-bundle.json = { collections: [ <data/peaks/<id>.geojson> … ] }`.
 *
 * 계곡·시설 합본과 달리 **관대하게** 읽는다 — 봉우리는 라벨일 뿐이라 한 피처가 깨져도 데이터셋을
 * 실패시키지 않고 그 피처만 버린다. 합본 자체가 객체가 아니면 빈 배열.
 */
import { LngLat } from '../../domain/geo/LngLat';
import { toValleyId } from '../../domain/valley/ids';
import type { Peak } from '../../domain/valley/Peak';
import { isJsonRecord } from './PropsReader';

export function loadPeaksBundle(raw: unknown): readonly Peak[] {
  if (!isJsonRecord(raw) || !Array.isArray(raw['collections'])) return [];
  const peaks: Peak[] = [];
  for (const collection of raw['collections']) {
    if (!isJsonRecord(collection) || !Array.isArray(collection['features'])) continue;
    for (const feature of collection['features']) {
      const peak = readPeak(feature);
      if (peak !== undefined) peaks.push(peak);
    }
  }
  return peaks;
}

function readPeak(feature: unknown): Peak | undefined {
  if (!isJsonRecord(feature)) return undefined;
  const properties = feature['properties'];
  const geometry = feature['geometry'];
  if (!isJsonRecord(properties) || !isJsonRecord(geometry)) return undefined;
  const coordinates = geometry['coordinates'];
  const valleyId = properties['valleyId'];
  const name = properties['name'];
  if (
    geometry['type'] !== 'Point' ||
    !Array.isArray(coordinates) ||
    typeof coordinates[0] !== 'number' ||
    typeof coordinates[1] !== 'number' ||
    typeof valleyId !== 'string' ||
    typeof name !== 'string' ||
    name === ''
  )
    return undefined;
  const elevation = properties['elevationM'];
  return {
    valleyId: toValleyId(valleyId),
    name,
    elevationM: typeof elevation === 'number' && Number.isFinite(elevation) ? elevation : undefined,
    position: LngLat.of(coordinates[0], coordinates[1]),
  };
}
