/**
 * 한강홍수통제소 10분 폴러. 수위·강우 전체 관측소 최신값 2 호출 → latest 갱신 + observations(10분 격자) 적재
 * + 7일 보존 정리 → SSE `hydro`.
 */
import type { Repos } from '../db/repos';
import type { EventHub } from '../events/EventHub';
import { hrfcoUrl, parseHrfcoLatest } from '../sources/hrfco';
import type { SourceHttp } from '../sources/http';
import type { JobRunResult } from './PollJob';

export const OBSERVATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const FETCH_LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface HrfcoJobDeps {
  readonly key: string;
  readonly http: SourceHttp;
  readonly repos: Repos;
  readonly hub: EventHub;
  readonly now?: () => number;
}

export function createHrfcoRun(deps: HrfcoJobDeps): () => Promise<JobRunResult> {
  const now = deps.now ?? Date.now;
  return async () => {
    const [wl, rf] = await Promise.all([
      deps.http.json(hrfcoUrl(deps.key, 'waterlevel', 'list/10M')),
      deps.http.json(hrfcoUrl(deps.key, 'rainfall', 'list/10M')),
    ]);
    const waterlevel = parseHrfcoLatest('waterlevel', wl.body);
    const rainfall = parseHrfcoLatest('rainfall', rf.body);
    const rows = [...waterlevel, ...rainfall];
    const nowMs = now();
    const nowIso = new Date(nowMs).toISOString();
    deps.repos.latest.upsertMany(rows, nowIso);
    deps.repos.observations.upsertMany(rows, nowIso);
    const pruned = deps.repos.observations.prune(
      new Date(nowMs - OBSERVATION_RETENTION_MS).toISOString(),
    );
    deps.repos.fetchLog.prune(new Date(nowMs - FETCH_LOG_RETENTION_MS).toISOString());
    const observedAt = deps.repos.latest.maxObservedAt(['hrfco-waterlevel', 'hrfco-rainfall']);
    deps.hub.publish('hydro', {
      observedAt,
      waterlevel: waterlevel.length,
      rainfall: rainfall.length,
    });
    return {
      rows: rows.length,
      status: Math.max(wl.status, rf.status),
      detail: { observedAt, pruned },
    };
  };
}
