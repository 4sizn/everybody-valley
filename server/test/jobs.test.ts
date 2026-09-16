import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Db, openDatabase } from '../src/db/Database';
import { runMigrations } from '../src/db/migrate';
import { createRepos, type Repos } from '../src/db/repos';
import { EventHub } from '../src/events/EventHub';
import { createAwsRun } from '../src/jobs/awsJob';
import { loadBasinsOnce } from '../src/jobs/basinsJob';
import { createHrfcoRun } from '../src/jobs/hrfcoJob';
import { PollJob } from '../src/jobs/PollJob';
import { createStationsRun } from '../src/jobs/stationsJob';
import { identityRedactor } from '../src/logging/redact';
import { ServerLogger } from '../src/logging/ServerLogger';
import { createSourceHttp, type SourceHttp } from '../src/sources/http';

const MIGRATIONS = path.resolve(import.meta.dirname, '../migrations');
const KEY = 'HRFCO-TEST-KEY-0000000000';

let db: Db;
let repos: Repos;
let logger: ServerLogger;
let lines: string[];

beforeEach(() => {
  db = openDatabase({ path: ':memory:' });
  runMigrations(db, MIGRATIONS);
  repos = createRepos(db);
  lines = [];
  logger = new ServerLogger('t', { sink: (_l, line) => lines.push(line) });
});
afterEach(() => {
  db.close();
  vi.useRealTimers();
});

/** URL 조각 → 응답 본문. 매칭 안 되면 404. */
function fakeHttp(routes: Record<string, string | (() => string)>): {
  http: SourceHttp;
  calls: string[];
} {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    for (const [needle, body] of Object.entries(routes)) {
      if (url.includes(needle)) {
        return new Response(typeof body === 'function' ? body() : body, { status: 200 });
      }
    }
    return new Response('nope', { status: 404 });
  };
  return { http: createSourceHttp({ fetch: fetchImpl, redact: identityRedactor }), calls };
}

const AWS_TEXT = (minute: string) =>
  `#START7777\n# header\n${minute},454,0,0,0,0,0,0,24.1,1,1.5,12.5,30.0,44.0,90,1000,1005,20,=\n${minute},42,0,0,0,0,0,0,20,0,0,0,0,0,90,1000,1005,20,=\n#7777END\n`;

describe('PollJob', () => {
  it('시작 즉시 1회, 성공하면 주기 뒤 다시, 실패하면 백오프 뒤 다시 — 매 시도 fetch_log', async () => {
    vi.useFakeTimers({ now: 0 });
    let attempt = 0;
    const job = new PollJob({
      name: 'demo',
      intervalMs: 600_000,
      fetchLog: repos.fetchLog,
      logger,
      redact: identityRedactor,
      backoff: { baseMs: 30_000, maxMs: 600_000 },
      run: async () => {
        attempt += 1;
        if (attempt === 2) throw new Error('boom secret');
        return { rows: attempt, status: 200 };
      },
    });
    job.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(attempt).toBe(1);
    expect(job.nextRunAt).toBe(600_000);

    await vi.advanceTimersByTimeAsync(600_000);
    expect(attempt).toBe(2);
    expect(job.failures).toBe(1);
    expect(job.nextRunAt).toBe(600_000 + 30_000);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(attempt).toBe(3);
    expect(job.failures).toBe(0);

    const log = repos.fetchLog.recent();
    expect(log.map((e) => [e.job, e.ok, e.rows, e.error])).toEqual([
      ['demo', true, 3, null],
      ['demo', false, null, 'boom secret'],
      ['demo', true, 1, null],
    ]);
    job.stop();
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(attempt).toBe(3);
  });

  it('runOnce 는 겹치지 않는다', async () => {
    let running = 0;
    let max = 0;
    const job = new PollJob({
      name: 'demo',
      intervalMs: 1000,
      fetchLog: repos.fetchLog,
      logger,
      redact: identityRedactor,
      run: async () => {
        running += 1;
        max = Math.max(max, running);
        await new Promise((r) => setTimeout(r, 5));
        running -= 1;
        return { rows: 0 };
      },
    });
    await Promise.all([job.runOnce(), job.runOnce(), job.runOnce()]);
    expect(max).toBe(1);
    expect(repos.fetchLog.recent()).toHaveLength(1);
  });
});

describe('hrfco run', () => {
  it('일괄 2 호출 → latest·observations 적재, 7일 밖 정리, SSE hydro 발행', async () => {
    const { http, calls } = fakeHttp({
      '/waterlevel/list/10M.json': JSON.stringify({
        content: [
          { wlobscd: '1001602', ymdhm: '202609061310', wl: '1.68', fw: ' ' },
          { wlobscd: '1022670', ymdhm: '202609061310', wl: '2.31', fw: '10' },
        ],
      }),
      '/rainfall/list/10M.json': JSON.stringify({
        content: [{ rfobscd: '10224050', ymdhm: '202609061310', rf: '0.5' }],
      }),
    });
    const hub = new EventHub();
    const received: string[] = [];
    hub.subscribe(['hydro'], (m) => {
      received.push(m.event);
    });
    const now = Date.parse('2026-09-06T04:12:00Z');
    repos.observations.upsertMany(
      [
        {
          kind: 'hrfco-rainfall',
          code: 'old',
          observedAt: '2026-08-01T00:00:00.000Z',
          value: 1,
          extra: null,
        },
      ],
      'x',
    );
    const run = createHrfcoRun({ key: KEY, http, repos, hub, now: () => now });
    const result = await run();
    expect(result.rows).toBe(3);
    expect(result.detail).toMatchObject({ observedAt: '2026-09-06T04:10:00.000Z', pruned: 1 });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain(`/${KEY}/waterlevel/list/10M.json`);
    expect(repos.latest.get(['hrfco-waterlevel'], ['1022670'])[0]).toMatchObject({
      value: 2.31,
      extra: { fw: 10 },
    });
    expect(repos.observations.count()).toBe(3);
    expect(received).toEqual(['hello', 'hydro']);
    hub.closeAll();
  });
});

describe('aws run', () => {
  it('10분 창 1 호출 → latest 전부·observations 는 10분 격자만, 잘린 응답은 실패', async () => {
    let complete = true;
    const { http, calls } = fakeHttp({
      'nph-aws2_min': () =>
        complete
          ? `${AWS_TEXT('202609061310')}`.replace(
              '#7777END\n',
              `${AWS_TEXT('202609061311').split('\n').slice(2, 4).join('\n')}\n#7777END\n`,
            )
          : 'partial\n202609061310,454,0,0,0,0,0,0,24.1,1,1.5,12.5,30.0,44.0,90,1000,1005,20,=\n',
    });
    const hub = new EventHub();
    const now = Date.parse('2026-09-06T04:11:30Z');
    const run = createAwsRun({ key: 'KMA-KEY', http, repos, hub, now: () => now });
    const result = await run();
    expect(calls[0]).toContain('tm1=202609061301&tm2=202609061311&stn=0');
    expect(result.rows).toBe(4);
    expect(result.detail).toMatchObject({
      observedAt: '2026-09-06T04:11:00.000Z',
      stations: 2,
      gridRows: 2,
    });
    expect(repos.observations.count()).toBe(2);
    expect(repos.latest.get(['aws'], ['454'])[0]?.observedAt).toBe('2026-09-06T04:11:00.000Z');

    complete = false;
    await expect(run()).rejects.toThrow(/7777END/);
    hub.closeAll();
  });
});

describe('stations run', () => {
  it('HRFCO 제원 2 + AWS 지점(EUC-KR) 적재, 키 없는 소스는 건너뛴다', async () => {
    const { http, calls } = fakeHttp({
      '/waterlevel/info.json': JSON.stringify({
        content: [
          {
            wlobscd: '1001602',
            obsnm: '평창군(송정교)',
            agcnm: 'x',
            lon: '128-33-04',
            lat: '37-37-27',
            gdt: '511',
          },
        ],
      }),
      '/rainfall/info.json': JSON.stringify({
        content: [
          { rfobscd: '10014010', obsnm: '강우A', agcnm: 'x', lon: '127-00-00', lat: '37-00-00' },
        ],
      }),
      'stn_inf.php': '# hdr\n 454 127.0611 37.9372 1 108.0 10 41 4180 HABONGAM Habongam\n',
    });
    const run = createStationsRun({ hrfcoKey: KEY, kmaKey: 'KMA', http, repos });
    const r = await run();
    expect(r.rows).toBe(3);
    expect(r.detail).toEqual({ 'hrfco-waterlevel': 1, 'hrfco-rainfall': 1, aws: 1 });
    expect(calls).toHaveLength(3);
    expect(repos.stations.list(['aws'])[0]).toMatchObject({ code: '454', name: 'HABONGAM' });

    const r2 = await createStationsRun({ hrfcoKey: undefined, kmaKey: 'KMA', http, repos })();
    expect(r2.detail).toEqual({ aws: 1 });
  });
});

describe('loadBasinsOnce', () => {
  const fc = JSON.stringify({
    features: [
      {
        properties: { sbsncd: '101802', sbsnnm: '퇴계원수위표', mbsncd: '1018', bbsncd: '10' },
        geometry: {
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
        },
      },
    ],
  });
  it('URL 이 없으면 건너뛰고, 있으면 적재하고, 이미 있으면 다시 받지 않는다', async () => {
    const { http, calls } = fakeHttp({ 'wamis-wfs': fc });
    const base = { http, repos, logger, redact: identityRedactor };
    expect(await loadBasinsOnce({ ...base, wfsUrl: undefined })).toEqual({
      kind: 'skipped',
      reason: 'no-url',
      count: 0,
    });
    expect(await loadBasinsOnce({ ...base, wfsUrl: 'https://example/wamis-wfs?x' })).toEqual({
      kind: 'loaded',
      count: 1,
    });
    expect(await loadBasinsOnce({ ...base, wfsUrl: 'https://example/wamis-wfs?x' })).toEqual({
      kind: 'skipped',
      reason: 'already-loaded',
      count: 1,
    });
    expect(calls).toHaveLength(1);
    expect(repos.basins.candidates(127.25, 37.85)).toHaveLength(1);
    expect(repos.basins.candidates(126, 36)).toHaveLength(0);
    expect(repos.fetchLog.recent()[0]).toMatchObject({ job: 'basins', ok: true, rows: 1 });
  });
  it('실패하면 fetch_log 에 남기고 저장하지 않는다', async () => {
    const { http } = fakeHttp({});
    const out = await loadBasinsOnce({
      http,
      repos,
      logger,
      redact: identityRedactor,
      wfsUrl: 'https://example/missing',
    });
    expect(out.kind).toBe('failed');
    expect(repos.basins.count()).toBe(0);
    expect(repos.fetchLog.recent()[0]).toMatchObject({ job: 'basins', ok: false, status: 404 });
  });
});
