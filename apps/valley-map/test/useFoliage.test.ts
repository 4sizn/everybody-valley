import type { ApiFoliage } from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import { foliageLine, isFoliageSeason } from '../src/journey/useFoliage';

const base: ApiFoliage = {
  valleyId: 'v',
  stage: 'green',
  confidence: 'observed',
  lastDay: '2026-10-01',
  coldDays: 0,
  turningStart: null,
  peakStart: null,
  fallingStart: null,
  forecast: { turning: null, peak: null },
  stations: [],
};

describe('foliageLine', () => {
  it('자료 없음 → null', () => {
    expect(foliageLine({ ...base, confidence: 'none' })).toBeNull();
  });
  it('초록 + 예측', () => {
    expect(foliageLine({ ...base, forecast: { turning: '2026-10-08', peak: '2026-10-22' } })).toBe(
      '10/8 물들기 · 10/22 절정 예상',
    );
  });
  it('물들기 시작 + 자료 적음 꼬리표', () => {
    expect(
      foliageLine({
        ...base,
        stage: 'turning',
        confidence: 'estimated',
        turningStart: '2026-10-12',
        forecast: { turning: null, peak: '2026-10-26' },
      }),
    ).toBe('물들기 시작(10/12~) · 10/26 절정 예상 · 자료 적음');
  });
  it('절정', () => {
    expect(foliageLine({ ...base, stage: 'peak', peakStart: '2026-10-28' })).toBe('절정(10/28~)');
  });
});

describe('isFoliageSeason — KST 9/15~11/30', () => {
  it('경계', () => {
    expect(isFoliageSeason(new Date('2026-09-14T15:00:00Z'))).toBe(true); // KST 9/15 00:00
    expect(isFoliageSeason(new Date('2026-09-14T14:59:00Z'))).toBe(false); // KST 9/14 23:59
    expect(isFoliageSeason(new Date('2026-11-30T14:59:00Z'))).toBe(true);
    expect(isFoliageSeason(new Date('2026-11-30T15:00:00Z'))).toBe(false); // KST 12/1
  });
});
