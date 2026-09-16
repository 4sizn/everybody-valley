/**
 * 베이스맵 헬스 상태기계의 시간 축.
 *
 * `BaseMapHealth.ts` 의 순수 함수에 시계와 타이머를 붙인다. web 과 네이티브 어댑터가
 * 같은 인스턴스를 만들어 쓰므로 "첫 실패 → 8초 → 장애" 절차가 두 벌로 갈리지 않는다.
 * 어댑터가 하는 일은 SDK 이벤트를 `failure()`·`success()` 로 번역하고 `retry` 에서
 * `reset()` 을 부르는 것뿐이다.
 *
 * 시계·타이머는 주입받는다 — 기본은 실제 것이고 테스트는 가짜 시계를 넣는다.
 *
 * 성공 무시 구간(`successQuietMs`) — 네이티브의 "완전히 그려졌다"(`onDidFinishRenderingMapFully`)
 * 는 오류난 타일도 완료로 치기 때문에, 실패 직후 몇백 ms 안의 성공 신호는 같은 프레임의
 * 잔향일 뿐이다. 그 구간 안의 성공은 세지 않는다. web 은 타일이 실제로 들어온 이벤트만
 * 성공으로 넘기므로 0 으로 둔다(기본).
 */
import type { Disposable } from '../../shared/disposable';
import {
  type BaseMapHealth,
  evaluate,
  INITIAL_BASE_MAP_HEALTH,
  noteFailure,
  noteSuccess,
  OUTAGE_SUSTAIN_MS,
} from './BaseMapHealth';

export type BaseMapHealthMonitorOptions = {
  /** 상태가 바뀔 때마다. 같은 상태(예: 이미 처음인데 성공)는 부르지 않는다. */
  readonly onChange: (health: BaseMapHealth) => void;
  /** 현재 시각(ms). 기본 `Date.now`. */
  readonly now?: () => number;
  /** 타이머. 기본 전역 `setTimeout`/`clearTimeout`. */
  readonly setTimeout?: (handler: () => void, delayMs: number) => unknown;
  readonly clearTimeout?: (handle: unknown) => void;
  /** 실패 뒤 이 시간 안의 성공은 무시한다(ms). 기본 0. */
  readonly successQuietMs?: number;
};

export class BaseMapHealthMonitor implements Disposable {
  readonly #onChange: (health: BaseMapHealth) => void;
  readonly #now: () => number;
  readonly #setTimeout: (handler: () => void, delayMs: number) => unknown;
  readonly #clearTimeout: (handle: unknown) => void;
  readonly #successQuietMs: number;

  #state: BaseMapHealth = INITIAL_BASE_MAP_HEALTH;
  #timer: unknown = null;
  #lastFailureAt: number | null = null;
  #disposed = false;

  constructor(options: BaseMapHealthMonitorOptions) {
    this.#onChange = options.onChange;
    this.#now = options.now ?? (() => Date.now());
    this.#setTimeout = options.setTimeout ?? ((handler, delayMs) => setTimeout(handler, delayMs));
    this.#clearTimeout =
      options.clearTimeout ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.#successQuietMs = options.successQuietMs ?? 0;
  }

  get state(): BaseMapHealth {
    return this.#state;
  }

  /** 베이스맵 리소스 하나가 실패했다. 첫 실패면 판정 타이머를 건다. */
  failure(): void {
    if (this.#disposed) return;
    const now = this.#now();
    this.#lastFailureAt = now;
    const wasArmed = this.#state.armedAt !== null;
    this.#set(noteFailure(this.#state, now));
    if (wasArmed) return;
    this.#timer = this.#setTimeout(() => {
      this.#timer = null;
      this.#set(evaluate(this.#state, this.#now()));
    }, OUTAGE_SUSTAIN_MS);
  }

  /** 타일이 들어왔다. arm·장애 상태였다면 즉시 회복. 무시 구간 안이면 아무 일도 없다. */
  success(): void {
    if (this.#disposed || this.#state === INITIAL_BASE_MAP_HEALTH) return;
    if (
      this.#lastFailureAt !== null &&
      this.#successQuietMs > 0 &&
      this.#now() - this.#lastFailureAt < this.#successQuietMs
    ) {
      return;
    }
    this.reset();
  }

  /** 재시도 — 타이머를 끊고 처음으로. 어댑터가 소스를 reload 한 뒤 부른다. */
  reset(): void {
    if (this.#disposed) return;
    this.#clearTimer();
    this.#lastFailureAt = null;
    this.#set(noteSuccess());
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#clearTimer();
  }

  #set(next: BaseMapHealth): void {
    if (next === this.#state) return;
    this.#state = next;
    this.#onChange(next);
  }

  #clearTimer(): void {
    if (this.#timer === null) return;
    this.#clearTimeout(this.#timer);
    this.#timer = null;
  }
}
