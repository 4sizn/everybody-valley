/**
 * 발사 스케줄러.
 *
 * 데모는 커스텀 레이어의 `onAdd` 안에서 즉시 한 발, 700ms·1400ms 뒤 한 발씩
 * 쏘고 이후 620ms 주기로 반복한다. 주기 타이머는 `this._timer` 에 담아
 * `onRemove` 에서 정리하지만, 앞의 두 `setTimeout` 은 회수되지 않는다.
 * 레이어가 곧바로 제거되면 이미 사라진 레이어를 향해 발사가 일어난다.
 *
 * 여기서는 예비 발사까지 전부 `DisposableStore` 에 담아, 스케줄러 하나를
 * 버리면 예약된 모든 발사가 함께 사라진다.
 */

import { managedInterval, managedTimeout } from '../../shared/async/timers';
import type { Disposable } from '../../shared/disposable';
import { DisposableStore } from '../../shared/disposable';
import type { Logger } from '../../shared/logger/Logger';
import { BURST_SCHEDULE } from './FireworkConfig';

export type BurstScheduleConfig = {
  readonly primingDelaysMs: readonly number[];
  readonly intervalMs: number;
};

export type BurstSchedulerOptions = {
  readonly onBurst: () => void;
  readonly schedule?: BurstScheduleConfig;
  readonly logger?: Logger;
  /** 시작 시 발사 여부. 데모의 `window.__fwOn` 초기값과 같이 true. */
  readonly enabled?: boolean;
};

export class BurstScheduler implements Disposable {
  readonly #onBurst: () => void;
  readonly #schedule: BurstScheduleConfig;
  readonly #store: DisposableStore;

  #enabled: boolean;
  #started = false;
  #disposed = false;

  constructor(options: BurstSchedulerOptions) {
    this.#onBurst = options.onBurst;
    this.#schedule = options.schedule ?? BURST_SCHEDULE;
    this.#store = new DisposableStore(options.logger);
    this.#enabled = options.enabled ?? true;
  }

  get enabled(): boolean {
    return this.#enabled;
  }

  /** 여러 번 불려도 타이머는 한 벌만 돈다. */
  start(): void {
    if (this.#started || this.#disposed) return;
    this.#started = true;

    for (const delayMs of this.#schedule.primingDelaysMs) {
      if (delayMs === 0) {
        this.#fire();
        continue;
      }
      this.#store.add(managedTimeout(() => this.#fire(), delayMs));
    }
    this.#store.add(managedInterval(() => this.#fire(), this.#schedule.intervalMs));
  }

  /**
   * 발사를 켜고 끈다. 이미 떠 있는 불꽃은 건드리지 않는다 — 데모처럼
   * 남은 잔광이 자연히 사그라든다.
   */
  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#store.dispose();
  }

  #fire(): void {
    if (this.#disposed || !this.#enabled) return;
    this.#onBurst();
  }
}
