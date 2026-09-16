/**
 * 정리(cleanup) 프로토콜.
 *
 * 원본 데모는 setInterval·이벤트 리스너·GL 버퍼·마커·Web Animation 을
 * 만들어 놓고 되돌리지 않는다. 화면이 하나뿐인 페이지에서는 티가 안 나지만
 * 라우팅·핫리로드·화면 재진입이 있는 앱에서는 그대로 누수가 된다.
 *
 * 규약
 *  · 자원을 만드는 함수는 반드시 `Disposable` 을 돌려준다.
 *  · 소유자는 `DisposableStore` 에 모아 두고 자기 생애 끝에서 한 번 비운다.
 *  · `dispose()` 는 몇 번 불려도 안전해야 한다(멱등).
 */
import { toAppError } from './errors';
import type { Logger } from './logger/Logger';

export interface Disposable {
  dispose(): void;
}

export function toDisposable(dispose: () => void): Disposable {
  let disposed = false;
  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      dispose();
    },
  };
}

export const EMPTY_DISPOSABLE: Disposable = { dispose(): void {} };

/**
 * 여러 자원을 한 묶음으로 다룬다. 역순으로 정리해 의존 관계를 지킨다.
 * 하나가 던져도 나머지는 반드시 정리한다.
 */
export class DisposableStore implements Disposable {
  readonly #items: Disposable[] = [];
  readonly #logger: Logger | undefined;

  #disposed = false;

  constructor(logger?: Logger) {
    this.#logger = logger;
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  get size(): number {
    return this.#items.length;
  }

  /**
   * 자원을 등록하고 그대로 돌려준다. 이미 정리된 store 에 넣으면 즉시 정리한다
   * — 비동기 초기화가 화면 이탈 뒤에 끝나는 흔한 경합을 여기서 흡수한다.
   */
  add<T extends Disposable>(item: T): T {
    if (this.#disposed) {
      this.#logger?.warn('정리된 store 에 등록 시도 — 즉시 정리한다');
      item.dispose();
      return item;
    }
    this.#items.push(item);
    return item;
  }

  /** 함수를 자원처럼 등록한다. */
  addFn(dispose: () => void): Disposable {
    return this.add(toDisposable(dispose));
  }

  /** store 를 비우지만 살려 둔다. 재초기화 지점에서 쓴다. */
  clear(): void {
    this.#drain();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#drain();
  }

  #drain(): void {
    while (this.#items.length > 0) {
      const item = this.#items.pop();
      if (item === undefined) continue;
      try {
        item.dispose();
      } catch (thrown) {
        this.#logger?.error('자원 정리 중 예외', toAppError(thrown, '자원 정리 실패'));
      }
    }
  }
}

/**
 * 한 자리에 자원 하나만 두고, 새로 넣으면 이전 것을 정리한다.
 * "선택된 핀", "진행 중인 애니메이션" 처럼 최신 하나만 유효한 자원에 쓴다.
 */
export class MutableDisposable implements Disposable {
  #current: Disposable | undefined;
  #disposed = false;

  get value(): Disposable | undefined {
    return this.#current;
  }

  set value(next: Disposable | undefined) {
    if (this.#current === next) return;
    this.#current?.dispose();
    if (this.#disposed) {
      next?.dispose();
      this.#current = undefined;
      return;
    }
    this.#current = next;
  }

  clear(): void {
    this.value = undefined;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#current?.dispose();
    this.#current = undefined;
  }
}
