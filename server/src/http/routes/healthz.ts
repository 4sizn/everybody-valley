/**
 * `GET /healthz` — 프로세스·DB·마지막 폴링 시각. 키는 있는지 여부만 내보낸다(값은 절대 아님).
 */
import { Hono } from 'hono';
import type { Db } from '../../db/Database';
import { pingDatabase } from '../../db/Database';
import { currentSchemaVersion } from '../../db/migrate';

export interface HealthDeps {
  readonly db: Db;
  readonly dbPath: string;
  readonly keys: Readonly<Record<string, boolean>>;
  readonly startedAt: number;
  readonly now?: () => number;
}

export interface LastPoll {
  readonly hydro: string | null;
  readonly aws: string | null;
}

/** fetch_log 에서 잡별 마지막 성공 시각. 잡이 아직 없으면 null. */
export function lastSuccessfulPolls(db: Db): LastPoll {
  const rows = db
    .prepare('SELECT job, MAX(finished_at) AS finished_at FROM fetch_log WHERE ok = 1 GROUP BY job')
    .all() as { job: string; finished_at: string }[];
  const by = new Map(rows.map((r) => [r.job, r.finished_at]));
  return { hydro: by.get('hrfco') ?? null, aws: by.get('aws') ?? null };
}

export function healthRoutes(deps: HealthDeps): Hono {
  const app = new Hono();
  const now = deps.now ?? Date.now;
  app.get('/', (c) => {
    const dbOk = pingDatabase(deps.db);
    const body = {
      ok: dbOk,
      now: new Date(now()).toISOString(),
      uptimeSec: Math.round((now() - deps.startedAt) / 1000),
      db: {
        ok: dbOk,
        path: deps.dbPath,
        schemaVersion: dbOk ? currentSchemaVersion(deps.db) : null,
      },
      lastPoll: dbOk ? lastSuccessfulPolls(deps.db) : { hydro: null, aws: null },
      keys: deps.keys,
    };
    c.header('cache-control', 'no-store');
    return c.json(body, dbOk ? 200 : 503);
  });
  return app;
}
