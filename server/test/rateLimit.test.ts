import { describe, expect, it } from 'vitest';
import { FixedWindowRateLimiter, TieredRateLimiter } from '../src/http/rateLimit';

describe('FixedWindowRateLimiter', () => {
  it('한도까지 허용하고 그 다음부터 거절한다', () => {
    let t = 1_000_000;
    const rl = new FixedWindowRateLimiter({ limit: 3, windowMs: 60_000, now: () => t });
    expect(rl.hit('a')).toMatchObject({ allowed: true, remaining: 2 });
    expect(rl.hit('a')).toMatchObject({ allowed: true, remaining: 1 });
    expect(rl.hit('a')).toMatchObject({ allowed: true, remaining: 0 });
    const d = rl.hit('a');
    expect(d.allowed).toBe(false);
    expect(d.remaining).toBe(0);
    expect(d.resetSec).toBeGreaterThan(0);
    expect(d.resetSec).toBeLessThanOrEqual(60);
    // 다른 키는 독립
    expect(rl.hit('b').allowed).toBe(true);
    t += 1;
  });

  it('창이 바뀌면 카운트가 리셋된다', () => {
    let t = 0;
    const rl = new FixedWindowRateLimiter({ limit: 1, windowMs: 60_000, now: () => t });
    expect(rl.hit('a').allowed).toBe(true);
    expect(rl.hit('a').allowed).toBe(false);
    t = 60_000;
    const d = rl.hit('a');
    expect(d.allowed).toBe(true);
    expect(d.resetSec).toBe(60);
  });

  it('항목이 많아지면 지난 창의 키를 비운다', () => {
    let t = 0;
    const rl = new FixedWindowRateLimiter({
      limit: 5,
      windowMs: 1_000,
      now: () => t,
      pruneAbove: 3,
    });
    rl.hit('a');
    rl.hit('b');
    rl.hit('c');
    expect(rl.size).toBe(3);
    t = 1_000;
    rl.hit('d');
    expect(rl.size).toBe(1);
  });
});

describe('TieredRateLimiter', () => {
  it('제보 작성 한도(F5a 결정 (h)) — 10분 3건을 넘으면 거절, 창이 지나면 다시 허용', () => {
    let t = 0;
    // 하루 한도는 절대 안 걸리게 크게 잡아 10분 창만 시험한다.
    const rl = new TieredRateLimiter({
      windows: [
        { limit: 3, windowMs: 10 * 60_000 },
        { limit: 1000, windowMs: 24 * 60 * 60_000 },
      ],
      now: () => t,
    });
    expect(rl.hit('ip').allowed).toBe(true);
    expect(rl.hit('ip').allowed).toBe(true);
    expect(rl.hit('ip').allowed).toBe(true);
    const blocked = rl.hit('ip');
    expect(blocked.allowed).toBe(false);
    expect(blocked.limit).toBe(3);

    t += 10 * 60_000;
    expect(rl.hit('ip').allowed).toBe(true);
    // 다른 IP 는 독립.
    expect(rl.hit('other').allowed).toBe(true);
  });

  it('하루 20건을 넘으면 10분 창이 비어 있어도 거절한다', () => {
    const t = 0;
    // 10분 한도는 절대 안 걸리게 크게 잡아 하루 창만 시험한다.
    const rl = new TieredRateLimiter({
      windows: [
        { limit: 1000, windowMs: 10 * 60_000 },
        { limit: 20, windowMs: 24 * 60 * 60_000 },
      ],
      now: () => t,
    });
    for (let i = 0; i < 20; i++) {
      expect(rl.hit('ip').allowed).toBe(true);
    }
    const blocked = rl.hit('ip');
    expect(blocked.allowed).toBe(false);
    expect(blocked.limit).toBe(20);
  });
});
