/**
 * 계곡 출입 통제 판정 — 날짜 안 기록 중 가장 강한 것, 개방 등산로가 통제구역을 이기는 규칙,
 * 기록 없음은 `unknown`.
 */
import { describe, expect, it } from 'vitest';
import { type AccessControl, evaluateAccess } from '../src/domain/valley/access';

const base = {
  valleyId: 'v',
  basis: 'parcel' as const,
  agency: '북부지방산림청',
  sourceUrl: 'https://example.go.kr/notice/1',
};
const autumn = (kind: AccessControl['kind']): AccessControl => ({
  ...base,
  kind,
  from: '2026-11-01',
  to: '2026-12-15',
});

describe('evaluateAccess', () => {
  it('기록 없음 → unknown, 통제 아님', () => {
    expect(evaluateAccess({ controls: [], today: '2026-11-05' })).toEqual({
      status: 'unknown',
      control: null,
      upcoming: null,
    });
  });

  it('기간 안 통제구역 → closed, 기간 밖이면 unknown + 다가오는 통제', () => {
    const c = autumn('closed-area');
    expect(evaluateAccess({ controls: [c], today: '2026-11-01' }).status).toBe('closed');
    expect(evaluateAccess({ controls: [c], today: '2026-12-15' }).status).toBe('closed');
    const before = evaluateAccess({ controls: [c], today: '2026-10-20' });
    expect(before.status).toBe('unknown');
    expect(before.upcoming).toBe(c);
  });

  it('통제구역 + 개방 등산로 → trail-open, 개방 기록이 상태를 정한다', () => {
    const open = { ...autumn('trail-open'), basis: 'trail' as const };
    const s = evaluateAccess({ controls: [autumn('closed-area'), open], today: '2026-11-10' });
    expect(s.status).toBe('trail-open');
    expect(s.control).toBe(open);
  });

  it('개방 등산로만 있고 통제구역 기록이 없으면 그대로 trail-open', () => {
    expect(evaluateAccess({ controls: [autumn('trail-open')], today: '2026-11-10' }).status).toBe(
      'trail-open',
    );
  });

  it('등산로 폐쇄만 있으면 closed', () => {
    expect(evaluateAccess({ controls: [autumn('trail-closed')], today: '2026-11-10' }).status).toBe(
      'closed',
    );
  });
});
