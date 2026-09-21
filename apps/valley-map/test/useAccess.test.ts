import type { ApiAccess } from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import { accessLine, isWildfireSeason } from '../src/journey/useAccess';

const control = {
  valleyId: 'v',
  kind: 'closed-area' as const,
  from: '2026-11-01',
  to: '2026-12-15',
  basis: 'parcel' as const,
  agency: '북부지방산림청',
  sourceUrl: 'https://example.go.kr',
};
const base: ApiAccess = { valleyId: 'v', status: 'unknown', control: null, upcoming: null };

describe('accessLine', () => {
  it('통제 중', () => {
    expect(accessLine({ ...base, status: 'closed', control }, true)).toBe(
      '입산 통제 11/1~12/15 · 북부지방산림청',
    );
  });
  it('지정 등산로만 개방', () => {
    expect(
      accessLine(
        { ...base, status: 'trail-open', control: { ...control, kind: 'trail-open' } },
        true,
      ),
    ).toBe('지정 등산로만 개방 11/1~12/15 · 북부지방산림청');
  });
  it('다가오는 통제', () => {
    expect(accessLine({ ...base, upcoming: control }, false)).toBe(
      '11/1부터 입산 통제 예정 · 북부지방산림청',
    );
  });
  it('기록 없음 — 산불조심기간엔 관할 확인, 아니면 숨김', () => {
    expect(accessLine(base, true)).toBe('통제 정보 없음 · 관할 확인');
    expect(accessLine(base, false)).toBeNull();
  });
});

describe('isWildfireSeason', () => {
  it('봄 2/1~5/15 · 가을 11/1~12/15 (KST)', () => {
    expect(isWildfireSeason(new Date('2026-01-31T15:00:00Z'))).toBe(true); // KST 2/1
    expect(isWildfireSeason(new Date('2026-05-15T14:59:00Z'))).toBe(true);
    expect(isWildfireSeason(new Date('2026-09-21T03:00:00Z'))).toBe(false);
    expect(isWildfireSeason(new Date('2026-11-01T03:00:00Z'))).toBe(true);
    expect(isWildfireSeason(new Date('2026-12-15T15:00:00Z'))).toBe(false); // KST 12/16
  });
});
