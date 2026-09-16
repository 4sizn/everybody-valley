/**
 * `GET /api/basins?lng&lat` — 점이 속한 표준유역.
 *
 * 1) 저장된 수자원관리도 폴리곤(bbox 후보 → point-in-polygon) → `source: 'db'`, 캐시 가능.
 * 2) 없으면 브이월드 WFS `lt_c_wkmsbsn` 을 서버 키로 조회해 **저장하지 않고** 응답 → `source: 'vworld'`, `no-store`.
 *    BBOX 는 EPSG:4326 에서 위도,경도 순서(docs/API_KEYS.md §6).
 */
import type { Logger } from '@modu-valley/core';
import { Hono } from 'hono';
import type { Repos } from '../../db/repos';
import { geometryContains, isPolygonGeometry } from '../../geo/pointInPolygon';
import type { Redactor } from '../../logging/redact';
import type { SourceHttp } from '../../sources/http';
import { VWORLD_ORIGIN, type VworldCredentials } from '../../vworld/allowlist';

export interface BasinsRouteDeps {
  readonly repos: Repos;
  readonly http: SourceHttp;
  readonly vworld: VworldCredentials | undefined;
  readonly logger: Logger;
  readonly redact: Redactor;
}

export interface BasinLookup {
  readonly sbsncd: string;
  readonly sbsnnm: string | null;
  readonly mbsncd: string | null;
  readonly bbsncd: string | null;
}

/** 브이월드 표준유역 GetFeature URL. 점 주변 작은 상자 두 단계(0.0003° → 0.002°)는 호출자가 돈다. */
export function vworldBasinUrl(
  lng: number,
  lat: number,
  eps: number,
  creds: VworldCredentials,
): string {
  const url = new URL(`${VWORLD_ORIGIN}/req/wfs`);
  const p = url.searchParams;
  p.set('SERVICE', 'WFS');
  p.set('VERSION', '1.1.0');
  p.set('REQUEST', 'GetFeature');
  p.set('TYPENAME', 'lt_c_wkmsbsn');
  const r = (v: number): string => String(Number(v.toFixed(5)));
  p.set('BBOX', `${r(lat - eps)},${r(lng - eps)},${r(lat + eps)},${r(lng + eps)},EPSG:4326`);
  p.set('SRSNAME', 'EPSG:4326');
  p.set('OUTPUT', 'application/json');
  p.set('MAXFEATURES', '5');
  p.set('key', creds.key);
  p.set('domain', creds.domain);
  return url.toString();
}

const EPS_STEPS = [0.0003, 0.002] as const;

interface VworldHit {
  readonly basin: BasinLookup;
  readonly geometry: unknown;
}

async function lookupVworld(
  deps: BasinsRouteDeps,
  lng: number,
  lat: number,
): Promise<VworldHit | null> {
  if (!deps.vworld) return null;
  for (const eps of EPS_STEPS) {
    const res = await deps.http.json<{
      features?: { properties?: Record<string, unknown>; geometry?: unknown }[];
    }>(vworldBasinUrl(lng, lat, eps, deps.vworld));
    const features = res.body.features ?? [];
    // 상자에 여러 유역이 걸리면 실제로 점을 품는 것을 고른다.
    const hit =
      features.find(
        (f) => isPolygonGeometry(f.geometry) && geometryContains(f.geometry, lng, lat),
      ) ?? features[0];
    if (hit) {
      const pr = hit.properties ?? {};
      const s = (k: string): string | null =>
        typeof pr[k] === 'string' ? (pr[k] as string) : null;
      return {
        basin: {
          sbsncd: s('sbsncd') ?? '',
          sbsnnm: s('sbsnnm'),
          mbsncd: s('mbsncd'),
          bbsncd: s('bbsncd'),
        },
        geometry: hit.geometry,
      };
    }
  }
  return null;
}

function parsePoint(
  lngRaw: string | undefined,
  latRaw: string | undefined,
): { lng: number; lat: number } | null {
  const lng = Number(lngRaw);
  const lat = Number(latRaw);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90)
    return null;
  return { lng, lat };
}

function findStored(deps: BasinsRouteDeps, lng: number, lat: number): VworldHit | undefined {
  const stored = deps.repos.basins
    .candidates(lng, lat)
    .find((b) => isPolygonGeometry(b.geometry) && geometryContains(b.geometry, lng, lat));
  if (!stored) return undefined;
  return {
    basin: {
      sbsncd: stored.sbsncd,
      sbsnnm: stored.sbsnnm,
      mbsncd: stored.mbsncd,
      bbsncd: stored.bbsncd,
    },
    geometry: stored.geometry,
  };
}

export function basinsRoutes(deps: BasinsRouteDeps): Hono {
  const app = new Hono();

  app.get('/', async (c) => {
    const point = parsePoint(c.req.query('lng'), c.req.query('lat'));
    if (!point) return c.json({ error: 'bad_point', format: '?lng=127.26&lat=37.83' }, 400);
    const geometryOf = (hit: VworldHit): Record<string, unknown> =>
      c.req.query('geometry') === '1' ? { geometry: hit.geometry } : {};

    const stored = findStored(deps, point.lng, point.lat);
    if (stored) {
      c.header('cache-control', 'public, max-age=86400');
      return c.json({ source: 'db', stored: true, basin: stored.basin, ...geometryOf(stored) });
    }

    c.header('cache-control', 'no-store');
    if (!deps.vworld) {
      return c.json({ error: 'basin_not_found', reason: 'no-basins-no-vworld-key' }, 404);
    }
    try {
      const hit = await lookupVworld(deps, point.lng, point.lat);
      if (!hit) return c.json({ error: 'basin_not_found' }, 404);
      return c.json({
        source: 'vworld',
        stored: false,
        attribution: '브이월드(국토교통부) 표준유역 — 저장·재배포 금지',
        basin: hit.basin,
        ...geometryOf(hit),
      });
    } catch (error) {
      deps.logger.warn('basins vworld lookup failed', {
        error: deps.redact(error instanceof Error ? error.message : String(error)),
      });
      return c.json({ error: 'upstream_unavailable' }, 502);
    }
  });

  return app;
}
