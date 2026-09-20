/**
 * 계곡별 단풍 판정 관측소 — 중심선 가운데 점에서 15 km 안 기상청 AWS 최대 3곳(가까운 순).
 * `/api/foliage` 와 백필 스크립트(`scripts/backfill-daily-temps.mts`)가 같은 규칙을 쓴다.
 *
 * 로스터 표를 따로 두지 않는 이유: 기온은 강우와 달리 유역 경계에 매이지 않아 거리만으로
 * 충분하다. 표고 보정은 아직 없다(`routes/foliage.ts` 머리말).
 */
import { haversineDistance, LngLat } from '@modu-valley/core';
import type { Repos } from '../db/repos';

export const FOLIAGE_STATION_MAX_KM = 15;
export const FOLIAGE_STATION_COUNT = 3;

export interface FoliageStation {
  readonly code: string;
  readonly name: string;
  readonly elevationM: number | null;
  /** 소수 1자리. */
  readonly distanceKm: number;
}

export function pickFoliageStations(
  repos: Repos,
  centerlines: ReadonlyMap<string, readonly LngLat[]>,
): ReadonlyMap<string, readonly FoliageStation[]> {
  const aws = repos.stations.list(['aws']).filter((s) => s.lng !== null && s.lat !== null);
  const out = new Map<string, readonly FoliageStation[]>();
  for (const [valleyId, line] of centerlines) {
    const mid = line[line.length >> 1];
    if (!mid) {
      out.set(valleyId, []);
      continue;
    }
    const picked = aws
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
      .map((s) => ({ ...s, distanceKm: Math.round(s.distanceKm * 10) / 10 }));
    out.set(valleyId, picked);
  }
  return out;
}
