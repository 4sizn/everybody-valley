/**
 * 불변 스냅샷 + 구독 스토어.
 *
 * React 의 `useSyncExternalStore` 규약(`subscribe` / `getSnapshot`)에 그대로
 * 맞춰 두었다. 덕분에 애플리케이션 계층은 React 를 import 하지 않고,
 * 표현 계층은 상태 관리 라이브러리를 들이지 않는다. RN 전향 시에도 그대로 쓴다.
 */
import type { Disposable } from '../disposable';
import { toDisposable } from '../disposable';
import { toAppError } from '../errors';
import type { Logger } from '../logger/Logger';

export type Updater<S> = (current: S) => S;

export class ObservableStore<S> implements Disposable {
  readonly #listeners = new Set<() => void>();
  readonly #logger: Logger | undefined;

  #snapshot: S;
  #disposed = false;

  constructor(initial: S, logger?: Logger) {
    this.#snapshot = initial;
    this.#logger = logger;
  }

  /** 항상 같은 참조를 돌려줘야 한다 — React 가 이 참조로 재렌더를 판단한다. */
  getSnapshot = (): S => this.#snapshot;

  subscribe = (listener: () => void): Disposable => {
    if (this.#disposed) return toDisposable(() => {});
    this.#listeners.add(listener);
    return toDisposable(() => this.#listeners.delete(listener));
  };

  /** React 가 요구하는 `() => void` 해제 함수 형태. */
  subscribeRaw = (listener: () => void): (() => void) => {
    const subscription = this.subscribe(listener);
    return () => subscription.dispose();
  };

  /** 새 스냅샷이 이전과 같은 참조면 알리지 않는다. */
  update(updater: Updater<S>): void {
    if (this.#disposed) return;
    const next = updater(this.#snapshot);
    if (next === this.#snapshot) return;
    this.#snapshot = next;
    this.#notify();
  }

  /** 부분 갱신. 값이 모두 같으면 알리지 않는다. */
  patch(partial: Partial<S>): void {
    this.update((current) => {
      let changed = false;
      for (const key of Object.keys(partial) as (keyof S)[]) {
        const value = partial[key];
        if (value !== undefined && current[key] !== value) {
          changed = true;
          break;
        }
      }
      return changed ? { ...current, ...partial } : current;
    });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#listeners.clear();
  }

  #notify(): void {
    for (const listener of [...this.#listeners]) {
      try {
        listener();
      } catch (thrown) {
        this.#logger?.error('스토어 구독자에서 예외', toAppError(thrown, '구독자 실패'));
      }
    }
  }
}
