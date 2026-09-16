/**
 * 실시간 소식 티커 순환.
 *
 * 데모: 3200ms 마다 opacity 0 → 350ms 뒤 문구 교체 후 opacity 1.
 * 두 타이머가 중첩되고 해제 경로가 없어, 화면을 떠난 뒤에도 계속 돈다.
 * 여기서는 내부 타임아웃까지 `MutableDisposable` 에 담아 최신 하나만 남긴다.
 */

import { TICKER_MESSAGES, TICKER_TIMING, type TickerMessage } from '../domain/news/TickerMessage';
import { managedInterval, managedTimeout } from '../shared/async/timers';
import { type Disposable, DisposableStore, MutableDisposable } from '../shared/disposable';
import type { Logger } from '../shared/logger/Logger';
import type { SessionStore } from './state/SessionStore';

export type NewsTickerOptions = {
  readonly store: SessionStore;
  readonly logger: Logger;
  readonly messages?: readonly TickerMessage[];
  readonly rotateMs?: number;
  readonly fadeMs?: number;
};

export class NewsTickerController implements Disposable {
  readonly #store: SessionStore;
  readonly #messages: readonly TickerMessage[];
  readonly #rotateMs: number;
  readonly #fadeMs: number;
  readonly #store$: DisposableStore;
  readonly #pendingSwap = new MutableDisposable();

  #started = false;
  #disposed = false;

  constructor(options: NewsTickerOptions) {
    this.#store = options.store;
    this.#messages = options.messages ?? TICKER_MESSAGES;
    this.#rotateMs = options.rotateMs ?? TICKER_TIMING.rotateMs;
    this.#fadeMs = options.fadeMs ?? TICKER_TIMING.fadeMs;
    this.#store$ = new DisposableStore(options.logger);
    this.#store$.add(this.#pendingSwap);
  }

  start(): void {
    if (this.#started || this.#disposed || this.#messages.length === 0) return;
    this.#started = true;
    this.#store$.add(managedInterval(() => this.#rotate(), this.#rotateMs));
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#store$.dispose();
  }

  #rotate(): void {
    if (this.#disposed) return;
    // 상세가 열려 티커가 숨어 있는 동안에는 문구를 굴리지 않는다.
    if (!this.#store.state.tickerVisible) return;

    this.#store.setTickerVisible(false);
    this.#pendingSwap.value = managedTimeout(() => {
      if (this.#disposed) return;
      const next = (this.#store.state.tickerIndex + 1) % this.#messages.length;
      this.#store.setTicker(next, true);
    }, this.#fadeMs);
  }
}
