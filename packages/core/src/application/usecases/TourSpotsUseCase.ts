/**
 * 명당 순회 비행.
 *
 * 데모는 모듈 지역 변수 `tour` 를 후위 증가시킨다.
 *   `const s = SPOTS[tour++ % SPOTS.length]`  → 목표는 증가 전 인덱스
 *   `bearing:(tour*47)%360`                   → 방위는 증가 후 값
 * 그래서 첫 클릭은 0번 명당 + 47도, 두 번째는 1번 + 94도가 된다.
 * 이 어긋남까지 그대로 재현한다.
 */

import { tourStep } from '../../domain/camera/CameraPresets';
import type { CancellationToken } from '../../shared/async/cancellation';
import type { SerialTaskQueue } from '../../shared/async/SerialTaskQueue';
import { CancelledError } from '../../shared/errors';
import { err, type VoidResult } from '../../shared/result';
import type { MapEnginePort } from '../ports/MapEnginePort';
import type { SessionStore } from '../state/SessionStore';

export type TourSpotsDeps = {
  readonly engine: MapEnginePort;
  readonly store: SessionStore;
  readonly cameraQueue: SerialTaskQueue;
};

export class TourSpotsUseCase {
  readonly #deps: TourSpotsDeps;

  #step = 0;

  constructor(deps: TourSpotsDeps) {
    this.#deps = deps;
  }

  /** 지금까지 진행한 회차. 테스트·디버그용. */
  get step(): number {
    return this.#step;
  }

  execute(_token: CancellationToken): Promise<VoidResult> {
    const { engine, store, cameraQueue } = this.#deps;
    const spots = store.state.festival?.spots ?? [];
    if (spots.length === 0) {
      return Promise.resolve(
        err(new CancelledError('tour-spots', { context: { reason: 'no-spots' } })),
      );
    }

    const spot = spots[this.#step % spots.length];
    this.#step += 1;
    if (spot === undefined) {
      return Promise.resolve(
        err(new CancelledError('tour-spots', { context: { reason: 'index-out-of-range' } })),
      );
    }

    return cameraQueue.run(
      'camera:tour',
      (token) => engine.moveCamera(tourStep(spot.position, this.#step), token),
      'preempt',
    );
  }
}
