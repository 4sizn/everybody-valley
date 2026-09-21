/**
 * Hono 앱 조립. 리슨하지 않으므로 테스트가 `app.request()` 로 통째로 부를 수 있다.
 *
 * 미들웨어 순서: 요청 로그 → CORS(`ALLOWED_ORIGINS`) → `/api/*` 레이트리밋 → 라우트.
 * `/api/admin/*` 는 그 위에 전용 레이트리밋(토큰 추측 방어) + 인증(`adminAuth`)이 더 걸린다.
 */
import { serveStatic } from '@hono/node-server/serve-static';
import type { LngLat, Logger } from '@modu-valley/core';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { keyPresence, type ServerConfig } from './config';
import type { Db } from './db/Database';
import { createRepos, type Repos } from './db/repos';
import { EventHub } from './events/EventHub';
import { adminAuth } from './http/adminAuth';
import {
  FixedWindowRateLimiter,
  type RateLimiter,
  rateLimit,
  TieredRateLimiter,
} from './http/rateLimit';
import { requestLog } from './http/requestLog';
import { accessRoutes } from './http/routes/access';
import { adminRoutes } from './http/routes/admin';
import { alertsRoutes } from './http/routes/alerts';
import { awsRoutes } from './http/routes/aws';
import { basinsRoutes } from './http/routes/basins';
import { discoveryAdminRoutes, discoveryRoutes } from './http/routes/discovery';
import { eventsRoutes } from './http/routes/events';
import { foliageRoutes } from './http/routes/foliage';
import { healthRoutes } from './http/routes/healthz';
import { hydroRoutes } from './http/routes/hydro';
import { landRoutes } from './http/routes/land';
import { reportsRoutes } from './http/routes/reports';
import { uploadsRoutes } from './http/routes/uploads';
import { vworldRoutes } from './http/routes/vworld';
import type { Redactor } from './logging/redact';
import { createSourceHttp, type SourceHttp } from './sources/http';
import { loadValleyCenterlines, loadValleyElevations, loadValleyIds } from './valleys';

export interface AppDeps {
  readonly config: ServerConfig;
  readonly db: Db;
  readonly logger: Logger;
  readonly redact: Redactor;
  readonly startedAt: number;
  readonly now?: () => number;
  readonly fetch?: typeof fetch;
  readonly rateLimiter?: FixedWindowRateLimiter;
  readonly repos?: Repos;
  readonly hub?: EventHub;
  readonly sourceHttp?: SourceHttp;
  /** 제보 쓰기 전용 레이트리밋(결정 (h)). 기본은 `config` 의 10분·하루 한도로 만든다. */
  readonly reportsRateLimiter?: RateLimiter;
  /** 관리자 API 전용 레이트리밋(OPS1, 토큰 추측 방어). 기본은 `config.adminRateLimitPerMinute`. */
  readonly adminRateLimiter?: RateLimiter;
  /** `data/valleys/*.geojson` 에서 읽은 유효 계곡 id. 기본은 `config.valleysDir` 를 읽는다(테스트에서 주입 가능). */
  readonly knownValleyIds?: ReadonlySet<string>;
  /** 계곡별 중심선(F5d 좌표 반경 검증). 기본은 `config.valleysDir` 를 읽는다(테스트에서 주입 가능). */
  readonly valleyCenterlines?: ReadonlyMap<string, readonly LngLat[]>;
}

export function createApp(deps: AppDeps): Hono {
  const { config, logger, redact } = deps;
  const now = deps.now ?? Date.now;
  const repos = deps.repos ?? createRepos(deps.db);
  const hub = deps.hub ?? new EventHub({ now });
  const sourceHttp =
    deps.sourceHttp ?? createSourceHttp({ redact, ...(deps.fetch ? { fetch: deps.fetch } : {}) });
  const vworld =
    config.vworld.key !== undefined
      ? { key: config.vworld.key, domain: config.vworld.domain }
      : undefined;
  const app = new Hono();

  app.use(requestLog({ logger: logger.child('http'), redact, trustProxy: config.trustProxy, now }));
  app.use(
    cors({
      origin: (origin) => (config.allowedOrigins.includes(origin) ? origin : null),
      // PATCH·DELETE — 제보 수정·삭제(F5b)와 관리자 숨김/복구(OPS1)가 브라우저에서 실제로
      // 이 메서드를 쓴다. 예전엔 GET/HEAD/POST/OPTIONS 만 허용해 실제 호출은 없이 preflight
      // 만 통과하고 본 요청이 브라우저에 조용히 막히는 구멍이 있었다(실측: OPS1 관리자
      // 숨김을 실제 브라우저로 눌러 보고서야 드러났다 — Hono 단위 테스트는 Origin 헤더
      // 없이 라우트를 직접 부르므로 이 CORS 제약을 통과하지 않아 잡지 못했다).
      allowMethods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      maxAge: 600,
    }),
  );
  app.use(
    '/api/*',
    rateLimit({
      limiter:
        deps.rateLimiter ?? new FixedWindowRateLimiter({ limit: config.rateLimitPerMinute, now }),
      trustProxy: config.trustProxy,
    }),
  );

  app.route(
    '/healthz',
    healthRoutes({
      db: deps.db,
      dbPath: config.dbPath,
      keys: keyPresence(config),
      startedAt: deps.startedAt,
      now,
    }),
  );
  const valleyCenterlines = deps.valleyCenterlines ?? loadValleyCenterlines(config.valleysDir);
  app.route('/api/land', landRoutes(vworld, valleyCenterlines, deps.fetch));
  app.route(
    '/api/vworld',
    vworldRoutes({
      credentials: vworld,
      logger: logger.child('vworld'),
      redact,
      ...(deps.fetch !== undefined ? { fetch: deps.fetch } : {}),
      now,
    }),
  );
  app.route('/api/hydro', hydroRoutes(repos, Math.round(config.hrfcoIntervalMs / 2000)));
  app.route('/api/aws', awsRoutes(repos, Math.round(config.awsIntervalMs / 2000)));
  app.route(
    '/api/basins',
    basinsRoutes({ repos, http: sourceHttp, vworld, logger: logger.child('basins'), redact }),
  );
  app.route('/api/alerts', alertsRoutes({ repos, ...(deps.now ? { now: deps.now } : {}) }));
  app.route(
    '/api/foliage',
    foliageRoutes({
      repos,
      valleyCenterlines,
      valleyElevations: loadValleyElevations(config.valleysDir),
      ...(deps.now ? { now: deps.now } : {}),
    }),
  );
  app.route(
    '/api/access',
    accessRoutes({
      accessDir: config.accessDir,
      valleyIds: new Set(valleyCenterlines.keys()),
      ...(deps.now ? { now: deps.now } : {}),
    }),
  );
  app.route(
    '/api/reports',
    reportsRoutes({
      repos,
      hub,
      uploadsDir: config.uploadsDir,
      knownValleyIds: deps.knownValleyIds ?? loadValleyIds(config.valleysDir),
      valleyCenterlines,
      logger: logger.child('reports'),
      trustProxy: config.trustProxy,
      rateLimiter:
        deps.reportsRateLimiter ??
        new TieredRateLimiter({
          windows: [
            { limit: config.reportsRateLimitPer10Min, windowMs: 10 * 60_000 },
            { limit: config.reportsRateLimitPerDay, windowMs: 24 * 60 * 60_000 },
          ],
          now,
        }),
      ...(deps.now ? { now: deps.now } : {}),
    }),
  );
  app.route('/uploads', uploadsRoutes(config.uploadsDir));
  app.route('/api/events', eventsRoutes(hub));
  const discovery = {
    db: deps.db,
    knownValleyIds: deps.knownValleyIds ?? loadValleyIds(config.valleysDir),
    now,
    trustProxy: config.trustProxy,
  };
  app.route('/api/discovery', discoveryRoutes(discovery));

  // 관리자 API(OPS1) — 전용 레이트리밋(토큰 추측 방어) 다음 인증. `ADMIN_TOKEN` 미설정이면
  // `adminAuth` 가 인증 이전에 404 로 막아 관리자 API 가 없는 것처럼 군다.
  app.use(
    '/api/admin/*',
    rateLimit({
      limiter:
        deps.adminRateLimiter ??
        new FixedWindowRateLimiter({ limit: config.adminRateLimitPerMinute, now }),
      trustProxy: config.trustProxy,
    }),
  );
  app.use('/api/admin/*', adminAuth({ token: config.adminToken }));
  app.route('/api/admin/discovery', discoveryAdminRoutes(discovery));
  app.route('/api/admin', adminRoutes({ repos, logger: logger.child('admin') }));

  if (config.webDir) {
    const serveWeb = serveStatic({
      root: config.webDir,
      precompressed: true,
      rewriteRequestPath: (path) => (path === '/firework' ? '/firework.html' : path),
    });
    app.on(['GET', 'HEAD'], '*', (c, next) => {
      if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/uploads/')) return next();
      c.header('X-Content-Type-Options', 'nosniff');
      c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
      c.header(
        'Cache-Control',
        /\.[a-z0-9]+$/i.test(c.req.path) && !c.req.path.endsWith('.html')
          ? 'public, max-age=3600'
          : 'no-cache',
      );
      return serveWeb(c, next);
    });
  }

  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError((error, c) => {
    logger.error('unhandled', error, { path: c.req.path });
    return c.json({ error: 'internal' }, 500);
  });
  return app;
}
