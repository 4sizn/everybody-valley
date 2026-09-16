/**
 * 비동기 생애 프로토콜.
 *
 * 지도 엔진처럼 "만들어 놓고 준비를 기다려야 하는" 자원은 생성자에서 일을
 * 끝낼 수 없다. 생성 → initialize(취소 가능) → ready → dispose 를 한 가지
 * 모양으로 통일해, 어댑터를 갈아끼워도 호출부가 바뀌지 않게 한다.
 */
import type { Disposable } from '../disposable';
import { ok, type Result, type VoidResult } from '../result';
import type { CancellationToken } from './cancellation';
import { Deferred } from './Deferred';

export const LIFECYCLE_STATES = ['idle', 'initializing', 'ready', 'failed', 'disposed'] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export interface AsyncInitializable extends Disposable {
  readonly state: LifecycleState;
  initialize(token: CancellationToken): Promise<VoidResult>;
}

/**
 * 한 번만 실행되는 비동기 준비 절차. 동시에 여러 번 불려도 작업은 한 번만
 * 돌고, 모두 같은 결과를 받는다. 실패도 캐시하되 `reset()` 으로 재시도할 수 있다.
 */
export class AsyncOnce<T> {
  readonly #factory: (token: CancellationToken) => Promise<Result<T>>;

  #inflight: Deferred<Result<T>> | undefined;
  #settled: Result<T> | undefined;

  constructor(factory: (token: CancellationToken) => Promise<Result<T>>) {
    this.#factory = factory;
  }

  get settled(): Result<T> | undefined {
    return this.#settled;
  }

  async get(token: CancellationToken): Promise<Result<T>> {
    if (this.#settled !== undefined) return this.#settled;
    if (this.#inflight !== undefined) return this.#inflight.promise;

    const deferred = new Deferred<Result<T>>();
    this.#inflight = deferred;
    const result = await this.#factory(token);
    this.#settled = result;
    this.#inflight = undefined;
    deferred.resolve(result);
    return result;
  }

  reset(): void {
    this.#settled = undefined;
    this.#inflight = undefined;
  }
}

/** 이벤트 한 번을 await 로 바꾼다. 취소되면 리스너를 반드시 떼고 돌아온다. */
export function waitForEvent(
  operation: string,
  subscribe: (resolve: () => void) => Disposable,
  token: CancellationToken,
): Promise<VoidResult> {
  const immediate = token.checkpoint(operation);
  if (!immediate.ok) return Promise.resolve(immediate);

  return new Promise<VoidResult>((resolve) => {
    const subscription = subscribe(() => {
      cancelLink.dispose();
      subscription.dispose();
      resolve(ok());
    });
    const cancelLink = token.onCancel((reason) => {
      subscription.dispose();
      resolve({ ok: false, error: reason });
    });
  });
}
