/**
 * 진입점. 설정 → 로거 → DB(마이그레이션) → Hono 앱 → 리슨. SIGINT/SIGTERM 에 서버·DB 를 정리한다.
 */
import path from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadConfig, mergeEnv, readEnvLocal, secretValues } from './config';
import { openDatabase } from './db/Database';
import { runMigrations } from './db/migrate';
import { createRepos } from './db/repos';
import { EventHub } from './events/EventHub';
import { createJobs } from './jobs/index';
import { createRedactor } from './logging/redact';
import { ServerLogger } from './logging/ServerLogger';
import { createSourceHttp } from './sources/http';

// 소스(`server/src`)와 번들(`server/dist`) 양쪽에서 `server/` 를 가리킨다.
const serverDir = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(serverDir, '..');

const env = mergeEnv(process.env, readEnvLocal(path.join(repoRoot, '.env.local')));
const config = loadConfig({ serverDir, env });
const redact = createRedactor(secretValues(config));
const logger = new ServerLogger('server', {
  minLevel: config.logLevel,
  format: config.logFormat,
  redact,
});

const db = openDatabase({ path: config.dbPath });
const migrated = runMigrations(db, config.migrationsDir, logger.child('db'));
logger.info('database ready', {
  path: config.dbPath,
  schemaVersion: migrated.version,
  applied: migrated.applied.length,
});

const startedAt = Date.now();
const repos = createRepos(db);
const hub = new EventHub();
const sourceHttp = createSourceHttp({ redact });
const app = createApp({ config, db, logger, redact, startedAt, repos, hub, sourceHttp });
const jobs = createJobs({ config, repos, hub, http: sourceHttp, logger, redact });

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  logger.info('listening', {
    port: info.port,
    host: config.host,
    allowedOrigins: config.allowedOrigins,
    rateLimitPerMinute: config.rateLimitPerMinute,
    jobsEnabled: config.jobsEnabled,
  });
  if (config.jobsEnabled) void jobs.start();
  else logger.warn('JOBS_ENABLED=false — 폴러를 시작하지 않는다');
});

let closing = false;
function shutdown(signal: string): void {
  if (closing) return;
  closing = true;
  logger.info('shutting down', { signal });
  jobs.stop();
  hub.closeAll();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  // 열린 SSE 연결이 close 를 붙잡지 않게 한다.
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
