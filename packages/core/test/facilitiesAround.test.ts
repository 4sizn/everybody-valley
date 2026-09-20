/**
 * "계곡 주변" 판정 — 중심선까지 거리 300 m(주차장·진입로·역 800 m)와 요약 문장.
 */
import { describe, expect, it } from 'vitest';
import { LngLat } from '../src/domain/geo/LngLat';
import { Facility } from '../src/domain/valley/Facility';
import { facilitySummary } from '../src/domain/valley/facilitySummary';
import { toFacilityId, toSegmentId, toValleyId } from '../src/domain/valley/ids';
import { Segment } from '../src/domain/valley/Segment';
import { Valley } from '../src/domain/valley/Valley';

const V = toValleyId('sample');
// 동서로 곧게 뻗은 중심선(위도 37.85). 1° 위도 ≈ 111 km → 0.001° ≈ 111 m.
const line = new Segment({
  id: toSegmentId('s'),
  valleyId: V,
  valleyName: '샘플',
  position: 'whole',
  order: 0,
  path: [LngLat.of(127.47, 37.85), LngLat.of(127.48, 37.85)],
});
const f = (id: string, type: Facility['facilityType'], dLat: number, hours?: string) =>
  new Facility({
    id: toFacilityId(id),
    valleyId: V,
    name: id,
    facilityType: type,
    position: LngLat.of(127.475, 37.85 + dLat),
    ...(hours ? { operatingHours: hours } : {}),
  });

function valley(...facilities: Facility[]): Valley {
  const r = Valley.create({ id: V, name: '샘플', segments: [line], facilities });
  if (!r.ok) throw new Error('fixture');
  return r.value;
}

describe('Valley.facilitiesAround', () => {
  it('300 m 안은 주변, 밖은 가는 길에 — 주차장은 800 m 까지 주변', () => {
    const v = valley(
      f('toilet-near', 'restroom', 0.001), // ≈111 m
      f('food-far', 'food', 0.005), // ≈555 m
      f('parking-mid', 'parking', 0.006), // ≈666 m → 주차장은 주변
      f('parking-far', 'parking', 0.009), // ≈999 m
    );
    const around = v.facilitiesAround();
    expect(around.nearby.map((x) => x.facility.name)).toEqual(['toilet-near', 'parking-mid']);
    expect(around.onTheWay.map((x) => x.facility.name)).toEqual(['food-far', 'parking-far']);
  });

  it('같은 종류가 30 m 안에 겹치면 한 행 — 첫 것이 대표, 나머지는 alsoHere', () => {
    const v = valley(
      f('a', 'restroom', 0.001),
      f('b', 'restroom', 0.0011), // ≈11 m 옆
      f('c', 'restroom', 0.002), // ≈111 m 떨어짐 → 별도
      f('p', 'parking', 0.001), // 다른 종류 → 별도
    );
    const rows = v.facilitiesAround().nearby;
    expect(rows.map((r) => [r.facility.name, r.alsoHere?.length])).toEqual([
      ['a', 1],
      ['p', 0],
      ['c', 0],
    ]);
  });

  it('거리는 계곡 점이 아니라 중심선까지 — 선 중간 옆의 시설도 가깝다', () => {
    // 선의 서쪽 끝(127.47)에서 550 m 떨어졌지만 선에서는 111 m.
    const v = valley(f('mid', 'restroom', 0.001));
    expect(v.facilitiesAround().nearby[0]?.distance.meters).toBeLessThan(120);
  });
});

describe('facilitySummary', () => {
  it('있는 것은 개수, 화장실·주차장은 없어도 말한다, 주차장은 가장 가까운 거리', () => {
    const v = valley(f('a', 'restroom', 0.001), f('b', 'parking', 0.002), f('c', 'parking', 0.003));
    expect(facilitySummary(v.facilitiesAround().nearby)).toBe(
      '주차장 2(가장 가까운 222m) · 화장실 1 · 쓰레기는 되가져가기',
    );
    expect(facilitySummary([])).toBe('주차장 없음 · 화장실 없음 · 쓰레기는 되가져가기');
  });
});
