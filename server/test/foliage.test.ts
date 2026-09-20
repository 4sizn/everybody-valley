/**
 * 단풍 배선 테스트 — AWS 매분 행 → `daily_temps` 접기(`DailyTempsRepo.fold`), 계곡 중심 근처
 * 관측소 고르기 + 일별 중앙값 + `/api/foliage` 응답. 단계 문턱은 core `foliage.test.ts` 가 고정한다.
 */
import path from 'node:path';
import { LngLat } from '@modu-valley/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Db, openDatabase } from '../src/db/Database';
import { runMigrations } from '../src/db/migrate';
import { createRepos, kstDayOf, type Repos } from '../src/db/repos';
import { foliageRoutes } from '../src/http/routes/foliage';

const MIGRATIONS = path.resolve(import.meta.dirname, '../migrations');

let db: Db;
let repos: Repos;
beforeEach(() => {
  db = openDatabase({ path: ':memory:' });
  runMigrations(db, MIGRATIONS);
  repos = createRepos(db);
});
afterEach(() => db.close());

const NOW = '2026-10-20T03:00:00.000Z';
const T = (iso: string, code: string, ta: number | null) => ({
  kind: 'aws' as const,
  code,
  observedAt: iso,
  value: 0,
  extra: { ta },
});

describe('DailyTempsRepo.fold', () => {
  it('같은 KST 날의 행을 MIN/MAX 로 접고, 결측 기온은 건너뛴다', () => {
    // 2026-10-20T03:00Z = KST 12:00, 2026-10-19T16:00Z = KST 10-20 01:00 → 같은 날.
    const n = repos.dailyTemps.fold(
      [
        T('2026-10-19T16:00:00.000Z', '454', 3.2),
        T('2026-10-20T03:00:00.000Z', '454', 14.8),
        T('2026-10-20T03:01:00.000Z', '454', null),
        T('2026-10-19T14:59:00.000Z', '454', 8), // KST 10-19 23:59 → 전날
      ],
      NOW,
    );
    expect(n).toBe(3);
    expect(repos.dailyTemps.series('aws', '454', '2026-10-01')).toEqual([
      { kind: 'aws', code: '454', day: '2026-10-19', tminC: 8, tmaxC: 8, samples: 1 },
      { kind: 'aws', code: '454', day: '2026-10-20', tminC: 3.2, tmaxC: 14.8, samples: 2 },
    ]);
    expect(repos.dailyTemps.prune('2026-10-20')).toBe(1);
  });
});

describe('GET /api/foliage', () => {
  it('15 km 안 AWS 3곳의 일별 중앙값으로 판정, 관측소 없는 계곡은 none', async () => {
    const center = LngLat.of(127.0, 37.7);
    const line = [LngLat.of(126.99, 37.69), center, LngLat.of(127.01, 37.71)];
    repos.stations.upsertMany(
      [
        {
          kind: 'aws',
          code: 'A',
          name: '가까움',
          agency: null,
          lng: 127.0,
          lat: 37.71,
          elevationM: 300,
          attrs: null,
          suspicious: false,
        },
        {
          kind: 'aws',
          code: 'B',
          name: '중간',
          agency: null,
          lng: 127.05,
          lat: 37.7,
          elevationM: 100,
          attrs: null,
          suspicious: false,
        },
        {
          kind: 'aws',
          code: 'C',
          name: '먼편',
          agency: null,
          lng: 127.1,
          lat: 37.7,
          elevationM: 50,
          attrs: null,
          suspicious: false,
        },
        {
          kind: 'aws',
          code: 'D',
          name: '너무멂',
          agency: null,
          lng: 127.5,
          lat: 37.7,
          elevationM: 50,
          attrs: null,
          suspicious: false,
        },
        {
          kind: 'aws',
          code: 'E',
          name: '4번째',
          agency: null,
          lng: 127.12,
          lat: 37.7,
          elevationM: 50,
          attrs: null,
          suspicious: false,
        },
      ],
      NOW,
    );
    // 10-05 부터 찬 날 연속: A 는 2℃, B 는 4℃, C 는 9℃(중앙값 4 → 찬 날), D·E 는 안 잡힌다.
    for (let i = 0; i < 15; i += 1) {
      const day = `2026-10-${String(5 + i).padStart(2, '0')}`;
      const iso = `${day}T12:00:00.000Z`; // KST 21:00 같은 날
      repos.dailyTemps.fold(
        [T(iso, 'A', 2), T(iso, 'B', 4), T(iso, 'C', 9), T(iso, 'D', -5), T(iso, 'E', -5)],
        NOW,
      );
    }
    const app = foliageRoutes({
      repos,
      valleyCenterlines: new Map([
        ['near', line],
        ['island', [LngLat.of(126.3, 33.4), LngLat.of(126.31, 33.41)]],
      ]),
      now: () => Date.parse(NOW),
    });
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      today: string;
      foliage: {
        valleyId: string;
        stage: string;
        confidence: string;
        stations: { code: string }[];
        peakStart: string | null;
      }[];
    };
    expect(body.today).toBe(kstDayOf(NOW));
    const near = body.foliage.find((f) => f.valleyId === 'near');
    expect(near?.stations.map((s) => s.code)).toEqual(['A', 'B', 'C']);
    // 찬 날 10일 누적 → 10-14 절정 시작, 오늘(10-20)은 절정.
    expect(near).toMatchObject({ stage: 'peak', peakStart: '2026-10-14', confidence: 'observed' });
    const island = body.foliage.find((f) => f.valleyId === 'island');
    expect(island).toMatchObject({ stage: 'green', confidence: 'none', stations: [] });
  });
});
