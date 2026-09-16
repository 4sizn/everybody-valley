/**
 * 계곡 티커 순환(F5c) — festival `NewsTickerController` 의 **클론**이다.
 *
 * 재사용하지 않는다 — CLAUDE.md `/firework` 결과물 보존 규칙과 2026-09-07 사용자 지시
 * ("festival 의 Ticker·NewsTickerController·TickerMessage 를 재사용하지 마라. 건드리지도
 * 마라") 때문이다. 그래서 이 파일은 그 세 파일 중 아무것도 import 하지 않는다 — 회전
 * 주기·페이드 시간 상수(`VALLEY_TICKER_TIMING`)도 같은 값을 독립적으로 다시 정의한다.
 *
 * `NewsTickerController` 와 다른 점 하나 — 문구가 생성자에 고정된 배열이 아니라
 * `getMessages()` 콜백이다. 계곡 티커는 제보 피드(SSE `report` 채널)를 따라 문구가
 * 바뀌므로 매 회전마다 다시 읽어야 한다(`MapSession` 이 `state.reports` 를 감싼 클로저를
 * 넘긴다).
 */

import type { ValleyTickerMessage } from '../domain/report/ReportFeed';
import { managedInterval, managedTimeout } from '../shared/async/timers';
import { type Disposable, DisposableStore, MutableDisposable } from '../shared/disposable';
import type { Logger } from '../shared/logger/Logger';
import type { SessionStore } from './state/SessionStore';

/** festival `TICKER_TIMING` 과 같은 값이지만 독립 상수다(클론 규칙 — 그 파일을 import 하지 않는다). */
export const VALLEY_TICKER_TIMING = {
  rotateMs: 3200,
  fadeMs: 350,
} as const;

export type ValleyTickerOptions = {
  readonly store: SessionStore;
  readonly logger: Logger;
  /** 매 회전마다 다시 읽는다 — 고정 배열로 캡처하지 않는다(제보 피드가 SSE 로 바뀐다). */
  readonly getMessages: () => readonly ValleyTickerMessage[];
  readonly rotateMs?: number;
  readonly fadeMs?: number;
};

export class ValleyTickerController implements Disposable {
  readonly #store: SessionStore;
  readonly #getMessages: () => readonly ValleyTickerMessage[];
  readonly #rotateMs: number;
  readonly #fadeMs: number;
  readonly #store$: DisposableStore;
  readonly #pendingSwap = new MutableDisposable();

  #started = false;
  #disposed = false;

  constructor(options: ValleyTickerOptions) {
    this.#store = options.store;
    this.#getMessages = options.getMessages;
    this.#rotateMs = options.rotateMs ?? VALLEY_TICKER_TIMING.rotateMs;
    this.#fadeMs = options.fadeMs ?? VALLEY_TICKER_TIMING.fadeMs;
    this.#store$ = new DisposableStore(options.logger);
    this.#store$.add(this.#pendingSwap);
  }

  start(): void {
    if (this.#started || this.#disposed) return;
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
    if (!this.#store.state.valleyTickerVisible) return;
    if (this.#getMessages().length === 0) return;

    this.#store.setValleyTickerVisible(false);
    this.#pendingSwap.value = managedTimeout(() => {
      if (this.#disposed) return;
      // 페이드 동안 피드가 바뀌었을 수 있다 — 교체 순간에 다시 읽는다.
      const messages = this.#getMessages();
      if (messages.length === 0) {
        this.#store.setValleyTickerVisible(true);
        return;
      }
      const next = (this.#store.state.valleyTickerIndex + 1) % messages.length;
      this.#store.setValleyTicker(next, true);
    }, this.#fadeMs);
  }
}
