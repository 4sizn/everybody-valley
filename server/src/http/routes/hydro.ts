/**
 * `GET /api/hydro/stations?kind=waterlevel,rainfall&bbox=minLng,minLat,maxLng,maxLat`
 * `GET /api/hydro/latest?stations=code,code&kind=waterlevel|rainfall`
 * 저장된 값만 낸다(정부 API 는 폴러만 부른다). 캐시는 폴링 주기의 절반.
 */
import { Hono } from 'hono';
import type { Repos } from '../../db/repos';
import type { Bbox } from '../../geo/pointInPolygon';
import type { StationKind } from '../../records';

const KIND_ALIAS: Readonly<Record<string, StationKind>> = {
  waterlevel: 'hrfco-waterlevel',
  rainfall: 'hrfco-rainfall',
  'hrfco-waterlevel': 'hrfco-waterlevel',
  'hrfco-rainfall': 'hrfco-rainfall',
};

export function parseHydroKinds(raw: string | undefined): StationKind[] | undefined {
  if (!raw) return ['hrfco-waterlevel', 'hrfco-rainfall'];
  const kinds = raw
    .split(',')
    .map((s) => KIND_ALIAS[s.trim()])
    .filter((k): k is StationKind => k !== undefined);
  return kinds.length > 0 ? [...new Set(kinds)] : undefined;
}

export function parseBbox(raw: string | undefined): Bbox | null | undefined {
  if (!raw) return undefined;
  const n = raw.split(',').map((s) => Number(s.trim()));
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v))) return null;
  const [minLng, minLat, maxLng, maxLat] = n as [number, number, number, number];
  if (minLng > maxLng || minLat > maxLat) return null;
  return { minLng, minLat, maxLng, maxLat };
}

export function parseCodes(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  return [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    ),
  ];
}

export function hydroRoutes(repos: Repos, cacheSec = 300): Hono {
  const app = new Hono();

  app.get('/stations', (c) => {
    const kinds = parseHydroKinds(c.req.query('kind'));
    if (!kinds) return c.json({ error: 'bad_kind', allowed: ['waterlevel', 'rainfall'] }, 400);
    const bbox = parseBbox(c.req.query('bbox'));
    if (bbox === null)
      return c.json({ error: 'bad_bbox', format: 'minLng,minLat,maxLng,maxLat' }, 400);
    const stations = repos.stations.list(kinds, bbox);
    c.header('cache-control', `public, max-age=${cacheSec * 12}`);
    return c.json({ count: stations.length, stations });
  });

  app.get('/latest', (c) => {
    const kinds = parseHydroKinds(c.req.query('kind'));
    if (!kinds) return c.json({ error: 'bad_kind', allowed: ['waterlevel', 'rainfall'] }, 400);
    const codes = parseCodes(c.req.query('stations'));
    if (codes !== undefined && codes.length === 0) return c.json({ error: 'bad_stations' }, 400);
    const observations = repos.latest.get(kinds, codes);
    c.header('cache-control', `public, max-age=${cacheSec}`);
    return c.json({
      count: observations.length,
      observedAt: repos.latest.maxObservedAt(kinds),
      observations,
    });
  });

  return app;
}
