/**
 * 메르카토르 투영 테스트.
 *
 * 상수와 공식은 maplibre-gl 의 `MercatorCoordinate` 에서 옮겨 온 것이다.
 * 값이 어긋나면 불꽃의 고도와 확산 반경이 데모와 달라진다.
 */
import { describe, expect, it } from 'vitest';
import { LngLat } from '../src/domain/geo/LngLat';
import {
  circumferenceAtLatitude,
  mercatorXFromLng,
  mercatorYFromLat,
  mercatorZFromAltitude,
  WebMercatorProjection,
} from '../src/domain/geo/MercatorProjection';

const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6371008.8;

describe('웹 메르카토르', () => {
  it('원점과 극단값', () => {
    expect(mercatorXFromLng(-180)).toBe(0);
    expect(mercatorXFromLng(0)).toBe(0.5);
    expect(mercatorXFromLng(180)).toBe(1);
    expect(mercatorYFromLat(0)).toBeCloseTo(0.5, 12);
  });

  it('북반구는 y 가 0.5 보다 작다 (남쪽이 +)', () => {
    expect(mercatorYFromLat(37.5285)).toBeLessThan(0.5);
  });

  it('위도별 지구 둘레', () => {
    expect(circumferenceAtLatitude(0)).toBeCloseTo(EARTH_CIRCUMFERENCE, 6);
    expect(circumferenceAtLatitude(60)).toBeCloseTo(EARTH_CIRCUMFERENCE / 2, 3);
  });

  it('고도 → 메르카토르 z 는 위도 둘레로 나눈 값', () => {
    const lat = 37.5285;
    expect(mercatorZFromAltitude(400, lat)).toBeCloseTo(400 / circumferenceAtLatitude(lat), 15);
  });

  it('meterScaleAt 은 1m 를 메르카토르 단위로 바꾼다', () => {
    const projection = new WebMercatorProjection();
    const site = LngLat.of(126.9345, 37.5285);
    expect(projection.meterScaleAt(site)).toBeCloseTo(1 / circumferenceAtLatitude(37.5285), 18);
  });

  it('project 는 xyz 를 함께 돌려준다', () => {
    const projection = new WebMercatorProjection();
    const site = LngLat.of(126.9345, 37.5285);
    const point = projection.project(site, 400);
    expect(point.x).toBeCloseTo(mercatorXFromLng(126.9345), 15);
    expect(point.y).toBeCloseTo(mercatorYFromLat(37.5285), 15);
    expect(point.z).toBeCloseTo(mercatorZFromAltitude(400, 37.5285), 18);
  });
});
