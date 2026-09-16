/**
 * 직렬 작업 큐 — 겹치면 안 되는 비동기 명령의 유일한 진입점.
 *
 * 데모의 카메라 조작(`flyTo`/`easeTo`)과 시트 플립은 서로 겹치면 깨진다.
 * 데모는 `map.stop()` + `busy` 불리언으로 막지만, 취소된 애니메이션은
 * 완료 이벤트를 주지 않아 플래그가 잠긴 채 남는 창이 생긴다.
 *
 * 큐는 세 가지 겹침 정책을 명시적으로 고른다.
 *  · `preempt`      진행 중인 작업을 취소하고 새 작업을 실행한다 (카메라)
 *  · `queue`        앞 작업이 끝난 뒤 차례로 실행한다 (순차 연출)
 *  · `drop-if-busy` 바쁘면 새 작업을 버린다 (플립 중 재진입 차단)
 *
 * 어떤 경로로도 `busy` 가 잠기지 않는다. 상태 해제는 `finally` 한 곳에만 있다.
 */
import { type Disposable, EMPTY_DISPOSABLE } from '../disposable';
import { CancelledError, isCancelled, toAppError } from '../errors';
import type { Logger } from '../logger/Logger';
import { err, type Result } from '../result';
import {
  type CancellationToken,
  CancellationTokenSource,
  NONE_CANCELLATION_TOKEN,
} from './cancellation';
import { Deferred } from './Deferred';

export const TASK_MODES = ['preempt', 'queue', 'drop-if-busy'] as const;
export type TaskMode = (typeof TASK_MODES)[number];

export type Task<T> = (token: CancellationToken) => Promise<Result<T>>;

export type SerialTaskQueueOptions = {
  readonly name: string;
  readonly logger: Logger;
  /** 이 토큰이 취소되면 큐 전체가 멈춘다. 화면 생애와 묶는 용도. */
  readonly parentToken?: CancellationToken;
};

export class SerialTaskQueue implements Disposable {
  readonly #name: string;
  readonly #logger: Logger;
  readonly #parentToken: CancellationToken;

  #parentLink: Disposable = EMPTY_DISPOSABLE;
  #tail: Promise<void> = Promise.resolve();
  #active: CancellationTokenSource | undefined;
  #pending = 0;
  #disposed = false;

  constructor(options: SerialTaskQueueOptions) {
    this.#name = options.name;
    this.#logger = options.logger.child(`queue:${options.name}`);
    this.#parentToken = options.parentToken ?? NONE_CANCELLATION_TOKEN;
    if (this.#parentToken !== NONE_CANCELLATION_TOKEN) {
      this.#parentLink = this.#parentToken.onCancel(() => this.dispose());
    }
  }

  /** 실행 중이거나 대기 중인 작업이 있는가. */
  get busy(): boolean {
    return this.#pending > 0;
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  async run<T>(operation: string, task: Task<T>, mode: TaskMode = 'preempt'): Promise<Result<T>> {
    if (this.#disposed) return err(rejected(operation, 'queue-disposed'));
    if (mode === 'drop-if-busy' && this.busy) return err(rejected(operation, 'queue-busy'));
    if (mode === 'preempt') this.cancelActive(`preempted-by:${operation}`);

    this.#pending += 1;
    const previous = this.#tail;
    const gate = new Deferred<void>();
    this.#tail = gate.promise;

    try {
      await previous;
      if (this.#disposed) return err(rejected(operation, 'queue-disposed'));

      const source = new CancellationTokenSource(this.#parentToken);
      this.#active = source;
      try {
        const result = await task(source.token);
        if (!result.ok && !isCancelled(result.error)) {
          this.#logger.error(`'${operation}' 실패`, result.error);
        }
        return result;
      } catch (thrown) {
        // 작업이 규약을 어기고 throw 한 경우 — 큐가 잠기지 않도록 여기서 흡수한다.
        const error = toAppError(thrown, `'${operation}' 실행 중 예외`);
        this.#logger.error(`'${operation}' 이 Result 대신 예외를 던졌다`, error, {
          queue: this.#name,
        });
        return err(error);
      } finally {
        if (this.#active === source) this.#active = undefined;
        source.dispose();
      }
    } finally {
      this.#pending -= 1;
      gate.resolve();
    }
  }

  /** 진행 중인 작업만 취소한다. 큐는 계속 살아 있다. */
  cancelActive(reason: string): void {
    this.#active?.cancel(reason);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#parentLink.dispose();
    this.#parentLink = EMPTY_DISPOSABLE;
    this.cancelActive('queue-disposed');
    this.#active = undefined;
  }
}

function rejected(operation: string, reason: string): CancelledError {
  return new CancelledError(operation, { context: { reason } });
}
