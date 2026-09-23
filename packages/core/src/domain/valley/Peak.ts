/**
 * 계곡 주변 봉우리 — 지도 라벨 "▲ 언니통봉 928m" 과 구간 정보의 "주변 산" 재료.
 *
 * 왜 자체 데이터인가(2026-09-23): 베이스맵 타일의 `mountain_peak` 라벨(`terrain-peak-label`)은
 * 3D 지형을 켠 채 타일 최대 줌(14)을 넘어가면 MapLibre 가 그리지 않는다(단독 재현: z13.9 → 2개,
 * z14.1 → 0개, 지형 끄면 z14.2 → 1개). 계곡 화면 기본 줌이 14.2·15.5 라 봉우리 이름이 늘 비었다.
 * GeoJSON 소스는 오버줌이 18 부터라 이 문제가 없다. 출처는 OSM `natural=peak`(`scripts/seed/peaks.mts`).
 */
import { type Distance, distanceToPolyline } from '../geo/Distance';
import type { LngLat } from '../geo/LngLat';
import type { ValleyId } from './ids';
import type { Valley } from './Valley';

export type Peak = {
  readonly valleyId: ValleyId;
  readonly name: string;
  /** OSM `ele`(m). 없으면 이름만 보인다. */
  readonly elevationM: number | undefined;
  readonly position: LngLat;
};

export type PeakAtDistance = { readonly peak: Peak; readonly distance: Distance };

/** "언니통봉 928m" — 표고가 없으면 이름만. */
export function peakLabel(peak: Peak): string {
  return peak.elevationM === undefined ? peak.name : `${peak.name} ${peak.elevationM}m`;
}

/** 이 계곡의 봉우리를 **중심선에서 가까운 순**으로. 같은 이름(OSM 중복 노드)은 가까운 것만. */
export function nearbyPeaks(
  valley: Valley,
  peaks: readonly Peak[],
  limit = 3,
): readonly PeakAtDistance[] {
  const line = valley.segments.flatMap((segment) => segment.path);
  const seen = new Set<string>();
  return peaks
    .filter((peak) => peak.valleyId === valley.id)
    .map((peak) => ({ peak, distance: distanceToPolyline(peak.position, line) }))
    .sort((a, b) => a.distance.meters - b.distance.meters)
    .filter(({ peak }) => (seen.has(peak.name) ? false : (seen.add(peak.name), true)))
    .slice(0, limit);
}
