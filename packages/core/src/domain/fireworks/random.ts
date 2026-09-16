/**
 * 난수 공급원.
 *
 * `Math.random()` 을 직접 부르면 시뮬레이션을 테스트할 수 없고, 스크린샷
 * 기반 파리티 비교도 못 한다. 포트로 빼 두면 결정적 시드로 같은 불꽃을
 * 재현할 수 있다.
 */
export interface RandomSource {
  /** [0, 1) */
  next(): number;
}

export class MathRandomSource implements RandomSource {
  next(): number {
    return Math.random();
  }
}

/** mulberry32 — 짧고 분포가 고르다. 테스트·파리티 검증용. */
export class SeededRandomSource implements RandomSource {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0;
  }

  next(): number {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let t = this.#state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
