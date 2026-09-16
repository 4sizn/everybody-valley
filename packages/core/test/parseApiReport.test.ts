/**
 * `ApiReport` → 도메인 `Report` — F5d 좌표 왕복. 서버 DTO 의 lat/lng 이 앱 상태(`AppState.reports`,
 * 도메인 `Report`)까지 그대로 전해지는지는 이 변환 없이는 보장되지 않는다.
 */
import { describe, expect, it } from 'vitest';
import type { ApiReport } from '../src/application/ports/ApiPort';
import { parseApiReport, parseApiReports } from '../src/application/state/parseApiReport';

function apiReport(overrides: Partial<ApiReport> = {}): ApiReport {
  return {
    id: 'r1',
    valleyId: 'baegun',
    segmentId: null,
    type: 'trash',
    body: '쓰레기가 많아요',
    nickname: '산꾼',
    createdAt: '2026-09-07T00:00:00.000Z',
    photos: [],
    ...overrides,
  };
}

describe('parseApiReport — 좌표(F5d)', () => {
  it('lat/lng 이 있으면 도메인 Report 에도 그대로 실린다', () => {
    const report = parseApiReport(apiReport({ lat: 37.983412, lng: 127.460591 }));
    expect(report.lat).toBe(37.983412);
    expect(report.lng).toBe(127.460591);
    expect(report.hasCoordinate).toBe(true);
  });

  it('lat/lng 이 없으면 도메인 Report 도 없다(회귀)', () => {
    const report = parseApiReport(apiReport());
    expect(report.lat).toBeUndefined();
    expect(report.lng).toBeUndefined();
    expect(report.hasCoordinate).toBe(false);
  });

  it('parseApiReports 는 배열 전체를 옮긴다', () => {
    const reports = parseApiReports([
      apiReport({ id: 'a' }),
      apiReport({ id: 'b', lat: 37.1, lng: 127.1 }),
    ]);
    expect(reports.map((r) => r.id)).toEqual(['a', 'b']);
    expect(reports[1]?.lat).toBe(37.1);
  });

  it('segmentId 가 있으면 함께 담는다(회귀)', () => {
    const report = parseApiReport(apiReport({ segmentId: 'baegun-mid' }));
    expect(report.segmentId).toBe('baegun-mid');
  });
});
