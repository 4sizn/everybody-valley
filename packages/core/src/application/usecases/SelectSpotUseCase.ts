/**
 * 명당 상세 열기.
 *
 * 데모 `openSpot(i)` 이 하는 일 그대로:
 *   busy 면 무시 → 선택 기록 → 진행 중 카메라 중단 → 핀 세우기 →
 *   내비 탭을 '명당' 으로 → 티커 숨김 → 상세 시점으로 비행 → 시트 플립.
 *
 * 데모에서는 이 일곱 가지가 한 함수 안에 순서대로 늘어서 있고, 그중 어느
 * 것이 실패해도 나머지가 계속 실행된다. 여기서는 실패가 Result 로 올라오고,
 * 카메라와 플립은 의도적으로 동시에 진행한다(데모도 겹쳐서 돌린다).
 */

import { focusSpot } from '../../domain/camera/CameraPresets';
import type { SpotId } from '../../domain/festival/SpotId';
import type { CancellationToken } from '../../shared/async/cancellation';
import type { SerialTaskQueue } from '../../shared/async/SerialTaskQueue';
import { CancelledError } from '../../shared/errors';
import type { Logger } from '../../shared/logger/Logger';
import { err, ok, type VoidResult } from '../../shared/result';
import type { MapEnginePort } from '../ports/MapEnginePort';
import type { SheetFlipCoordinator } from '../SheetFlipCoordinator';
import type { SessionStore } from '../state/SessionStore';

export type SelectSpotDeps = {
  readonly engine: MapEnginePort;
  readonly store: SessionStore;
  readonly flip: SheetFlipCoordinator;
  readonly cameraQueue: SerialTaskQueue;
  readonly logger: Logger;
};

export class SelectSpotUseCase {
  readonly #deps: SelectSpotDeps;
  readonly #logger: Logger;

  constructor(deps: SelectSpotDeps) {
    this.#deps = deps;
    this.#logger = deps.logger.child('select-spot');
  }

  async execute(spotId: SpotId, token: CancellationToken): Promise<VoidResult> {
    const { engine, store, flip, cameraQueue } = this.#deps;
    const state = store.state;

    // 진행 중인 플립이 있으면 **아무것도 바꾸지 않고** 돌아간다.
    // 코디네이터의 잠금은 동기적이므로 여기서 보는 값이 곧 진실이다.
    if (flip.busy) {
      return err(new CancelledError('select-spot', { context: { reason: 'flip-busy' } }));
    }

    const festival = state.festival;
    if (festival === null) {
      return err(new CancelledError('select-spot', { context: { reason: 'not-loaded' } }));
    }

    const found = festival.findSpot(spotId);
    if (!found.ok) return found;
    const spot = found.value;

    store.beginSelection(spot.id);

    // 진행 중인 순회 비행 등을 즉시 끊는다. 데모의 `map.stop()`.
    engine.stopCamera();

    const pinned = engine.setSelection({ kind: 'spot', spot });
    if (!pinned.ok) this.#logger.error('선택 핀을 세우지 못했다', pinned.error);

    const [camera, flipped] = await Promise.all([
      cameraQueue.run(
        'camera:focus-spot',
        (cameraToken) => engine.moveCamera(focusSpot(spot.position), cameraToken),
        'preempt',
      ),
      flip.flipTo('detail'),
    ]);

    const guard = token.checkpoint('select-spot');
    if (!guard.ok) return guard;

    // 카메라 취소는 정상 흐름이다 — 사용자가 곧바로 다른 조작을 한 것이므로
    // 실패로 올리지 않는다. 화면 상태를 좌우하는 플립만 결과에 반영한다.
    if (!camera.ok) this.#logger.debug('카메라 이동이 중단됐다', { code: camera.error.code });
    return flipped.ok ? ok() : flipped;
  }
}
