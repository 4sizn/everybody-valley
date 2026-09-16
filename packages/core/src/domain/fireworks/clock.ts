/**
 * 시각 공급원. 단위는 초 — 데모의 `performance.now()/1000` 과 같다.
 *
 * `performance` 는 브라우저와 Hermes 모두에 있지만 없는 런타임도 있어
 * `Date.now()` 로 떨어진다. 시뮬레이션은 절대 시각이 아니라 경과 시간만
 * 쓰므로 두 공급원의 기준점 차이는 문제되지 않는다.
 */
export interface Clock {
  /** 단조 증가하는 초 단위 시각. */
  nowSeconds(): number;
}

export class PerformanceClock implements Clock {
  readonly #origin: number;

  constructor() {
    this.#origin = hasPerformance() ? 0 : Date.now();
  }

  nowSeconds(): number {
    return hasPerformance() ? performance.now() / 1000 : (Date.now() - this.#origin) / 1000;
  }
}

function hasPerformance(): boolean {
  return typeof performance !== 'undefined' && typeof performance.now === 'function';
}
