/**
 * 물줄기 임시 폴리곤 — 구간 LineString 을 좌우로 부풀린 얇은 띠 (C10c, 결정 (j)).
 *
 * 실제 폭 있는 수계 폴리곤은 **R5**(1:5,000 연속수치지형도 실폭하천)가 준다. 그 전까지는
 * 구간 선을 위치별 폭(상류 6m·중류 12m·하류 18m)으로 부풀려 지형 위에 드레이프한다 —
 * 선 하나보다 "물이 흐르는 면"으로 읽히고, R5 가 오면 이 함수 자리에 실제 폴리곤이
 * 들어간다. 순수 계산이라 web·native 가 같은 값을 그린다.
 *
 * 방법: 위도 기준 미터 평면으로 옮겨 정점마다 앞뒤 점의 평균 법선을 잡고, 왼쪽 열 +
 * 오른쪽 열(역순)을 이어 닫힌 링을 만든다. 수백 m 구간·미터 폭에서는 평면 근사 오차가
 * cm 미만이다. 급한 굽이에서 안쪽 변이 스스로 교차할 수 있지만 폭이 좁아 fill 렌더에는
 * 드러나지 않는다(R5 전 임시 표현이라 감수).
 *
 * 좌표는 `LngLat` 객체가 아니라 `[lng, lat]` 튜플이다 — 정점이 수백 개고, 지도 소스로
 * 넘길 때 다시 풀어야 한다(그늘 폴리곤 `ShadePolygon` 과 같은 이유).
 */
import type { LngLat, LngLatTuple } from '../geo/LngLat';
import type { Segment, SegmentPosition } from './Segment';

/**
 * 위치별 물줄기 폭(m). 스파이크 `waterspike.ts` 의 값 — 계곡 줌(z14~16)에서 선보다 살짝 넓게 읽힌다.
 * 1구간(`whole`)은 상·중·하를 아우르므로 중류 값을 쓴다(SD1).
 */
export const WATER_WIDTH_M: Readonly<Record<SegmentPosition, number>> = {
  upper: 6,
  mid: 12,
  lower: 18,
  whole: 12,
};

/** 위도 1도·경도 1도가 몇 m 인가(등장방형 근사). */
const METERS_PER_DEGREE_LAT = 111_320;
const DEG_TO_RAD = Math.PI / 180;

/**
 * 폴리라인을 좌우로 `halfWidthM` 만큼 부풀린 닫힌 링(첫 점 = 끝 점). 점이 둘 미만이면 빈 배열.
 */
export function bufferPath(path: readonly LngLat[], halfWidthM: number): LngLatTuple[] {
  if (path.length < 2) return [];
  const first = path[0] as LngLat;
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(first.lat * DEG_TO_RAD);
  const toMeters = (point: LngLat): readonly [number, number] => [
    point.lng * metersPerDegreeLng,
    point.lat * METERS_PER_DEGREE_LAT,
  ];
  const toDegrees = (x: number, y: number): LngLatTuple => [
    x / metersPerDegreeLng,
    y / METERS_PER_DEGREE_LAT,
  ];

  const points = path.map(toMeters);
  const last = points.length - 1;
  const left: LngLatTuple[] = [];
  const right: LngLatTuple[] = [];
  for (let index = 0; index <= last; index += 1) {
    const point = points[index] as readonly [number, number];
    const before = points[Math.max(0, index - 1)] as readonly [number, number];
    const after = points[Math.min(last, index + 1)] as readonly [number, number];
    const dx = after[0] - before[0];
    const dy = after[1] - before[1];
    const length = Math.hypot(dx, dy) || 1;
    // 진행 방향을 90° 돌린 왼쪽 법선.
    const nx = -dy / length;
    const ny = dx / length;
    left.push(toDegrees(point[0] + nx * halfWidthM, point[1] + ny * halfWidthM));
    right.push(toDegrees(point[0] - nx * halfWidthM, point[1] - ny * halfWidthM));
  }
  right.reverse();
  const ring = [...left, ...right];
  ring.push(ring[0] as LngLatTuple);
  return ring;
}

/** 구간 하나의 물줄기 폴리곤 링. 폭은 위치(`WATER_WIDTH_M`)로 정한다. */
export function waterPolygonOf(segment: Segment): LngLatTuple[] {
  return bufferPath(segment.path, WATER_WIDTH_M[segment.position] / 2);
}
