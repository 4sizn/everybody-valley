/**
 * `GET /api/aws/latest?stns=code,code` — 기상청 AWS 지점별 최신 분 값(value = RN-60m mm).
 * `GET /api/aws/stations?bbox=` — 지점정보.
 */
import { Hono } from 'hono';
import type { Repos } from '../../db/repos';
import { parseBbox, parseCodes } from './hydro';

export function awsRoutes(repos: Repos, cacheSec = 30): Hono {
  const app = new Hono();

  app.get('/stations', (c) => {
    const bbox = parseBbox(c.req.query('bbox'));
    if (bbox === null)
      return c.json({ error: 'bad_bbox', format: 'minLng,minLat,maxLng,maxLat' }, 400);
    const stations = repos.stations.list(['aws'], bbox);
    c.header('cache-control', 'public, max-age=3600');
    return c.json({ count: stations.length, stations });
  });

  app.get('/latest', (c) => {
    const codes = parseCodes(c.req.query('stns') ?? c.req.query('stations'));
    if (codes !== undefined && codes.length === 0) return c.json({ error: 'bad_stns' }, 400);
    const observations = repos.latest.get(['aws'], codes);
    c.header('cache-control', `public, max-age=${cacheSec}`);
    return c.json({
      count: observations.length,
      observedAt: repos.latest.maxObservedAt(['aws']),
      observations,
    });
  });

  return app;
}
