/**
 * 셸 배너 순수 로직(F3b, C7 자리) — 경보 우선순위 > 헬스, 활성 경보 중 가장 급한 것 고르기.
 */
import { toValleyId, UpstreamAlert } from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import { pickBanner, worstActiveAlert } from '../src/components/shell/shellBannerLogic';

function alert(
  level: 'watch' | 'warning' | 'evacuate',
  issuedAt: string,
  clearedAt: string | null = null,
): UpstreamAlert {
  return new UpstreamAlert({
    valleyId: toValleyId('v'),
    level,
    source: 'gauge',
    confidence: 'observed',
    observedAt: issuedAt,
    issuedAt,
    clearedAt,
  });
}

describe('pickBanner — 경보 > 헬스', () => {
  it('경보가 있으면 헬스와 무관하게 경보', () => {
    const item = { kind: 'alert' as const, level: 'warning' as const, message: 'm' };
    expect(pickBanner(item, true)).toBe(item);
    expect(pickBanner(item, false)).toBe(item);
  });

  it('경보가 없으면 헬스 장애일 때만 health, 아니면 null', () => {
    expect(pickBanner(null, true)).toEqual({ kind: 'health' });
    expect(pickBanner(null, false)).toBeNull();
  });
});

describe('worstActiveAlert', () => {
  it('null 이면 null', () => {
    expect(worstActiveAlert(null)).toBeNull();
  });

  it('watch 는 후보가 아니다 — warning 이상만', () => {
    const alerts = new Map([[toValleyId('a'), { alert: alert('watch', '2026-08-01T00:00:00Z') }]]);
    expect(worstActiveAlert(alerts)).toBeNull();
  });

  it('해제된 경보는 후보가 아니다', () => {
    const alerts = new Map([
      [
        toValleyId('a'),
        { alert: alert('warning', '2026-08-01T00:00:00Z', '2026-08-01T01:00:00Z') },
      ],
    ]);
    expect(worstActiveAlert(alerts)).toBeNull();
  });

  it('등급이 높은 쪽을 고른다', () => {
    const a = alert('warning', '2026-08-01T00:00:00Z');
    const b = alert('evacuate', '2026-08-01T00:00:00Z');
    const alerts = new Map([
      [toValleyId('a'), { alert: a }],
      [toValleyId('b'), { alert: b }],
    ]);
    expect(worstActiveAlert(alerts)?.valleyId).toBe('b');
  });

  it('등급이 같으면 먼저 발령된(더 오래 지속된) 쪽을 고른다', () => {
    const earlier = alert('warning', '2026-08-01T00:00:00Z');
    const later = alert('warning', '2026-08-01T01:00:00Z');
    const alerts = new Map([
      [toValleyId('later'), { alert: later }],
      [toValleyId('earlier'), { alert: earlier }],
    ]);
    expect(worstActiveAlert(alerts)?.valleyId).toBe('earlier');
  });
});
