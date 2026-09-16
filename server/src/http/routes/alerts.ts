/**
 * `GET /api/alerts` — 계곡 30개(로스터, `alertSources.ts`) 전부의 현재 경보 상태.
 * 관측소가 하나도 없는 계곡은 조용히 평시(`level: null`, `stale: false`) — 자료가 없다고
 * 회색 타일을 그리지 않는다(그건 로스터가 있는데 15분 넘게 갱신이 없을 때만).
 */
import { isAlertDataStale } from '@modu-valley/core';
import { Hono } from 'hono';
import { ALERT_SOURCES } from '../../alertSources';
import { buildValleySignals } from '../../alerts/signals';
import type { Repos } from '../../db/repos';

export interface AlertsRouteDeps {
  readonly repos: Repos;
  readonly now?: () => number;
}

export function alertsRoutes(deps: AlertsRouteDeps, cacheSec = 15): Hono {
  const app = new Hono();
  const now = deps.now ?? Date.now;

  app.get('/', (c) => {
    const nowIso = new Date(now()).toISOString();
    const alerts = ALERT_SOURCES.map((roster) => {
      const hasCapability =
        roster.s1.length > 0 || roster.s2.length > 0 || roster.waterlevel.length > 0;
      const stored = deps.repos.alerts.get(roster.valleyId);
      if (!hasCapability) {
        return { valleyId: roster.valleyId, level: null, stale: false, lastObservedAt: null };
      }
      const bundle = buildValleySignals(deps.repos, roster, nowIso);
      const stale = isAlertDataStale(bundle.latestObservedAt, nowIso);
      if (!stored || stored.clearedAt !== null) {
        return {
          valleyId: roster.valleyId,
          level: null,
          stale,
          lastObservedAt: bundle.latestObservedAt,
        };
      }
      return {
        valleyId: roster.valleyId,
        level: stored.level,
        source: stored.source,
        confidence: stored.confidence,
        observedAt: stored.observedAt,
        issuedAt: stored.issuedAt,
        stationCode: stored.stationCode,
        rainfall10mMm: stored.rainfall10mMm,
        rainfall1hMm: stored.rainfall1hMm,
        rainfall3hMm: stored.rainfall3hMm,
        basinRainMmPerH: stored.basinRainMmPerH,
        waterLevelStage: stored.waterLevelStage,
        waterLevelDeltaM: stored.waterLevelDeltaM,
        leadTimeMin: stored.leadTimeMin,
        stale,
        lastObservedAt: bundle.latestObservedAt,
      };
    });
    c.header('cache-control', `public, max-age=${cacheSec}`);
    return c.json({ count: alerts.length, now: nowIso, alerts });
  });

  return app;
}
