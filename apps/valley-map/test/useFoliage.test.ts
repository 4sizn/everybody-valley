import type { ApiFoliage } from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import { foliageLine, isFoliageSeason } from '../src/journey/useFoliage';

const base: ApiFoliage = {
  valleyId: 'v',
  stage: 'green',
  confidence: 'observed',
  observedAt: null,
  dates: {},
  normals: { turning: '10-20', peak: '10-31' },
  stations: [{ code: '98', name: '동두천', distanceKm: 6.2, ssnId: 302 }],
};

describe('foliageLine', () => {
  it('관측 지점 없음 → null', () => {
    expect(foliageLine({ ...base, confidence: 'none', stations: [] })).toBeNull();
  });
  it('단풍 전 + 평년', () => {
    expect(foliageLine(base)).toBe('단풍 전 · 평년 첫단풍 10/20 · 절정 10/31 · 동두천 관측');
  });
  it('물들기 시작 + 평년 절정', () => {
    expect(
      foliageLine({
        ...base,
        stage: 'turning',
        observedAt: '2026-10-18',
        dates: { turning: '2026-10-18' },
      }),
    ).toBe('물들기 시작(10/18~) · 평년 절정 10/31 · 동두천 관측');
  });
  it('절정', () => {
    expect(foliageLine({ ...base, stage: 'peak', observedAt: '2026-10-29' })).toBe(
      '절정(10/29~) · 동두천 관측',
    );
  });
  it('평년값 없음', () => {
    expect(foliageLine({ ...base, normals: {} })).toBe('단풍 전 · 평년값 없음 · 동두천 관측');
  });
});

describe('isFoliageSeason — KST 9/15~11/30', () => {
  it('경계', () => {
    expect(isFoliageSeason(new Date('2026-09-14T15:00:00Z'))).toBe(true);
    expect(isFoliageSeason(new Date('2026-09-14T14:59:00Z'))).toBe(false);
    expect(isFoliageSeason(new Date('2026-11-30T14:59:00Z'))).toBe(true);
    expect(isFoliageSeason(new Date('2026-11-30T15:00:00Z'))).toBe(false);
  });
});

describe('FOLIAGE_LEAF_COLOR', () => {
  it('단계마다 다른 색, 종료와 없음은 회색', async () => {
    const { FOLIAGE_LEAF_COLOR } = await import('../src/journey/FoliageLeaf.web');
    const distinct = new Set([
      FOLIAGE_LEAF_COLOR.green,
      FOLIAGE_LEAF_COLOR.turning,
      FOLIAGE_LEAF_COLOR.peak,
      FOLIAGE_LEAF_COLOR.falling,
    ]);
    expect(distinct.size).toBe(4);
    expect(FOLIAGE_LEAF_COLOR.dormant).toBe(FOLIAGE_LEAF_COLOR.none);
  });
});
