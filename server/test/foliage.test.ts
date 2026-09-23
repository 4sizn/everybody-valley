/**
 * 단풍 배선 — 계절관측 파서, 관서·유명산 지점 고르기, `/api/foliage`. 단계 규칙은 core 가 고정한다.
 */
import path from 'node:path';
import { LngLat } from '@modu-valley/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Db, openDatabase } from '../src/db/Database';
import { runMigrations } from '../src/db/migrate';
import { createRepos, type Repos } from '../src/db/repos';
import { foliageRoutes } from '../src/http/routes/foliage';
import { createSeasonRun } from '../src/jobs/seasonJob';
import { identityRedactor } from '../src/logging/redact';
import { createSourceHttp } from '../src/sources/http';
import { parseSeasonNorm, parseSeasonObs } from '../src/sources/kmaSeason';

const MIGRATIONS = path.resolve(import.meta.dirname, '../migrations');
let db: Db;
let repos: Repos;
beforeEach(() => {
  db = openDatabase({ path: ':memory:' });
  runMigrations(db, MIGRATIONS);
  repos = createRepos(db);
});
afterEach(() => db.close());

const station = (code: string, name: string, lng: number, lat: number) => ({
  kind: 'aws' as const,
  code,
  name,
  agency: null,
  lng,
  lat,
  elevationM: null,
  attrs: null,
  suspicious: false,
});

describe('parseSeasonObs / parseSeasonNorm', () => {
  it('# 주석 건너뛰고 YY STN TM SSN_ID SSN_MD 를 읽는다(공백·쉼표 모두)', () => {
    const text =
      '# YY STN TM SSN_ID SSN_MD\n2026  98 20261018 302 301\n2026,98,20261029,302,302,=\nbad line\n';
    expect(parseSeasonObs(text)).toEqual([
      { stn: '98', tm: '2026-10-18', ssnId: 302, ssnMd: 301 },
      { stn: '98', tm: '2026-10-29', ssnId: 302, ssnMd: 302 },
    ]);
  });
  it('평년 ST STN MM DD SSN_ID SSN_MD → MM-DD', () => {
    expect(
      parseSeasonNorm(
        '# ST,  STN,  MM,  DD, SSN_ID, SSN_MD,=\n 2021,  98,  10,  21,    302,    301,=\n 2021, 102,  11,   5,    302,    302,=\n',
      ),
    ).toEqual([
      { stn: '98', ssnId: 302, ssnMd: 301, mmdd: '10-21' },
      { stn: '102', ssnId: 302, ssnMd: 302, mmdd: '11-05' },
    ]);
  });
});

describe('GET /api/foliage', () => {
  it('가까운 관서(302)와 유명산(501) 관측을 합쳐 판정, 평년은 유명산 우선, 지점 없으면 none', async () => {
    repos.stations.upsertMany(
      [
        station('98', '동두천', 127.06, 37.9), // 관서, 계곡에서 ~6 km
        station('108', '서울', 126.97, 37.57), // 관서, 더 멂
        station('901', '북한산', 126.99, 37.66), // 유명산, ~27 km → 25 km 밖
      ],
      '2026-10-20T00:00:00.000Z',
    );
    const at = '2026-10-20T03:00:00.000Z';
    repos.seasonObs.upsertMany(
      [
        { stn: '98', tm: '2026-10-18', ssnId: 302, ssnMd: 301 },
        { stn: '108', tm: '2026-10-10', ssnId: 302, ssnMd: 301 },
        { stn: '108', tm: '2026-10-19', ssnId: 302, ssnMd: 302 },
        { stn: '901', tm: '2026-10-15', ssnId: 501, ssnMd: 501 },
      ],
      at,
    );
    repos.seasonNorm.upsertMany(
      [
        { stn: '98', ssnId: 302, ssnMd: 301, mmdd: '10-21' },
        { stn: '98', ssnId: 302, ssnMd: 302, mmdd: '10-30' },
      ],
      at,
    );
    const app = foliageRoutes({
      repos,
      valleyCenterlines: new Map([
        ['soyosan', [LngLat.of(127.08, 37.94), LngLat.of(127.09, 37.95)]],
        ['island', [LngLat.of(126.3, 33.4), LngLat.of(126.31, 33.41)]],
      ]),
      now: () => Date.parse(at),
    });
    const body = (await (await app.request('/')).json()) as {
      foliage: {
        valleyId: string;
        stage: string;
        confidence: string;
        observedAt: string | null;
        normals: Record<string, string>;
        stations: { code: string; ssnId: number }[];
      }[];
    };
    const soyo = body.foliage.find((f) => f.valleyId === 'soyosan');
    // 동두천(6 km)이 서울보다 가깝다 → 동두천의 301(시작)만 반영, 서울의 절정은 무관.
    expect(soyo).toMatchObject({
      stage: 'turning',
      confidence: 'observed',
      observedAt: '2026-10-18',
      normals: { turning: '10-21', peak: '10-30' },
    });
    expect(soyo?.stations.map((s) => s.code)).toEqual(['98']);
    const island = body.foliage.find((f) => f.valleyId === 'island');
    expect(island).toMatchObject({ stage: 'green', confidence: 'none', stations: [] });
  });
});

describe('season job', () => {
  it('관측·평년 호출 중 하나가 실패해도 나머지는 적재하고, 전부 실패하면 던진다', async () => {
    const OBS = '# YY, STN, TM, SSN_ID, SSN_MD\n 2026,  98,  2026-10-18,   302,   301,\n';
    const NORM = '# ST, STN, MM, DD, SSN_ID, SSN_MD,=\n 2021,  98,  10,  21,    302,    301,=\n';
    let failNorm = true;
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('sfc_ssn_norm')) {
        return failNorm ? new Response('gateway', { status: 504 }) : new Response(NORM);
      }
      return new Response(url.includes('ssn=302') ? OBS : '# empty\n');
    };
    const http = createSourceHttp({ fetch: fetchImpl, redact: identityRedactor });
    const run = createSeasonRun({
      key: 'K',
      http,
      repos,
      now: () => Date.parse('2026-10-20T03:00:00Z'),
    });
    const first = await run();
    expect(first.rows).toBe(1);
    expect(first.detail).toMatchObject({ norms: 0, partialErrors: 2 });
    expect(repos.seasonObs.byYear(2026)).toHaveLength(1);
    failNorm = false;
    const second = await run();
    expect(second.detail).toMatchObject({ norms: 2, partialErrors: 0 }); // 302·501 둘 다 같은 행을 돌려주는 가짜
    expect(repos.seasonNorm.all()).toEqual([{ stn: '98', ssnId: 302, ssnMd: 301, mmdd: '10-21' }]);
  });
});
