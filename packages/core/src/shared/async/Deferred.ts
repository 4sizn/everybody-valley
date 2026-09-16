/** 외부에서 결정하는 Promise. 이벤트 기반 API 를 await 로 감쌀 때 쓴다. */
export class Deferred<T> {
  readonly promise: Promise<T>;

  #resolve!: (value: T) => void;
  #reject!: (reason: unknown) => void;
  #settled = false;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
  }

  get settled(): boolean {
    return this.#settled;
  }

  /** 이미 결정된 뒤의 호출은 조용히 무시한다 — 이벤트 중복 발화가 흔하다. */
  resolve(value: T): void {
    if (this.#settled) return;
    this.#settled = true;
    this.#resolve(value);
  }

  reject(reason: unknown): void {
    if (this.#settled) return;
    this.#settled = true;
    this.#reject(reason);
  }
}
