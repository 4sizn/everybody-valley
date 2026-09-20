/**
 * `GET /api/foliage` — 계곡 전부의 단풍 진행 상태. HTTP 를 부르지 않는다 — AWS 폴러가 접어 둔
 * 일 최저기온(`daily_temps`)을 계곡 중심에서 가까운 기상청 AWS 관측소 몇 개로 합쳐 core
 * `evaluateFoliage` 에 넘긴다. 판정 규칙은 core 에만 있다.
 *
 * 관측소 선택: 계곡 중심선 가운데 점에서 15 km 안 AWS 최대 3곳(가까운 순). 같은 날 값이 여럿이면
 * 중앙값. 로스터 표를 따로 두지 않는 이유는 기온이 강우와 달리 유역 경계에 매이지 않아
 * 거리만으로 충분해서다.
 *
 * ponytail: 관측소 표고를 계곡 표고로 보정하지 않는다(계곡 표고 자료가 아직 없다). 산지 AWS 가
 * 가까이 있으면 그 값이 곧 계곡 값에 가깝고, 평지 관측소만 잡히면 실제보다 따뜻하게(늦게)
 * 나온다 — DEM 에서 중심선 표고를 뽑아 -0.65℃/100 m 를 적용하는 것이 다음 단계.
 */
import { evaluateFoliage, type FoliageDay, haversineDistance, LngLat } from '@modu-valley/core';
import { Hono } from 'hono';
import type { Repos } from '../../db/repos';
import { kstDayOf } from '../../db/repos';

export interface FoliageRouteDeps {
  readonly repos: Repos;
  readonly valleyCenterlines: ReadonlyMap<string, readonly LngLat[]>;
  readonly now?: () => number;
}

export const FOLIAGE_STATION_MAX_KM = 15;
export const FOLIAGE_STATION_COUNT = 3;
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
    const aws = deps.repos.stations.list(['aws']).filter((s) => s.lng !== null && s.lat !== null);

    const foliage = [...deps.valleyCenterlines.entries()].map(([valleyId, line]) => {
      const mid = line[line.length >> 1];
      const stations = mid
        ? aws
            .map((s) => ({
              code: s.code,
              name: s.name,
              elevationM: s.elevationM,
              distanceKm:
                haversineDistance(mid, LngLat.of(s.lng as number, s.lat as number)).meters / 1000,
            }))
            .filter((s) => s.distanceKm <= FOLIAGE_STATION_MAX_KM)
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .slice(0, FOLIAGE_STATION_COUNT)
        : [];

      const byDay = new Map<string, number[]>();
      for (const s of stations) {
        for (const d of deps.repos.dailyTemps.series('aws', s.code, since)) {
          const list = byDay.get(d.day);
          if (list) list.push(d.tminC);
          else byDay.set(d.day, [d.tminC]);
        }
      }
      const days: FoliageDay[] = [...byDay.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([day, values]) => ({ day, tminC: median(values) }));

      const state = evaluateFoliage({ days, today });
      return {
        valleyId,
        ...state,
        stations: stations.map((s) => ({ ...s, distanceKm: Math.round(s.distanceKm * 10) / 10 })),
      };
    });

    c.header('cache-control', `public, max-age=${cacheSec}`);
    return c.json({ count: foliage.length, now: nowIso, today, foliage });
  });

  return app;
}
