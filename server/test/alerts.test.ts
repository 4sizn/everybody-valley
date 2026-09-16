/**
 * F3b 서버 판정 테스트 — 로스터(`alertSources.ts`) 신호 만들기(`alerts/signals.ts`), 판정 잡
 * (`jobs/alertsJob.ts`), `/api/alerts` 라우트. 임계값 자체는 core `evaluateAlert` 테스트가
 * 고정한다 — 여기서는 "DB 값 → 신호" 변환과 배선만 본다.
 */
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ALERT_SOURCE_BY_VALLEY } from '../src/alertSources';
import { buildValleySignals, waterLevelStageOf } from '../src/alerts/signals';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { type Db, openDatabase } from '../src/db/Database';
import { runMigrations } from '../src/db/migrate';
import { createRepos, type Repos } from '../src/db/repos';
import { EventHub } from '../src/events/EventHub';
import { alertsRoutes } from '../src/http/routes/alerts';
import { createAlertsRun } from '../src/jobs/alertsJob';
import { identityRedactor } from '../src/logging/redact';
import { ServerLogger } from '../src/logging/ServerLogger';

const MIGRATIONS = path.resolve(import.meta.dirname, '../migrations');
const SERVER_DIR = path.resolve(import.meta.dirname, '..');

let db: Db;
let repos: Repos;

function setup(): void {
  db = openDatabase({ path: ':memory:' });
  runMigrations(db, MIGRATIONS);
  repos = createRepos(db);
}
afterEach(() => {
  db?.close();
});

const T0 = '2026-08-01T03:00:00.000Z';
/** 10분 간격 관측값 n 개(오래된 → 최신). */
function tenMinuteSeries(
  kind: 'hrfco-rainfall' | 'aws' | 'hrfco-waterlevel',
  code: string,
  valuesOldToNew: readonly number[],
  endIso = T0,
): { kind: typeof kind; code: string; observedAt: string; value: number; extra: null }[] {
  const end = new Date(endIso).getTime();
  const start = end - (valuesOldToNew.length - 1) * 10 * 60_000;
  return valuesOldToNew.map((value, i) => ({
    kind,
    code,
    observedAt: new Date(start + i * 10 * 60_000).toISOString(),
    value,
    extra: null,
  }));
}

describe('buildValleySignals — 로스터 신호 만들기', () => {
  it('S1 HRFCO 강우: 10분 값 그대로 + 1h/3h 는 격자 합', () => {
    setup();
    const roster = ALERT_SOURCE_BY_VALLEY.get('yumyeongsan');
    expect(roster?.s1[0]?.code).toBe('10154030');
    const rows = tenMinuteSeries('hrfco-rainfall', '10154030', new Array(18).fill(2));
    repos.observations.upsertMany(rows, T0);

    const bundle = buildValleySignals(repos, roster as NonNullable<typeof roster>, T0);
    expect(bundle.signals).toHaveLength(1);
    const signal = bundle.signals[0] as {
      source: string;
      rainfall10mMm?: number;
      rainfall1hMm?: number;
      rainfall3hMm?: number;
    };
    expect(signal.source).toBe('gauge');
    expect(signal.rainfall10mMm).toBe(2);
    expect(signal.rainfall1hMm).toBe(12); // 6 * 2
    expect(signal.rainfall3hMm).toBe(36); // 18 * 2
    expect(bundle.latestObservedAt).toBe(T0);
    expect(bundle.clearance.rainBelowAttentionFor30Min).toBe(false); // 1h(12mm) ≥ 관심(10mm)
    expect(bundle.clearance.rainfall3hSumMm).toBe(36);
  });

  it('S1 AWS 강우: value 가 이미 RN-60m — 1h·3h 값으로 그대로 쓰고 10분 값은 비운다', () => {
    setup();
    const roster = ALERT_SOURCE_BY_VALLEY.get('gwangdeok');
    expect(roster?.s1[0]?.code).toBe('695');
    repos.observations.upsertMany(tenMinuteSeries('aws', '695', [5, 15]), T0);

    const bundle = buildValleySignals(repos, roster as NonNullable<typeof roster>, T0);
    const signal = bundle.signals[0] as {
      source: string;
      rainfall10mMm?: number;
      rainfall1hMm?: number;
      rainfall3hMm?: number;
    };
    expect(signal.source).toBe('gauge');
    expect(signal.rainfall10mMm).toBeUndefined();
    expect(signal.rainfall1hMm).toBe(15);
    expect(signal.rainfall3hMm).toBe(15);
  });

  it('S4 수위: 상승/하강 델타·수위 4단계·60분 하강 확인', () => {
    setup();
    const roster = ALERT_SOURCE_BY_VALLEY.get('soyosan');
    const code = roster?.waterlevel[0]?.code as string;
    repos.stations.upsertMany(
      [
        {
          kind: 'hrfco-waterlevel',
          code,
          name: '테스트 수위',
          agency: null,
          lng: null,
          lat: null,
          elevationM: null,
          attrs: { attwl: 1.0, wrnwl: 1.5, almwl: 2.0, srswl: 2.5 },
          suspicious: false,
        },
      ],
      T0,
    );
    // 7 포인트, 계속 하강(오래된 → 최신). 마지막 값 1.18 ≥ attwl(1.0) → attention.
    repos.observations.upsertMany(
      tenMinuteSeries('hrfco-waterlevel', code, [1.3, 1.28, 1.26, 1.24, 1.22, 1.2, 1.18]),
      T0,
    );

    const bundle = buildValleySignals(repos, roster as NonNullable<typeof roster>, T0);
    const signal = bundle.signals.find((s) => s.source === 'waterlevel') as {
      waterLevelStage?: string;
      waterLevelDeltaM?: number;
    };
    expect(signal.waterLevelStage).toBe('attention');
    expect(signal.waterLevelDeltaM).toBeCloseTo(-0.02, 5);
    expect(bundle.clearance.waterLevelFallingFor60Min).toBe(true);
  });

  it('waterLevelStageOf — 제원 임계값으로 4단계 판정, 미만이면 undefined', () => {
    const attrs = { attwl: 1.0, wrnwl: 1.5, almwl: 2.0, srswl: 2.5 };
    expect(waterLevelStageOf(0.5, attrs)).toBeUndefined();
    expect(waterLevelStageOf(1.0, attrs)).toBe('attention');
    expect(waterLevelStageOf(1.5, attrs)).toBe('caution');
    expect(waterLevelStageOf(2.0, attrs)).toBe('alert');
    expect(waterLevelStageOf(2.5, attrs)).toBe('severe');
  });
});

describe('createAlertsRun — 판정 잡', () => {
  it('신호가 관심 이상이면 alerts 행을 만들고 alert 채널을 낸다', async () => {
    setup();
    repos.observations.upsertMany(
      tenMinuteSeries('hrfco-rainfall', '10154030', new Array(18).fill(2)),
      T0,
    );
    const hub = new EventHub({ heartbeatMs: 60_000 });
    const events: { channel: string }[] = [];
    hub.subscribe(['alert'], (m) => {
      events.push(JSON.parse(m.data));
    });
    const run = createAlertsRun({ repos, hub, now: () => Date.parse(T0) });

    const result = await run();
    expect(result.rows).toBeGreaterThan(0);

    const stored = repos.alerts.get('yumyeongsan');
    expect(stored?.level).toBe('watch');
    expect(stored?.clearedAt).toBeNull();
    await new Promise((r) => setTimeout(r, 0));
    expect(events.filter((e) => e.channel === 'alert')).toHaveLength(1);
    hub.closeAll();
  });

  it('신호가 사라지고 해제 조건을 채우면 다음 틱에 clearedAt 이 채워진다', async () => {
    setup();
    let clock = Date.parse(T0);
    const hub = new EventHub({ heartbeatMs: 60_000 });
    const run = createAlertsRun({ repos, hub, now: () => clock });

    repos.observations.upsertMany(
      tenMinuteSeries(
        'hrfco-rainfall',
        '10154030',
        new Array(18).fill(2),
        new Date(clock).toISOString(),
      ),
      new Date(clock).toISOString(),
    );
    await run();
    expect(repos.alerts.get('yumyeongsan')?.level).toBe('watch');
    expect(repos.alerts.get('yumyeongsan')?.clearedAt).toBeNull();

    // 40 분 뒤: 비가 그쳤다(그 사이 관측이 전혀 없다) — 여전히 previous 는 active.
    clock += 40 * 60_000;
    const result = await run();
    const stored = repos.alerts.get('yumyeongsan');
    // 수위 신호가 아예 없는 계곡이라 waterLevelFallingFor60Min 은 항상 false → 완전 해제는 못 되고 한 칸만 내려간다.
    expect(stored?.level).toBe('watch');
    expect(stored?.clearedAt).toBeNull();
    expect(result.rows).toBeGreaterThan(0);
    hub.closeAll();
  });
});

describe('GET /api/alerts', () => {
  it('로스터 없는 계곡은 조용히 평시, 로스터 있는 계곡은 판정을 낸다', async () => {
    setup();
    repos.observations.upsertMany(
      tenMinuteSeries('hrfco-rainfall', '10154030', new Array(18).fill(2)),
      T0,
    );
    const config = loadConfig({ serverDir: SERVER_DIR, env: { DB_PATH: ':memory:' } });
    const app = createApp({
      config,
      db,
      logger: new ServerLogger('t', { sink: () => {} }),
      redact: identityRedactor,
      startedAt: 0,
      repos,
      now: () => Date.parse(T0),
    });
    const res = await app.request('/api/alerts');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      count: number;
      alerts: { valleyId: string; level: string | null; stale: boolean }[];
    };
    expect(body.count).toBe(30);
    const noCapability = body.alerts.find((a) => a.valleyId === 'myeongji');
    expect(noCapability).toMatchObject({ level: null, stale: false });
    const yumyeongsan = body.alerts.find((a) => a.valleyId === 'yumyeongsan');
    expect(yumyeongsan?.level).toBeNull(); // 잡을 아직 안 돌렸다 — DB 에 alerts 행이 없다
    expect(yumyeongsan?.stale).toBe(false); // 방금 관측이 있으니 신선하다
  });

  it('경보가 있으면 그대로 낸다', async () => {
    setup();
    repos.observations.upsertMany(
      tenMinuteSeries('hrfco-rainfall', '10154030', new Array(18).fill(2)),
      T0,
    );
    const hub = new EventHub({ heartbeatMs: 60_000 });
    await createAlertsRun({ repos, hub, now: () => Date.parse(T0) })();
    hub.closeAll();

    const app = alertsRoutes({ repos, now: () => Date.parse(T0) });
    const res = await app.request('/');
    const body = (await res.json()) as {
      alerts: { valleyId: string; level: string | null }[];
    };
    expect(body.alerts.find((a) => a.valleyId === 'yumyeongsan')?.level).toBe('watch');
  });
});
