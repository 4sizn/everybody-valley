import { type LngLat, parseLandParcels } from '@modu-valley/core';
import { Hono } from 'hono';
import type { VworldCredentials } from '../../vworld/allowlist';

/** 계곡 주변만 실시간 조회. 응답은 저장하지 않고 소유구분·경계만 전달한다. */
export function landRoutes(
  credentials: VworldCredentials | undefined,
  lines: ReadonlyMap<string, readonly LngLat[]>,
  doFetch: typeof fetch = fetch,
): Hono {
  const app = new Hono();
  app.get('/:valleyId', async (c) => {
    c.header('Cache-Control', 'no-store');
    const line = lines.get(c.req.param('valleyId'));
    if (!line?.length) return c.json({ error: 'valley_not_found' }, 404);
    if (!credentials) return c.json({ error: 'vworld_key_missing' }, 503);
    const west = Math.min(...line.map((p) => p.lng)) - 0.003;
    const east = Math.max(...line.map((p) => p.lng)) + 0.003;
    const south = Math.min(...line.map((p) => p.lat)) - 0.003;
    const north = Math.max(...line.map((p) => p.lat)) + 0.003;
    const url = new URL('https://api.vworld.kr/req/wfs');
    for (const [k, v] of Object.entries({
      service: 'WFS',
      request: 'GetFeature',
      version: '1.1.0',
      typename: 'dt_d160',
      srsname: 'EPSG:4326',
      bbox: `${south},${west},${north},${east},EPSG:4326`,
      maxfeatures: '1000',
      output: 'application/json',
      key: credentials.key,
      domain: credentials.domain,
    }))
      url.searchParams.set(k, v);
    try {
      const response = await doFetch(url, {
        signal: AbortSignal.timeout(20000),
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('upstream');
      const data: unknown = await response.json();
      const parcels = parseLandParcels(data);
      const featureCount = (data as { features: unknown[] }).features.length;
      return c.json({
        parcels,
        partial: featureCount >= 1000,
        fetchedAt: new Date().toISOString(),
        source: '국토교통부·브이월드 토지소유공간정보',
      });
    } catch {
      return c.json({ error: 'ownership_unavailable' }, 502);
    }
  });
  return app;
}
