/**
 * `GET /api/foliage` — 계곡 전부의 단풍 단계. **기상청 계절관측(API허브 `sfc_ssn.php`)만** 본다:
 * 계곡 중심선 가운데 점에서 가장 가까운 관서지점(단풍나무 302, 40 km 안)과, 좌표를 아는 유명산
 * 지점(501, 25 km 안)의 올해 관측 이벤트를 합쳐 core `evaluateFoliage` 에 넘긴다. 평년값
 * (`sfc_ssn_norm.php`)은 유명산 지점이 있으면 그것, 없으면 관서 지점의 것을 붙인다.
 *
 * 후보 지점 = 올해 관측이 있거나 평년값이 있는 지점. 관서지점이 올해 아직 아무 단풍도 관측하지
 * 않았어도 후보다 — "관측 지점은 있는데 아직 단풍 전" 이 정직한 답이다. 지점 좌표는 `stations`
 * (기상청 지점정보 AWS 목록에 관서지점이 포함된다)에서 가져오고, 좌표를 모르는 지점은 쓰지 않는다.
 */
import {
  type ApiFoliageStation,
  evaluateFoliage,
  FOLIAGE_STAGE_BY_CODE,
  type FoliageNormals,
  type FoliageObservation,
  haversineDistance,
  LngLat,
} from '@modu-valley/core';
import { Hono } from 'hono';
import type { Repos, SeasonNormRecord } from '../../db/repos';
import { kstDayOf } from '../../db/repos';
import { SSN_FAMOUS_MOUNTAIN, SSN_MAPLE } from '../../sources/kmaSeason';

export interface FoliageRouteDeps {
  readonly repos: Repos;
  readonly valleyCenterlines: ReadonlyMap<string, readonly LngLat[]>;
  readonly now?: () => number;
}

export const FOLIAGE_OFFICE_MAX_KM = 40;
export const FOLIAGE_MOUNTAIN_MAX_KM = 25;

function normalsOf(rows: readonly SeasonNormRecord[], stn: string, ssnId: number): FoliageNormals {
  const out: FoliageNormals = {};
  for (const r of rows) {
    if (r.stn !== stn || r.ssnId !== ssnId) continue;
    const stage = FOLIAGE_STAGE_BY_CODE[r.ssnMd];
    if (stage && out[stage] === undefined) out[stage] = r.mmdd;
  }
  return out;
}

export function foliageRoutes(deps: FoliageRouteDeps, cacheSec = 300): Hono {
  const app = new Hono();
  const now = deps.now ?? Date.now;

  app.get('/', (c) => {
    const nowIso = new Date(now()).toISOString();
    const today = kstDayOf(nowIso);
    const obs = deps.repos.seasonObs.byYear(Number(today.slice(0, 4)));
    const norms = deps.repos.seasonNorm.all();

    const index = new Map<string, { name: string; point: LngLat }>();
    for (const s of deps.repos.stations.list(['aws'])) {
      if (s.lng !== null && s.lat !== null)
        index.set(s.code, { name: s.name, point: LngLat.of(s.lng, s.lat) });
    }
    const stnsOf = (ssnId: number): string[] =>
      [...new Set([...obs, ...norms].filter((r) => r.ssnId === ssnId).map((r) => r.stn))].filter(
        (s) => index.has(s),
      );
    const offices = stnsOf(SSN_MAPLE);
    const mountains = stnsOf(SSN_FAMOUS_MOUNTAIN);

    const nearest = (
      mid: LngLat,
      codes: readonly string[],
      maxKm: number,
      ssnId: number,
    ): ApiFoliageStation | null => {
      let best: ApiFoliageStation | null = null;
      for (const code of codes) {
        const st = index.get(code);
        if (!st) continue;
        const km = haversineDistance(mid, st.point).meters / 1000;
        if (km > maxKm || (best && km >= best.distanceKm)) continue;
        best = { code, name: st.name, distanceKm: Math.round(km * 10) / 10, ssnId };
      }
      return best;
    };
    const eventsOf = (s: ApiFoliageStation): FoliageObservation[] =>
      obs
        .filter((o) => o.stn === s.code && o.ssnId === s.ssnId)
        .map((o) => ({ day: o.tm, code: o.ssnMd }));

    const foliage = [...deps.valleyCenterlines.entries()].map(([valleyId, line]) => {
      const mid = line[line.length >> 1];
      const office = mid ? nearest(mid, offices, FOLIAGE_OFFICE_MAX_KM, SSN_MAPLE) : null;
      const mountain = mid
        ? nearest(mid, mountains, FOLIAGE_MOUNTAIN_MAX_KM, SSN_FAMOUS_MOUNTAIN)
        : null;
      const stations = [mountain, office].filter((s): s is ApiFoliageStation => s !== null);
      const normalSource = mountain ?? office;
      const state = evaluateFoliage({
        observations: stations.flatMap(eventsOf),
        normals: normalSource ? normalsOf(norms, normalSource.code, normalSource.ssnId) : {},
        today,
      });
      return {
        valleyId,
        ...state,
        confidence: stations.length > 0 ? ('observed' as const) : ('none' as const),
        stations,
      };
    });

    c.header('cache-control', `public, max-age=${cacheSec}`);
    return c.json({
      count: foliage.length,
      now: nowIso,
      today,
      source: '기상청 API허브 계절관측(sfc_ssn) · 평년(sfc_ssn_norm)',
      foliage,
    });
  });

  return app;
}
