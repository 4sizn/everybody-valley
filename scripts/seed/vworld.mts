/**
 * 브이월드 WFS — 하천망(`lt_c_wkmstrm`) 비교 통계와 표준유역(`lt_c_wkmsbsn`) 코드.
 *
 * 약관 §19: 응답 기하는 **저장하지 않는다**. 하천망은 피처 수·기하 종류·정점 수 같은 통계만
 * 남기고, 유역은 코드(`sbsncd` 등)만 남긴다. BBOX 는 EPSG:4326 에서 **위도,경도** 순서
 * (`docs/API_KEYS.md` §6). 요청 간격 100 ms 이상(`VWORLD_GAP_MS`).
 */
import type { Keys } from './env.mts';
import { bboxAround, distanceM, lineLengthM, type Position } from './geo.mts';
import { cached, fetchJson, VWORLD_GAP_MS } from './http.mts';

interface WfsFeature {
  properties?: Record<string, unknown>;
  geometry?: { type: string; coordinates: unknown };
}

interface WfsResponse {
  features?: WfsFeature[];
}

function wfsUrl(
  typeName: string,
  bbox: readonly [number, number, number, number],
  maxFeatures: number,
  key: string,
): string {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const r = (value: number): string => String(Number(value.toFixed(5)));
  const params = new URLSearchParams({
    SERVICE: 'WFS',
    VERSION: '1.1.0',
    REQUEST: 'GetFeature',
    TYPENAME: typeName,
    BBOX: `${r(minLat)},${r(minLng)},${r(maxLat)},${r(maxLng)},EPSG:4326`,
    SRSNAME: 'EPSG:4326',
    OUTPUT: 'application/json',
    MAXFEATURES: String(maxFeatures),
    key,
    domain: 'localhost',
  });
  return `https://api.vworld.kr/req/wfs?${params.toString()}`;
}

export interface StreamNetworkStats {
  /** 상자 안 피처 수. */
  readonly features: number;
  /** 기하 종류 집계(Polygon·MultiPolygon·LineString·MultiLineString). */
  readonly geometryTypes: Readonly<Record<string, number>>;
  /** 전체 정점 수. */
  readonly vertices: number;
  /** 선 길이 또는 폴리곤 외곽 길이 합(km). */
  readonly outlineKm: number;
  /** 정점 밀도(정점/km) — `vertices / outlineKm`. */
  readonly verticesPerKm: number;
  /** 계곡 점에서 가장 가까운 정점까지 거리(m). */
  readonly nearestM: number;
  /** 하천 이름·등급(riv_nm·riv_level) — 속성만. */
  readonly rivers: readonly string[];
}

function ringsOf(geometry: { type: string; coordinates: unknown }): Position[][] {
  const c = geometry.coordinates;
  switch (geometry.type) {
    case 'LineString':
      return [c as Position[]];
    case 'MultiLineString':
    case 'Polygon':
      return c as Position[][];
    case 'MultiPolygon':
      return (c as Position[][][]).flat();
    default:
      return [];
  }
}

/**
 * 계곡 점 주변 `radiusM` 상자의 하천망 통계. 기하는 함수 안에서만 보고 버린다.
 * 캐시에는 통계만 저장한다.
 */
export async function streamNetworkStats(
  valleyId: string,
  center: Position,
  radiusM: number,
  keys: Keys,
): Promise<StreamNetworkStats | undefined> {
  const key = keys.vworld;
  if (key === undefined) return undefined;
  return cached(`vworld-stats/wkmstrm-${valleyId}-${radiusM}.json`, async () => {
    const url = wfsUrl('lt_c_wkmstrm', bboxAround(center, radiusM), 50, key);
    const response = await fetchJson<WfsResponse>(url, keys, VWORLD_GAP_MS);
    const features = response.features ?? [];
    const geometryTypes: Record<string, number> = {};
    let vertices = 0;
    let outlineM = 0;
    let nearestM = Number.POSITIVE_INFINITY;
    const rivers = new Set<string>();
    for (const feature of features) {
      const geometry = feature.geometry;
      if (geometry === undefined) continue;
      geometryTypes[geometry.type] = (geometryTypes[geometry.type] ?? 0) + 1;
      for (const ring of ringsOf(geometry)) {
        vertices += ring.length;
        outlineM += lineLengthM(ring);
        for (const point of ring) nearestM = Math.min(nearestM, distanceM(center, point));
      }
      const props = feature.properties ?? {};
      const name = typeof props['riv_nm'] === 'string' ? props['riv_nm'] : '?';
      const level = typeof props['riv_level'] === 'string' ? props['riv_level'] : '';
      rivers.add(level ? `${name}(${level})` : name);
    }
    const outlineKm = outlineM / 1000;
    return {
      features: features.length,
      geometryTypes,
      vertices,
      outlineKm: Math.round(outlineKm * 100) / 100,
      verticesPerKm: outlineKm > 0 ? Math.round(vertices / outlineKm) : 0,
      nearestM: Number.isFinite(nearestM) ? Math.round(nearestM) : -1,
      rivers: [...rivers],
    };
  });
}

export interface Basin {
  readonly sbsncd: string;
  readonly sbsnnm: string;
  readonly mbsncd: string;
  readonly bbsncd: string;
}

/** 점이 속한 표준유역 — 코드만 캐시(폴리곤 저장 금지). 0.0003° → 0.002° 두 단계. */
export async function lookupBasin(p: Position, keys: Keys): Promise<Basin | undefined> {
  const key = keys.vworld;
  if (key === undefined) return undefined;
  const id = `${p[1].toFixed(5)}_${p[0].toFixed(5)}`;
  const result = await cached<Basin | null>(`vworld-stats/basin-${id}.json`, async () => {
    for (const eps of [0.0003, 0.002]) {
      const url = wfsUrl('lt_c_wkmsbsn', [p[0] - eps, p[1] - eps, p[0] + eps, p[1] + eps], 1, key);
      const response = await fetchJson<WfsResponse>(url, keys, VWORLD_GAP_MS);
      const feature = response.features?.[0];
      if (feature) {
        const props = feature.properties ?? {};
        const s = (name: string): string => (typeof props[name] === 'string' ? props[name] : '');
        return {
          sbsncd: s('sbsncd'),
          sbsnnm: s('sbsnnm'),
          mbsncd: s('mbsncd'),
          bbsncd: s('bbsncd'),
        };
      }
    }
    return null;
  });
  return result ?? undefined;
}
