/**
 * 물줄기 임시 폴리곤 (C10c) — 구간 선을 좌우로 부풀린 띠의 기하를 고정한다.
 */
import { describe, expect, it } from 'vitest';
import { equirectangularDistance } from '../src/domain/geo/Distance';
import { LngLat } from '../src/domain/geo/LngLat';
import { toSegmentId, toValleyId } from '../src/domain/valley/ids';
import { Segment, type SegmentPosition } from '../src/domain/valley/Segment';
import { bufferPath, WATER_WIDTH_M, waterPolygonOf } from '../src/domain/valley/WaterPolygon';

function segment(position: SegmentPosition, path: readonly (readonly [number, number])[]): Segment {
  return new Segment({
    id: toSegmentId(`s-${position}`),
    valleyId: toValleyId('v'),
    valleyName: 'v',
    position,
    order: 0,
    path: path.map(([lng, lat]) => LngLat.of(lng, lat)),
  });
}

const EAST_WEST: readonly (readonly [number, number])[] = [
  [127.26, 37.83],
  [127.28, 37.83],
];

describe('bufferPath', () => {
  it('점 n 개 → 닫힌 링 2n + 1 점, 첫 점 = 끝 점', () => {
    const ring = bufferPath(
      EAST_WEST.map(([lng, lat]) => LngLat.of(lng, lat)),
      3,
    );
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
  });

  it('직선 구간의 띠 폭은 halfWidth 의 두 배(m), 좌우 대칭', () => {
    const half = 6;
    const ring = bufferPath(
      EAST_WEST.map(([lng, lat]) => LngLat.of(lng, lat)),
      half,
    );
    // 동서 방향 선: 왼쪽 열은 북쪽(위도 +), 오른쪽 열은 남쪽.
    const [leftStart, leftEnd, rightEnd, rightStart] = ring as [
      [number, number],
      [number, number],
      [number, number],
      [number, number],
      [number, number],
    ];
    expect(leftStart[1]).toBeGreaterThan(37.83);
    expect(rightStart[1]).toBeLessThan(37.83);
    expect(leftStart[0]).toBeCloseTo(127.26, 6);
    expect(rightStart[0]).toBeCloseTo(127.26, 6);
    expect(leftEnd[0]).toBeCloseTo(127.28, 6);
    expect(rightEnd[0]).toBeCloseTo(127.28, 6);
    const width = equirectangularDistance(
      LngLat.of(leftStart[0], leftStart[1]),
      LngLat.of(rightStart[0], rightStart[1]),
    ).meters;
    expect(width).toBeCloseTo(half * 2, 1);
  });

  it('점이 둘 미만이면 빈 배열', () => {
    expect(bufferPath([], 3)).toEqual([]);
    expect(bufferPath([LngLat.of(127.26, 37.83)], 3)).toEqual([]);
  });

  it('굽은 선은 정점마다 앞뒤 평균 법선을 쓴다 — 중간 정점의 좌우 폭도 지정 폭', () => {
    const half = 5;
    const bent = [LngLat.of(127.26, 37.83), LngLat.of(127.27, 37.835), LngLat.of(127.28, 37.83)];
    const ring = bufferPath(bent, half);
    expect(ring).toHaveLength(7);
    const midLeft = ring[1] as [number, number];
    const midRight = ring[4] as [number, number];
    const width = equirectangularDistance(
      LngLat.of(midLeft[0], midLeft[1]),
      LngLat.of(midRight[0], midRight[1]),
    ).meters;
    expect(width).toBeCloseTo(half * 2, 1);
  });
});

describe('waterPolygonOf — 위치별 폭', () => {
  it('상류 6m · 중류 12m · 하류 18m · 전체(1구간) 12m (결정 (j), R5 전 임시값 · SD1 whole)', () => {
    expect(WATER_WIDTH_M).toEqual({ upper: 6, mid: 12, lower: 18, whole: 12 });
    for (const position of ['upper', 'mid', 'lower', 'whole'] as const) {
      const ring = waterPolygonOf(segment(position, EAST_WEST));
      const left = ring[0] as [number, number];
      const right = ring[3] as [number, number];
      const width = equirectangularDistance(
        LngLat.of(left[0], left[1]),
        LngLat.of(right[0], right[1]),
      ).meters;
      expect(width).toBeCloseTo(WATER_WIDTH_M[position], 1);
    }
  });
});
