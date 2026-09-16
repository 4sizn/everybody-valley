/**
 * 거리 표기 파리티 테스트.
 *
 * 여기의 기대값은 원본 데모가 실제로 화면에 그리는 문자열이다. 공식이나
 * 상수를 건드리면 이 테스트가 먼저 깨진다 — 지도 라벨과 목록의 거리가
 * 데모와 달라지는 것을 코드 단계에서 막는 방어선이다.
 */
import { describe, expect, it } from 'vitest';
import { createSeoulFireworks2026, LAUNCH_SITE } from '../src/data/seoulFireworks2026';
import {
  Distance,
  distanceToPolyline,
  equirectangularDistance,
  haversineDistance,
} from '../src/domain/geo/Distance';
import { LngLat } from '../src/domain/geo/LngLat';

describe('Distance.format', () => {
  it('1000m 미만은 정수 + m', () => {
    expect(Distance.unsafeOfMeters(0).format()).toBe('0m');
    expect(Distance.unsafeOfMeters(131.6).format()).toBe('132m');
    expect(Distance.unsafeOfMeters(999.4).format()).toBe('999m');
  });

  it('1000m 이상은 소수 1자리 + km', () => {
    expect(Distance.unsafeOfMeters(999.5).format()).toBe('1000m');
    expect(Distance.unsafeOfMeters(1000).format()).toBe('1.0km');
    expect(Distance.unsafeOfMeters(1249).format()).toBe('1.2km');
    expect(Distance.unsafeOfMeters(3349).format()).toBe('3.3km');
  });

  it('음수·NaN 은 값 객체를 만들지 못한다', () => {
    expect(Distance.ofMeters(-1).ok).toBe(false);
    expect(Distance.ofMeters(Number.NaN).ok).toBe(false);
    const valid = Distance.ofMeters(10);
    expect(valid.ok).toBe(true);
  });
});

describe('발사 지점 → 명당 거리 (데모 화면 문자열)', () => {
  const EXPECTED: Readonly<Record<string, string>> = {
    '여의도 한강공원': '132m',
    '원효대교 남단': '872m',
    '63빌딩 앞': '1.1km',
    노들섬: '2.4km',
    '서강대교 북단': '1.4km',
    '이촌 한강공원': '3.3km',
  };

  const festival = createSeoulFireworks2026();

  for (const spot of festival.spots) {
    it(`${spot.name} = ${EXPECTED[spot.name]}`, () => {
      expect(spot.distanceFrom(LAUNCH_SITE).format()).toBe(EXPECTED[spot.name]);
    });
  }
});

describe('측정 함수', () => {
  it('등장방형 근사는 대칭이다', () => {
    const a = LngLat.of(126.9345, 37.5285);
    const b = LngLat.of(126.969, 37.517);
    expect(equirectangularDistance(a, b).meters).toBeCloseTo(
      equirectangularDistance(b, a).meters,
      6,
    );
  });

  it('같은 지점은 0', () => {
    const a = LngLat.of(126.9345, 37.5285);
    expect(equirectangularDistance(a, a).meters).toBe(0);
  });

  it('수 km 범위에서 하버사인과 1% 안쪽으로 일치한다', () => {
    const a = LngLat.of(126.9345, 37.5285);
    const b = LngLat.of(126.969, 37.517);
    const approx = equirectangularDistance(a, b).meters;
    const exact = haversineDistance(a, b).meters;
    expect(Math.abs(approx - exact) / exact).toBeLessThan(0.01);
  });
});

describe('distanceToPolyline (F5d — 계곡 중심선 반경 판정의 재료)', () => {
  // 남북으로 곧게 뻗은 변 하나(위경도 소수 넷째 자리 수준의 짧은 구간).
  const north = LngLat.of(127.0, 37.01);
  const south = LngLat.of(127.0, 37.0);
  const line = [south, north];

  it('폴리라인 위의 점은 거리 0에 가깝다', () => {
    expect(distanceToPolyline(south, line).meters).toBeLessThan(0.01);
    const midpoint = LngLat.of(127.0, 37.005);
    expect(distanceToPolyline(midpoint, line).meters).toBeLessThan(0.01);
  });

  it('변 중간을 향한 수선의 발이 정점보다 가깝다 — 정점 거리만으로는 부족하다', () => {
    // 변의 중간 위도와 같은 위도에서 동쪽으로 살짝 떨어진 점 — 가장 가까운 자리는
    // 남·북 정점이 아니라 변 위 같은 위도의 점이다.
    const nearMiddle = LngLat.of(127.001, 37.005);
    const toLine = distanceToPolyline(nearMiddle, line).meters;
    const toSouth = equirectangularDistance(nearMiddle, south).meters;
    const toNorth = equirectangularDistance(nearMiddle, north).meters;
    expect(toLine).toBeLessThan(toSouth);
    expect(toLine).toBeLessThan(toNorth);
    // 같은 위도의 변 위 점까지의 거리(동서 오프셋만)와 거의 같다.
    const footOfPerpendicular = LngLat.of(127.0, 37.005);
    expect(toLine).toBeCloseTo(equirectangularDistance(nearMiddle, footOfPerpendicular).meters, 3);
  });

  it('수선의 발이 변 밖이면 더 가까운 정점까지의 거리와 같다', () => {
    const beyondSouth = LngLat.of(127.0, 36.99);
    expect(distanceToPolyline(beyondSouth, line).meters).toBeCloseTo(
      equirectangularDistance(beyondSouth, south).meters,
      6,
    );
  });

  it('점 하나뿐인 폴리라인은 그 점까지의 거리와 같다', () => {
    const point = LngLat.of(127.05, 37.05);
    const only = LngLat.of(127.0, 37.0);
    expect(distanceToPolyline(point, [only]).meters).toBeCloseTo(
      equirectangularDistance(point, only).meters,
      6,
    );
  });

  it('빈 폴리라인은 무한대 — 판정할 대상이 없다는 신호', () => {
    expect(distanceToPolyline(south, [])).toEqual(
      Distance.unsafeOfMeters(Number.POSITIVE_INFINITY),
    );
  });
});

describe('LngLat 검증', () => {
  it('범위를 벗어난 좌표는 거부된다', () => {
    expect(LngLat.create(0, 91).ok).toBe(false);
    expect(LngLat.create(181, 0).ok).toBe(false);
    expect(LngLat.create(Number.NaN, 0).ok).toBe(false);
  });

  it('of() 는 잘못된 리터럴에 대해 던진다 — 복구 대상이 아니라 버그다', () => {
    expect(() => LngLat.of(0, 91)).toThrow();
  });
});
