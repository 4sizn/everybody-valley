/**
 * 제보 좌표(F5d) 검증·표시 순수 함수 — 쌍 여부·한국 범위·계곡 반경 3km 경계·복사 문자열.
 */
import { describe, expect, it } from 'vitest';
import { LngLat } from '../src/domain/geo/LngLat';
import {
  formatReportCoordinate,
  isReportCoordinateInRange,
  isValidReportCoordinatePair,
  isWithinReportCoordinateRadius,
  REPORT_COORDINATE_MAX_DISTANCE_M,
  reportCoordinateCopyText,
} from '../src/domain/report/ReportCoordinate';

describe('isValidReportCoordinatePair', () => {
  it('둘 다 있거나 둘 다 없어야 유효하다', () => {
    expect(isValidReportCoordinatePair(37.5, 127.1)).toBe(true);
    expect(isValidReportCoordinatePair(undefined, undefined)).toBe(true);
    expect(isValidReportCoordinatePair(null, null)).toBe(true);
  });

  it('한쪽만 오면 무효하다', () => {
    expect(isValidReportCoordinatePair(37.5, undefined)).toBe(false);
    expect(isValidReportCoordinatePair(undefined, 127.1)).toBe(false);
    expect(isValidReportCoordinatePair(37.5, null)).toBe(false);
    expect(isValidReportCoordinatePair(null, 127.1)).toBe(false);
  });
});

describe('isReportCoordinateInRange', () => {
  it('한국 범위 안은 통과한다', () => {
    expect(isReportCoordinateInRange(37.5, 127.1)).toBe(true);
    expect(isReportCoordinateInRange(33.1, 126.2)).toBe(true); // 마라도 근방
  });

  it('한국 범위 밖·유한하지 않은 값은 거부한다', () => {
    expect(isReportCoordinateInRange(0, 0)).toBe(false);
    expect(isReportCoordinateInRange(48.8, 2.3)).toBe(false); // 파리
    expect(isReportCoordinateInRange(127.1, 37.5)).toBe(false); // 위경도 순서 뒤바뀜
    expect(isReportCoordinateInRange(Number.NaN, 127.1)).toBe(false);
  });
});

describe('isWithinReportCoordinateRadius (F5d 해석 4 — 계곡 반경 3km)', () => {
  // 남북 1.11km 남짓의 짧은 중심선. 위도 1도 ≈ 111.2km 이므로 0.01도 ≈ 1.11km.
  const centerline = [LngLat.of(127.0, 37.0), LngLat.of(127.0, 37.01)];
  const midLat = 37.005;

  // 위 distance.test.ts 의 등장방형 근사로 동쪽 오프셋 각도를 역산 — 위도 37.005 에서
  // 경도 1도 ≈ cos(37.005°) × 111.2km. 2.9km/3.1km 경계를 이 축척으로 만든다.
  function eastOffsetDegForMeters(meters: number, latDeg: number): number {
    const R = 6371000;
    const degToRad = Math.PI / 180;
    return meters / (R * degToRad * Math.cos(latDeg * degToRad));
  }

  it('경계 안쪽(2.9km)은 통과한다', () => {
    const lngOffset = eastOffsetDegForMeters(2900, midLat);
    const point = LngLat.of(127.0 + lngOffset, midLat);
    expect(isWithinReportCoordinateRadius(point, centerline)).toBe(true);
  });

  it('경계 바깥쪽(3.1km)은 거부한다', () => {
    const lngOffset = eastOffsetDegForMeters(3100, midLat);
    const point = LngLat.of(127.0 + lngOffset, midLat);
    expect(isWithinReportCoordinateRadius(point, centerline)).toBe(false);
  });

  it('기본 반경 상수는 3000m 다', () => {
    expect(REPORT_COORDINATE_MAX_DISTANCE_M).toBe(3000);
  });

  it('중심선을 모르면(빈 배열) 항상 거부한다', () => {
    expect(isWithinReportCoordinateRadius(LngLat.of(127.0, 37.005), [])).toBe(false);
  });
});

describe('formatReportCoordinate / reportCoordinateCopyText', () => {
  it('소수점 6자리, "위도, 경도" 순서로 포맷한다', () => {
    expect(formatReportCoordinate(37.9834123456, 127.4605912345)).toBe('37.983412, 127.460591');
  });

  it('복사 문자열은 "계곡명 구간\\n위도, 경도" 형식이다', () => {
    expect(reportCoordinateCopyText('조무락골', '중류', 37.983412, 127.460591)).toBe(
      '조무락골 중류\n37.983412, 127.460591',
    );
  });

  it('구간 라벨이 없으면 첫 줄은 계곡명뿐이다', () => {
    expect(reportCoordinateCopyText('조무락골', undefined, 37.983412, 127.460591)).toBe(
      '조무락골\n37.983412, 127.460591',
    );
  });
});
