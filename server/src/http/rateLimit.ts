/**
 * IP 별 고정 창 레이트리밋(결정 (g), 기본 60건/분). 프로세스 메모리에 든다 — 단일 인스턴스 전제.
 *
 * 순수 클래스(`FixedWindowRateLimiter`)와 Hono 미들웨어를 분리해 판정 규칙을 시각 주입으로 시험한다.
 */
import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context, MiddlewareHandler } from 'hono';

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  /** 창이 리셋되기까지 초(올림). */
  readonly resetSec: number;
}

export interface FixedWindowRateLimiterOptions {
  readonly limit: number;
  readonly windowMs?: number;
  readonly now?: () => number;
  /** 이 개수를 넘으면 지난 창의 항목을 비운다. */
  readonly pruneAbove?: number;
}

interface Bucket {
  windowStart: number;
  count: number;
}

/** `FixedWindowRateLimiter` 와 `TieredRateLimiter` 둘 다 만족하는 최소 계약 — 미들웨어는 이것만 안다. */
export interface RateLimiter {
  hit(key: string): RateLimitDecision;
}

export class FixedWindowRateLimiter implements RateLimiter {
  readonly limit: number;
  readonly windowMs: number;
  readonly #now: () => number;
  readonly #pruneAbove: number;
  readonly #buckets = new Map<string, Bucket>();

  constructor(options: FixedWindowRateLimiterOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs ?? 60_000;
    this.#now = options.now ?? Date.now;
    this.#pruneAbove = options.pruneAbove ?? 10_000;
  }

  hit(key: string): RateLimitDecision {
    const now = this.#now();
    const windowStart = now - (now % this.windowMs);
    let bucket = this.#buckets.get(key);
    if (bucket === undefined || bucket.windowStart !== windowStart) {
      if (this.#buckets.size >= this.#pruneAbove) this.#prune(windowStart);
      bucket = { windowStart, count: 0 };
      this.#buckets.set(key, bucket);
    }
    bucket.count += 1;
    const resetSec = Math.ceil((windowStart + this.windowMs - now) / 1000);
    return {
      allowed: bucket.count <= this.limit,
      limit: this.limit,
      remaining: Math.max(0, this.limit - bucket.count),
      resetSec,
    };
  }

  get size(): number {
    return this.#buckets.size;
  }

  #prune(windowStart: number): void {
    for (const [k, b] of this.#buckets) if (b.windowStart !== windowStart) this.#buckets.delete(k);
  }
}

export interface RateLimitWindow {
  readonly limit: number;
  readonly windowMs: number;
}

export interface TieredRateLimiterOptions {
  /** 창이 여럿이면 전부 통과해야 허용된다(결정 (h) — IP 당 10분 3건 ∧ 하루 20건). */
  readonly windows: readonly RateLimitWindow[];
  readonly now?: () => number;
}

/**
 * 여러 고정 창을 동시에 강제한다. 하나라도 막히면 그 결정(가장 이른 `resetSec`이 아니라 막힌 창)을
 * 돌려주고, 전부 통과하면 남은 여유가 가장 적은 창의 결정을 돌려준다(헤더에 더 보수적인 값이 실린다).
 * 창마다 매 호출을 셈한다 — 막힌 창도 이번 시도를 카운트한다(실제로 요청이 왔으므로).
 */
export class TieredRateLimiter implements RateLimiter {
  readonly #limiters: readonly FixedWindowRateLimiter[];

  constructor(options: TieredRateLimiterOptions) {
    this.#limiters = options.windows.map(
      (w) =>
        new FixedWindowRateLimiter({
          limit: w.limit,
          windowMs: w.windowMs,
          ...(options.now ? { now: options.now } : {}),
        }),
    );
  }

  hit(key: string): RateLimitDecision {
    const decisions = this.#limiters.map((l) => l.hit(key));
    const blocked = decisions.find((d) => !d.allowed);
    if (blocked) return blocked;
    return decisions.reduce((a, b) => (a.remaining <= b.remaining ? a : b));
  }
}

/** 클라이언트 IP. 프록시 뒤면 `X-Forwarded-For` 첫 주소, 아니면 소켓 주소. 둘 다 없으면 `'unknown'`. */
export function clientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = c.req.header('x-forwarded-for');
    const first = xff?.split(',')[0]?.trim();
    if (first) return first;
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export interface RateLimitMiddlewareOptions {
  readonly limiter: RateLimiter;
  readonly trustProxy: boolean;
  readonly keyOf?: (c: Context) => string;
}

export function rateLimit(options: RateLimitMiddlewareOptions): MiddlewareHandler {
  const keyOf = options.keyOf ?? ((c: Context) => clientIp(c, options.trustProxy));
  return async (c, next) => {
    const d = options.limiter.hit(keyOf(c));
    c.header('RateLimit-Limit', String(d.limit));
    c.header('RateLimit-Remaining', String(d.remaining));
    c.header('RateLimit-Reset', String(d.resetSec));
    if (!d.allowed) {
      c.header('Retry-After', String(d.resetSec));
      return c.json({ error: 'rate_limited', retryAfterSec: d.resetSec }, 429);
    }
    return next();
  };
}
