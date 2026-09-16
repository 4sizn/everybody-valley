import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { type Db, openDatabase } from '../src/db/Database';
import { runMigrations } from '../src/db/migrate';
import { createRepos, type Repos } from '../src/db/repos';
import { EventHub } from '../src/events/EventHub';
import { identityRedactor } from '../src/logging/redact';
import { ServerLogger } from '../src/logging/ServerLogger';
import { createSourceHttp } from '../src/sources/http';

const SERVER_DIR = path.resolve(import.meta.dirname, '..');
const VWORLD_KEY = 'VW-TEST-KEY-1234567890';

const BASIN_GEOM = {
  type: 'Polygon',
  coordinates: [
    [
      [127.2, 37.8],
      [127.3, 37.8],
      [127.3, 37.9],
      [127.2, 37.9],
      [127.2, 37.8],
    ],
  ],
};

let db: Db;
let repos: Repos;
let hub: EventHub;
let calls: string[];
let app: ReturnType<typeof createApp>;

function build(env: Record<string, string> = {}): void {
  const config = loadConfig({
    serverDir: SERVER_DIR,
    env: { DB_PATH: ':memory:', VWORLD_API_KEY: VWORLD_KEY, ...env },
  });
  db = openDatabase({ path: ':memory:' });
  runMigrations(db, config.migrationsDir);
  repos = createRepos(db);
  hub = new EventHub({ heartbeatMs: 50 });
  calls = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('lt_c_wkmsbsn')) {
      return new Response(
        JSON.stringify({
          features: [
            {
              properties: {
                sbsncd: '101802',
                sbsnnm: '퇴계원수위표',
                mbsncd: '1018',
                bbsncd: '10',
              },
              geometry: BASIN_GEOM,
            },
          ],
        }),
        { status: 200 },
      );
    }
    return new Response('nope', { status: 404 });
  };
  app = createApp({
    config,
    db,
    logger: new ServerLogger('t', { sink: () => {} }),
    redact: identityRedactor,
    startedAt: 0,
    repos,
    hub,
    fetch: fetchImpl,
    sourceHttp: createSourceHttp({ fetch: fetchImpl, redact: identityRedactor }),
  });
}

function seed(): void {
  const now = '2026-09-06T04:12:00.000Z';
  repos.stations.upsertMany(
    [
      {
        kind: 'hrfco-waterlevel',
        code: '1022670',
        name: '연천군(신천교)',
        agency: 'x',
        lng: 127.06,
        lat: 37.96,
        elevationM: 40,
        attrs: { attwl: 3.5 },
        suspicious: false,
      },
      {
        kind: 'hrfco-rainfall',
        code: '10224050',
        name: '양주시(봉암초교)',
        agency: 'x',
        lng: 127.05,
        lat: 37.9,
        elevationM: null,
        attrs: null,
        suspicious: false,
      },
      {
        kind: 'aws',
        code: '454',
        name: '하봉암',
        agency: '기상청 AWS',
        lng: 127.0611,
        lat: 37.9372,
        elevationM: 108,
        attrs: null,
        suspicious: false,
      },
    ],
    now,
  );
  repos.latest.upsertMany(
    [
      {
        kind: 'hrfco-waterlevel',
        code: '1022670',
        observedAt: '2026-09-06T04:10:00.000Z',
        value: 2.31,
        extra: { fw: 10 },
      },
      {
        kind: 'hrfco-rainfall',
        code: '10224050',
        observedAt: '2026-09-06T04:10:00.000Z',
        value: 0.5,
        extra: null,
      },
      {
        kind: 'aws',
        code: '454',
        observedAt: '2026-09-06T04:11:00.000Z',
        value: 12.5,
        extra: { rn15: 1.5 },
      },
      { kind: 'aws', code: '42', observedAt: '2026-09-06T04:11:00.000Z', value: 0, extra: null },
    ],
    now,
  );
}

beforeEach(() => {
  build();
  seed();
});
afterEach(() => {
  hub.closeAll();
  db.close();
  vi.useRealTimers();
});

describe('/api/hydro', () => {
  it('stations: kind·bbox 필터, 십진도 좌표·attrs 포함', async () => {
    const all = (await (await app.request('/api/hydro/stations')).json()) as {
      count: number;
      stations: { code: string }[];
    };
    expect(all.count).toBe(2);
    const wl = (await (await app.request('/api/hydro/stations?kind=waterlevel')).json()) as {
      stations: Record<string, unknown>[];
    };
    expect(wl.stations).toHaveLength(1);
    expect(wl.stations[0]).toMatchObject({ code: '1022670', lng: 127.06, attrs: { attwl: 3.5 } });
    const boxed = (await (
      await app.request('/api/hydro/stations?bbox=127,37.95,128,38')
    ).json()) as { count: number };
    expect(boxed.count).toBe(1);
    expect((await app.request('/api/hydro/stations?bbox=1,2,3')).status).toBe(400);
    expect((await app.request('/api/hydro/stations?kind=bogus')).status).toBe(400);
  });

  it('latest: stations 목록으로 고르고 관측 시각 UTC', async () => {
    const res = await app.request('/api/hydro/latest?stations=1022670,10224050,none');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('max-age=300');
    const body = (await res.json()) as {
      count: number;
      observedAt: string;
      observations: Record<string, unknown>[];
    };
    expect(body.count).toBe(2);
    expect(body.observedAt).toBe('2026-09-06T04:10:00.000Z');
    expect(body.observations[0]).toMatchObject({
      kind: 'hrfco-rainfall',
      code: '10224050',
      value: 0.5,
    });
    expect(body.observations[1]).toMatchObject({
      kind: 'hrfco-waterlevel',
      code: '1022670',
      value: 2.31,
      extra: { fw: 10 },
    });
    expect((await app.request('/api/hydro/latest?stations=,')).status).toBe(400);
  });
});

describe('/api/aws', () => {
  it('latest?stns= 와 stations', async () => {
    const body = (await (await app.request('/api/aws/latest?stns=454')).json()) as {
      count: number;
      observations: Record<string, unknown>[];
    };
    expect(body.count).toBe(1);
    expect(body.observations[0]).toMatchObject({ code: '454', value: 12.5, extra: { rn15: 1.5 } });
    const all = (await (await app.request('/api/aws/latest')).json()) as { count: number };
    expect(all.count).toBe(2);
    const st = (await (await app.request('/api/aws/stations')).json()) as {
      stations: Record<string, unknown>[];
    };
    expect(st.stations[0]).toMatchObject({ code: '454', name: '하봉암', elevationM: 108 });
  });
});

describe('/api/basins', () => {
  it('저장된 폴리곤이 있으면 db 에서, 캐시 가능', async () => {
    repos.basins.replaceAll([
      {
        sbsncd: '101802',
        sbsnnm: '퇴계원수위표',
        mbsncd: '1018',
        bbsncd: '10',
        geometry: BASIN_GEOM,
        source: 'test',
        collectedAt: 'x',
      },
    ]);
    const res = await app.request('/api/basins?lng=127.25&lat=37.85&geometry=1');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('max-age=86400');
    expect(await res.json()).toMatchObject({
      source: 'db',
      stored: true,
      basin: { sbsncd: '101802' },
      geometry: BASIN_GEOM,
    });
    expect(calls).toHaveLength(0);
  });

  it('없으면 브이월드 조회(저장 안 함, no-store, 위도·경도 BBOX)', async () => {
    const res = await app.request('/api/basins?lng=127.25&lat=37.85');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      source: 'vworld',
      stored: false,
      basin: { sbsncd: '101802', mbsncd: '1018' },
    });
    expect(body).not.toHaveProperty('geometry');
    expect(calls).toHaveLength(1);
    const u = new URL(calls[0] ?? '');
    expect(u.pathname).toBe('/req/wfs');
    expect(u.searchParams.get('TYPENAME')).toBe('lt_c_wkmsbsn');
    expect(u.searchParams.get('BBOX')).toMatch(/^37\.8497,127\.2497,37\.8503,127\.2503,EPSG:4326$/);
    expect(u.searchParams.get('key')).toBe(VWORLD_KEY);
    expect(repos.basins.count()).toBe(0);
  });

  it('잘못된 점은 400, 키도 저장도 없으면 404', async () => {
    expect((await app.request('/api/basins?lng=abc&lat=1')).status).toBe(400);
    hub.closeAll();
    db.close();
    build({ VWORLD_API_KEY: '' });
    expect((await app.request('/api/basins?lng=127.25&lat=37.85')).status).toBe(404);
  });
});

describe('/api/events (SSE)', () => {
  it('hello → 채널 이벤트 → heartbeat, no-store', async () => {
    const res = await app.request('/api/events?channel=aws');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('cache-control')).toMatch(/no-(cache|store)/);
    const reader = res.body?.getReader();
    if (!reader) throw new Error('no body');
    const decoder = new TextDecoder();
    let buf = '';
    const readUntil = async (needle: string): Promise<void> => {
      while (!buf.includes(needle)) {
        const { value, done } = await reader.read();
        if (done) throw new Error(`stream ended before ${needle}`);
        buf += decoder.decode(value, { stream: true });
      }
    };
    await readUntil('event: hello');
    expect(hub.size).toBe(1);
    hub.publish('hydro', { waterlevel: 1 });
    hub.publish('aws', { stations: 736 });
    await readUntil('event: aws');
    expect(buf).not.toContain('event: hydro');
    expect(buf).toMatch(/data: \{"channel":"aws".*"stations":736/);
    await readUntil('event: heartbeat');
    await reader.cancel();
  });
});
