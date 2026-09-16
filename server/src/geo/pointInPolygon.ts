/**
 * GeoJSON Polygon/MultiPolygon 점 포함 판정(레이 캐스팅, 경도·위도 평면). 표준유역 폴리곤은 수 km 규모라
 * 평면 근사로 충분하다. 구멍(hole)이 있는 링은 짝수-홀수 규칙으로 자연히 빠진다.
 */
/** `[경도, 위도, …]`. GeoJSON 은 배열이라 튜플로 강제하지 않고 앞 두 값만 읽는다. */
export type Position = readonly number[];
export type Ring = readonly Position[];

export type PolygonGeometry =
  | { readonly type: 'Polygon'; readonly coordinates: readonly Ring[] }
  | { readonly type: 'MultiPolygon'; readonly coordinates: readonly (readonly Ring[])[] };

export interface Bbox {
  readonly minLng: number;
  readonly minLat: number;
  readonly maxLng: number;
  readonly maxLat: number;
}

function ringContains(ring: Ring, lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0] ?? 0;
    const yi = ring[i]?.[1] ?? 0;
    const xj = ring[j]?.[0] ?? 0;
    const yj = ring[j]?.[1] ?? 0;
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function polygonContains(rings: readonly Ring[], lng: number, lat: number): boolean {
  let inside = false;
  for (const ring of rings) if (ringContains(ring, lng, lat)) inside = !inside;
  return inside;
}

export function geometryContains(geometry: PolygonGeometry, lng: number, lat: number): boolean {
  if (geometry.type === 'Polygon') return polygonContains(geometry.coordinates, lng, lat);
  return geometry.coordinates.some((polygon) => polygonContains(polygon, lng, lat));
}

function* positionsOf(geometry: PolygonGeometry): Generator<Position> {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const rings of polygons) for (const ring of rings) yield* ring;
}

export function bboxOf(geometry: PolygonGeometry): Bbox {
  const box = {
    minLng: Number.POSITIVE_INFINITY,
    minLat: Number.POSITIVE_INFINITY,
    maxLng: Number.NEGATIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
  };
  for (const p of positionsOf(geometry)) {
    const lng = p[0] ?? 0;
    const lat = p[1] ?? 0;
    box.minLng = Math.min(box.minLng, lng);
    box.maxLng = Math.max(box.maxLng, lng);
    box.minLat = Math.min(box.minLat, lat);
    box.maxLat = Math.max(box.maxLat, lat);
  }
  return box;
}

export function isPolygonGeometry(value: unknown): value is PolygonGeometry {
  if (typeof value !== 'object' || value === null) return false;
  const g = value as { type?: unknown; coordinates?: unknown };
  return (g.type === 'Polygon' || g.type === 'MultiPolygon') && Array.isArray(g.coordinates);
}
