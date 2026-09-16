import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { loadConfig, type ServerConfig } from '../src/config';
import { type Db, openDatabase } from '../src/db/Database';
import { runMigrations } from '../src/db/migrate';
import { FixedWindowRateLimiter } from '../src/http/rateLimit';
import { createRedactor } from '../src/logging/redact';
import { ServerLogger } from '../src/logging/ServerLogger';

const SERVER_DIR = path.resolve(import.meta.dirname, '..');
const KEY = 'TEST-VWORLD-KEY-000111';

interface Harness {
  db: Db;
  config: ServerConfig;
  lines: string[];
  calls: { url: URL; init: RequestInit | undefined }[];
  app: ReturnType<typeof createApp>;
}

function harness(
  overrides: { env?: Record<string, string>; upstream?: () => Response } = {},
): Harness {
  const config = loadConfig({
    serverDir: SERVER_DIR,
    env: {
      DB_PATH: ':memory:',
      VWORLD_API_KEY: KEY,
      RATE_LIMIT_PER_MIN: '3',
      ALLOWED_ORIGINS: 'http://localhost:8081,https://app.example',
      ...overrides.env,
    },
  });
  const db = openDatabase({ path: ':memory:' });
  runMigrations(db, config.migrationsDir);
  const lines: string[] = [];
  const redact = createRedactor([KEY]);
  const logger = new ServerLogger('test', { redact, sink: (_l, line) => lines.push(line) });
  const calls: Harness['calls'] = [];
  const upstream =
    overrides.upstream ??
    (() =>
      new Response('{"type":"FeatureCollection","features":[]}', {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'set-cookie': 'sid=leak',
          'cache-control': 'max-age=3600',
        },
      }));
  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({ url: new URL(String(input)), init });
    return upstream();
  };
  let t = 1_700_000_000_000;
  const app = createApp({
    config,
    db,
    logger,
    redact,
    startedAt: t,
    now: () => t++,
    fetch: fakeFetch,
    rateLimiter: new FixedWindowRateLimiter({ limit: 3, now: () => t }),
  });
  return { db, config, lines, calls, app };
}

let h: Harness;
beforeEach(() => {
  h = harness();
});
afterEach(() => {
  h.db.close();
});

describe('GET /healthz', () => {
  it('DB 상태·스키마 버전·키 유무·마지막 폴링(없으면 null)을 돌려준다', async () => {
    const res = await h.app.request('/healthz');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      ok: true,
      db: { ok: true, path: ':memory:' },
      lastPoll: { hydro: null, aws: null },
      keys: { vworld: true, hrfco: false, kma: false },
    });
    expect((body['db'] as { schemaVersion: number }).schemaVersion).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(body)).not.toContain(KEY);
  });

  it('fetch_log 에 성공 기록이 있으면 마지막 폴링 시각을 채운다', async () => {
    h.db
      .prepare(
        "INSERT INTO fetch_log (job, started_at, finished_at, ok, status, rows, duration_ms) VALUES ('hrfco', '2026-09-06T00:00:00Z', '2026-09-06T00:00:01Z', 1, 200, 10, 900), ('hrfco', '2026-09-06T00:10:00Z', '2026-09-06T00:10:02Z', 0, 500, NULL, 2000)",
      )
      .run();
    const body = (await (await h.app.request('/healthz')).json()) as { lastPoll: unknown };
    expect(body.lastPoll).toEqual({ hydro: '2026-09-06T00:00:01Z', aws: null });
  });
});

describe('ALL /api/vworld/*', () => {
  it('허용 서비스는 키·domain 을 넣어 업스트림으로 보내고 no-store 로 되돌린다', async () => {
    const res = await h.app.request(
      '/api/vworld/wfs?SERVICE=WFS&REQUEST=GetFeature&TYPENAME=lt_c_wkmsbsn&key=CLIENT-KEY',
      { headers: { accept: 'application/json', 'x-forwarded-for': '203.0.113.1' } },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(res.headers.get('x-upstream-service')).toBe('vworld:wfs');
    expect(await res.text()).toContain('FeatureCollection');

    expect(h.calls).toHaveLength(1);
    const call = h.calls[0];
    expect(call?.url.origin).toBe('https://api.vworld.kr');
    expect(call?.url.pathname).toBe('/req/wfs');
    expect(call?.url.searchParams.get('key')).toBe(KEY);
    expect(call?.url.searchParams.get('domain')).toBe('localhost');
    expect(call?.url.searchParams.get('TYPENAME')).toBe('lt_c_wkmsbsn');
    expect(call?.url.toString()).not.toContain('CLIENT-KEY');
    const headers = new Headers(call?.init?.headers);
    expect(headers.get('accept')).toBe('application/json');
    expect(headers.get('user-agent')).toContain('modu-valley-server');
  });

  it('로그 어디에도 서버 키가 나타나지 않는다', async () => {
    await h.app.request('/api/vworld/search?query=%EC%86%8C%EC%9A%94%EC%82%B0');
    expect(h.lines.length).toBeGreaterThan(0);
    for (const line of h.lines) expect(line).not.toContain(KEY);
    expect(h.lines.some((l) => l.includes('"service":"search"'))).toBe(true);
  });

  it('허용목록 밖 경로는 404, 허용되지 않은 메서드는 405, 업스트림 호출 없음', async () => {
    expect((await h.app.request('/api/vworld/data?x=1')).status).toBe(404);
    expect((await h.app.request('/api/vworld/req/image')).status).toBe(404);
    expect((await h.app.request('/api/vworld/wfs', { method: 'DELETE' })).status).toBe(405);
    expect(h.calls).toHaveLength(0);
  });

  it('POST 본문을 그대로 넘긴다(WFS XML)', async () => {
    const xml = '<GetFeature/>';
    const res = await h.app.request('/api/vworld/wfs', {
      method: 'POST',
      headers: { 'content-type': 'text/xml' },
      body: xml,
    });
    expect(res.status).toBe(200);
    const init = h.calls[0]?.init;
    expect(init?.method).toBe('POST');
    expect(Buffer.from(init?.body as ArrayBuffer).toString()).toBe(xml);
  });

  it('업스트림 실패는 502', async () => {
    h.db.close();
    h = harness({
      upstream: () => {
        throw new TypeError('fetch failed');
      },
    });
    const res = await h.app.request('/api/vworld/wms?LAYERS=x');
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'upstream_unavailable' });
  });

  it('키가 없으면 503 이고 업스트림을 부르지 않는다', async () => {
    h.db.close();
    h = harness({ env: { VWORLD_API_KEY: '' } });
    const res = await h.app.request('/api/vworld/wfs?x=1');
    expect(res.status).toBe(503);
    expect(h.calls).toHaveLength(0);
  });
});

describe('레이트리밋·CORS', () => {
  it('/api/* 는 IP 별 분당 한도를 넘으면 429 + RateLimit 헤더', async () => {
    const hit = (ip: string) =>
      h.app.request('/api/vworld/wfs?x=1', { headers: { 'x-forwarded-for': ip } });
    for (let i = 0; i < 3; i++) expect((await hit('10.0.0.1')).status).toBe(200);
    const blocked = await hit('10.0.0.1');
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('ratelimit-remaining')).toBe('0');
    expect(blocked.headers.get('retry-after')).toMatch(/^\d+$/);
    expect((await hit('10.0.0.2')).status).toBe(200);
    // /healthz 는 한도 밖
    expect(
      (await h.app.request('/healthz', { headers: { 'x-forwarded-for': '10.0.0.1' } })).status,
    ).toBe(200);
  });

  it('허용 오리진만 CORS 헤더를 받는다', async () => {
    const ok = await h.app.request('/healthz', { headers: { origin: 'https://app.example' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://app.example');
    const no = await h.app.request('/healthz', { headers: { origin: 'https://evil.example' } });
    expect(no.headers.get('access-control-allow-origin')).toBeNull();
    const preflight = await h.app.request('/api/vworld/wfs', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:8081', 'access-control-request-method': 'GET' },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
  });

  it('PATCH·DELETE 도 허용 메서드에 있다(제보 수정·삭제, OPS1 관리자 숨김/복구가 브라우저에서 실제로 쓴다)', async () => {
    const preflight = await h.app.request('/api/admin/reports/x/hidden', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:8081', 'access-control-request-method': 'PATCH' },
    });
    expect(preflight.status).toBe(204);
    const allowed = preflight.headers.get('access-control-allow-methods') ?? '';
    expect(allowed).toContain('PATCH');
    expect(allowed).toContain('DELETE');
  });

  it('모르는 경로는 JSON 404', async () => {
    const res = await h.app.request('/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});

describe('production web hosting', () => {
  it('serves the built page and assets without turning missing APIs into HTML', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'valley-web-'));
    writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>모두밸리</title>');
    writeFileSync(path.join(root, 'app.js'), '/* built app */');
    writeFileSync(path.join(root, 'app.js.gz'), gzipSync('/* built app */'));
    const web = harness({ env: { WEB_DIR: root } });
    try {
      const page = await web.app.request('/?valley=test');
      expect(page.status).toBe(200);
      expect(await page.text()).toContain('모두밸리');
      expect(page.headers.get('Cache-Control')).toBe('no-cache');
      const asset = await web.app.request('/app.js');
      expect(await asset.text()).toBe('/* built app */');
      const compressed = await web.app.request('/app.js', {
        headers: { 'accept-encoding': 'gzip' },
      });
      expect(compressed.headers.get('content-encoding')).toBe('gzip');
      expect(gunzipSync(Buffer.from(await compressed.arrayBuffer())).toString()).toBe(
        '/* built app */',
      );
      const missing = await web.app.request('/api/missing');
      expect(missing.status).toBe(404);
      expect(missing.headers.get('Content-Type')).toContain('application/json');
      const privateFile = await web.app.request('/.env.local');
      expect(privateFile.status).toBe(404);
    } finally {
      web.db.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
