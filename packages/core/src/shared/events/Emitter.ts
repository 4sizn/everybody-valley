/**
 * 타입 안전 이벤트 에미터.
 *
 * · 구독은 `Disposable` 로 돌려준다. 해제 경로 없는 구독을 만들 수 없다.
 * · 리스너 하나가 던져도 나머지 리스너는 계속 호출된다. 지도 엔진의 콜백에서
 *   UI 예외가 새어 나와 카메라 상태 갱신을 멈추는 일을 막는다.
 * · 발화 중 구독/해제가 일어나도 안전하도록 사본을 순회한다.
 */
import type { Disposable } from '../disposable';
import { toDisposable } from '../disposable';
import { toAppError } from '../errors';
import type { Logger } from '../logger/Logger';

export type EventMap = Record<string, unknown>;

export type Listener<P> = (payload: P) => void;

/** 발화 권한 없이 구독만 노출하는 읽기 전용 얼굴. 포트의 공개 타입으로 쓴다. */
export interface EmitterView<T extends EventMap> {
  on<K extends keyof T & string>(event: K, listener: Listener<T[K]>): Disposable;
  once<K extends keyof T & string>(event: K, listener: Listener<T[K]>): Disposable;
}

export class Emitter<T extends EventMap> implements EmitterView<T>, Disposable {
  readonly #listeners = new Map<string, Set<Listener<never>>>();
  readonly #logger: Logger | undefined;

  #disposed = false;

  constructor(logger?: Logger) {
    this.#logger = logger;
  }

  on<K extends keyof T & string>(event: K, listener: Listener<T[K]>): Disposable {
    if (this.#disposed) return toDisposable(() => {});
    const bucket = this.#listeners.get(event) ?? new Set<Listener<never>>();
    bucket.add(listener as Listener<never>);
    this.#listeners.set(event, bucket);
    return toDisposable(() => {
      bucket.delete(listener as Listener<never>);
      if (bucket.size === 0) this.#listeners.delete(event);
    });
  }

  once<K extends keyof T & string>(event: K, listener: Listener<T[K]>): Disposable {
    const subscription = this.on(event, (payload) => {
      subscription.dispose();
      listener(payload);
    });
    return subscription;
  }

  emit<K extends keyof T & string>(event: K, payload: T[K]): void {
    if (this.#disposed) return;
    const bucket = this.#listeners.get(event);
    if (bucket === undefined || bucket.size === 0) return;
    for (const listener of [...bucket]) {
      try {
        (listener as Listener<T[K]>)(payload);
      } catch (thrown) {
        this.#logger?.error(`'${event}' 리스너에서 예외`, toAppError(thrown, '리스너 실패'), {
          event,
        });
      }
    }
  }

  listenerCount(event: keyof T & string): number {
    return this.#listeners.get(event)?.size ?? 0;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#listeners.clear();
  }
}
