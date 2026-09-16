/**
 * 취소 프로토콜.
 *
 * 원본 데모는 카메라 전환이 겹칠 때마다 `map.stop()` 을 부르고 `busy` 플래그로
 * 재진입을 막는다. 두 장치가 서로를 모르기 때문에, 애니메이션이 취소되면
 * finish 이벤트가 오지 않아 플래그가 영영 풀리지 않는 사고가 난다
 * (데모 주석에도 같은 함정이 적혀 있다).
 *
 * 여기서는 토큰 하나로 통일한다. 오래 걸리는 작업은 토큰을 받고, 중간중간
 * `checkpoint()` 로 살아 있는지 확인하며, 취소되면 `CancelledError` 를
 * `Result` 로 돌려준다. throw 하지 않으므로 잊고 지나칠 수 없다.
 *
 * `AbortController` 를 쓰지 않고 직접 구현한 이유: 코어는 호스트 전역에
 * 최소한으로만 의존한다(`types/host.d.ts` 참고). AbortSignal 이 필요한
 * 플랫폼 어댑터는 `toAbortSignal` 같은 브리지를 자기 계층에서 만든다.
 */

import { type Disposable, EMPTY_DISPOSABLE, toDisposable } from '../disposable';
import { CancelledError } from '../errors';
import { err, ok, type VoidResult } from '../result';

export interface CancellationToken {
  readonly cancelled: boolean;
  readonly reason: CancelledError | undefined;
  /** 취소 시 한 번 호출된다. 이미 취소된 토큰이면 즉시 호출된다. */
  onCancel(listener: (reason: CancelledError) => void): Disposable;
  /** 살아 있으면 ok, 취소되었으면 err(CancelledError). */
  checkpoint(operation: string): VoidResult<CancelledError>;
}

class TokenImpl implements CancellationToken {
  readonly #listeners = new Set<(reason: CancelledError) => void>();
  readonly #cancellable: boolean;

  #reason: CancelledError | undefined;

  constructor(cancellable: boolean) {
    this.#cancellable = cancellable;
  }

  get cancelled(): boolean {
    return this.#reason !== undefined;
  }

  get reason(): CancelledError | undefined {
    return this.#reason;
  }

  onCancel(listener: (reason: CancelledError) => void): Disposable {
    const reason = this.#reason;
    if (reason !== undefined) {
      listener(reason);
      return EMPTY_DISPOSABLE;
    }
    if (!this.#cancellable) return EMPTY_DISPOSABLE;
    this.#listeners.add(listener);
    return toDisposable(() => this.#listeners.delete(listener));
  }

  // 취소 사유는 취소 시점에 이미 기록돼 있어, 검사 지점의 이름은 쓰지 않는다.
  // 인자를 남겨 둔 것은 호출부가 "무엇을 검사하는지" 코드로 드러내기 위함이다.
  checkpoint(_operation: string): VoidResult<CancelledError> {
    const reason = this.#reason;
    return reason === undefined ? ok() : err(reason);
  }

  cancel(reason: CancelledError): void {
    if (!this.#cancellable || this.#reason !== undefined) return;
    this.#reason = reason;
    // 리스너가 자기 구독을 해제할 수 있으니 사본을 순회한다.
    const listeners = [...this.#listeners];
    this.#listeners.clear();
    for (const listener of listeners) listener(reason);
  }
}

/** 절대 취소되지 않는 토큰. 취소가 의미 없는 호출부에서 쓴다. */
export const NONE_CANCELLATION_TOKEN: CancellationToken = new TokenImpl(false);

export class CancellationTokenSource implements Disposable {
  readonly #token = new TokenImpl(true);

  #parentLink: Disposable = EMPTY_DISPOSABLE;

  constructor(parent?: CancellationToken) {
    if (parent !== undefined && parent !== NONE_CANCELLATION_TOKEN) {
      // 부모가 끊기면 자식도 끊긴다. 세션 생애에 하위 작업을 묶는 통로.
      this.#parentLink = parent.onCancel((reason) => this.cancel(reason.operation));
    }
  }

  get token(): CancellationToken {
    return this.#token;
  }

  cancel(operation = 'unknown'): void {
    this.#token.cancel(new CancelledError(operation));
  }

  dispose(): void {
    this.#parentLink.dispose();
    this.#parentLink = EMPTY_DISPOSABLE;
  }
}
