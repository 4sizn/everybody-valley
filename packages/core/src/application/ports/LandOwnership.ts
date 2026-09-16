import type { ShadePolygon } from '../../domain/valley/Shade';

export type LandParcel = {
  readonly ownership: 'individual' | 'organization' | 'public' | 'unknown';
  readonly coordinates: ShadePolygon;
};

/** 국토부 소유구분 코드. 외국인/외국공공기관(03)은 사유지로 단정하지 않는다. */
export function ownershipOf(code: unknown): LandParcel['ownership'] {
  if (code === '01') return 'individual';
  if (['06', '07', '08', '09'].includes(String(code))) return 'organization';
  if (['02', '04', '05'].includes(String(code))) return 'public';
  return 'unknown';
}

/** 외부 좌표를 검증하고 소유자 관련 속성은 모두 버린다. */
export function parseLandParcels(input: unknown): LandParcel[] {
  if (
    !input ||
    typeof input !== 'object' ||
    !('features' in input) ||
    !Array.isArray(input.features)
  ) {
    throw new Error('Invalid ownership response');
  }
  const parcels: LandParcel[] = [];
  for (const feature of input.features) {
    const geometry = feature?.geometry;
    const polygons =
      geometry?.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry?.type === 'MultiPolygon'
          ? geometry.coordinates
          : [];
    for (const polygon of polygons) {
      if (
        !Array.isArray(polygon) ||
        !polygon.length ||
        !polygon.every(
          (ring: unknown) =>
            Array.isArray(ring) &&
            ring.length >= 4 &&
            ring.every(
              (p: unknown) =>
                Array.isArray(p) &&
                p.length >= 2 &&
                Number.isFinite(p[0]) &&
                Number.isFinite(p[1]) &&
                Math.abs(p[0]) <= 180 &&
                Math.abs(p[1]) <= 90,
            ) &&
            ring[0][0] === ring.at(-1)[0] &&
            ring[0][1] === ring.at(-1)[1],
        )
      ) {
        throw new Error('Invalid ownership geometry');
      }
      parcels.push({
        ownership: ownershipOf(feature.properties?.posesn_se_code),
        coordinates: polygon,
      });
    }
  }
  return parcels;
}
