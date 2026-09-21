/**
 * `GET /api/foliage` — 계곡 전부의 단풍 진행 상태. HTTP 를 부르지 않는다 — AWS 폴러가 접어 둔
 * 일 최저기온(`daily_temps`)을 계곡 중심에서 가까운 기상청 AWS 관측소 몇 개로 합쳐 core
 * `evaluateFoliage` 에 넘긴다. 판정 규칙은 core 에만 있다.
 *
 * 관측소 선택은 `foliage/stations.ts`(중심선 가운데 점 15 km 안 AWS 최대 3곳). 같은 날 값이
 * 여럿이면 중앙값.
 *
 * 표고 보정: 관측소 최저기온을 계곡 중심선 표고(`seed:elevation`, feature `elevationM`)로 옮긴다 —
 * T계곡 = T관측소 − 0.0065 × (표고계곡 − 표고관측소). 평지 관측소(남이섬 40 m)로 산간 계곡(용추
 * 400 m)을 재면 2.3℃ 따뜻하게 나와 첫 단풍이 늦게 잡히던 것을 바로잡는다. 계곡 표고나 관측소
 * 표고가 없으면 그 짝은 보정 없이 쓴다.
 */
import { evaluateFoliage, type FoliageDay, type LngLat } from '@modu-valley/core';
import { Hono } from 'hono';
import type { Repos } from '../../db/repos';
import { kstDayOf } from '../../db/repos';
import { pickFoliageStations } from '../../foliage/stations';

export interface FoliageRouteDeps {
  readonly repos: Repos;
  readonly valleyCenterlines: ReadonlyMap<string, readonly LngLat[]>;
  /** 계곡 id → 중심선 표고 중앙값(m). 없는 계곡은 보정하지 않는다. */
  readonly valleyElevations?: ReadonlyMap<string, number>;
  readonly now?: () => number;
}

/** 표준 기온 감률(℃/m). 습윤 대기 평균 −6.5 ℃/km. */
export const LAPSE_C_PER_M = 0.0065;

/** 판정에 넣는 일수. 첫 단풍 판정은 9월 초부터의 이력이 있어야 한다. */
export const FOLIAGE_LOOKBACK_DAYS = 100;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

export function foliageRoutes(deps: FoliageRouteDeps, cacheSec = 300): Hono {
  const app = new Hono();
  const now = deps.now ?? Date.now;

  app.get('/', (c) => {
    const nowIso = new Date(now()).toISOString();
    const today = kstDayOf(nowIso);
    const since = kstDayOf(new Date(now() - FOLIAGE_LOOKBACK_DAYS * 86_400_000).toISOString());
    const stationsByValley = pickFoliageStations(deps.repos, deps.valleyCenterlines);

    const foliage = [...stationsByValley.entries()].map(([valleyId, stations]) => {
      const elevationM = deps.valleyElevations?.get(valleyId) ?? null;
      const byDay = new Map<string, number[]>();
      const corrected = stations.map((s) => {
        const correctionC =
          elevationM !== null && s.elevationM !== null
            ? Math.round(-LAPSE_C_PER_M * (elevationM - s.elevationM) * 10) / 10
            : 0;
        return { ...s, correctionC };
      });
      for (const s of corrected) {
        for (const d of deps.repos.dailyTemps.series('aws', s.code, since)) {
          const t = Math.round((d.tminC + s.correctionC) * 10) / 10;
          const list = byDay.get(d.day);
          if (list) list.push(t);
          else byDay.set(d.day, [t]);
        }
      }
      const days: FoliageDay[] = [...byDay.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([day, values]) => ({ day, tminC: median(values) }));

      const state = evaluateFoliage({ days, today });
      return { valleyId, ...state, elevationM, stations: corrected };
    });

    c.header('cache-control', `public, max-age=${cacheSec}`);
    return c.json({ count: foliage.length, now: nowIso, today, foliage });
  });

  return app;
}
