/**
 * 시트 플립 전환의 시간 축을 소유한다.
 *
 * 데모의 `flipTo` 는 2단계다. 높이가 다른 두 면을 한 컨테이너 180도 회전으로
 * 다룰 수 없어(뒷면을 absolute 로 띄워야 하고 그러면 스크롤이 깨진다)
 *   0→90도 접기(230ms) → 내용 교체 → 90→0도 펴기(260ms)
 * 로 쪼갠 것이다.
 *
 * 그 타이밍이 표현 계층에 흩어지면 web 과 네이티브가 서로 다른 값을 갖게 된다.
 * 여기서 상태(`flipPhase`, `sheetFace`)만 굴리고, 각 플랫폼은 그 상태를
 * 자기 방식(CSS transition / Reanimated)으로 그린다.
 */

import { SerialTaskQueue } from '../shared/async/SerialTaskQueue';
import { delay } from '../shared/async/timers';
import type { Disposable } from '../shared/disposable';
import { CancelledError } from '../shared/errors';
import type { Logger } from '../shared/logger/Logger';
import { err, ok, type VoidResult } from '../shared/result';
import type { SheetFace } from './state/AppState';
import type { SessionStore } from './state/SessionStore';

/** 데모의 `.flip` transition 220ms / setTimeout 230ms, `.back` 240ms / 260ms. */
export const FLIP_TIMING = {
  foldMs: 230,
  unfoldMs: 260,
} as const;

export type SheetFlipCoordinatorOptions = {
  readonly store: SessionStore;
  readonly logger: Logger;
};

export class SheetFlipCoordinator implements Disposable {
  readonly #store: SessionStore;
  readonly #queue: SerialTaskQueue;

  /**
   * 재진입 잠금. **동기적으로** 잠가야 한다.
   *
   * 큐의 `busy` 는 작업이 실제로 실행에 들어간 뒤에야 켜진다(`await previous`
   * 를 지나야 한다). 그 한 틱 동안 두 번째 호출이 통과해 상태를 먼저 바꿔
   * 버리는 창이 생긴다 — 목록에서 A 를 누른 직후 B 를 누르면 화면은 A 의
   * 상세를 열지만 선택 상태는 B 가 되는 어긋남이다.
   *
   * 데모도 같은 이유로 `flipTo` 첫 줄에서 `busy = true` 를 동기적으로 세운다.
   */
  #busy = false;

  constructor(options: SheetFlipCoordinatorOptions) {
    this.#store = options.store;
    this.#queue = new SerialTaskQueue({ name: 'sheet-flip', logger: options.logger });
  }

  get busy(): boolean {
    return this.#busy;
  }

  /**
   * 면을 바꾼다. 전환 중 호출은 버린다 — 데모의 `if (busy) return` 과 같다.
   * `onSwap` 은 접힘이 끝난 순간, 화면이 거의 보이지 않을 때 실행된다.
   */
  flipTo(face: SheetFace, onSwap?: () => void): Promise<VoidResult> {
    if (this.#busy) {
      return Promise.resolve(
        err(new CancelledError(`flip:${face}`, { context: { reason: 'flip-busy' } })),
      );
    }
    this.#busy = true;
    // 접힘을 즉시 반영한다. 표현 계층은 이 상태를 보고 회전을 시작한다.
    this.#store.setFlipPhase('folding');

    return this.#queue
      .run(
        `flip:${face}`,
        async (token) => {
          try {
            const folded = await delay(FLIP_TIMING.foldMs, token);
            if (!folded.ok) return folded;

            onSwap?.();
            this.#store.setSheetFace(face);
            this.#store.setFlipPhase('unfolding');

            const unfolded = await delay(FLIP_TIMING.unfoldMs, token);
            return unfolded.ok ? ok() : unfolded;
          } finally {
            this.#store.setFlipPhase('idle');
          }
        },
        'queue',
      )
      .finally(() => {
        // 큐가 작업을 시작하지 못한 경우(dispose 등)에도 잠금이 남지 않게 한다.
        this.#busy = false;
        if (this.#store.state.flipPhase !== 'idle') this.#store.setFlipPhase('idle');
      });
  }

  dispose(): void {
    this.#queue.dispose();
    this.#busy = false;
  }
}
