/**
 * 선택 해제 — 명당·구간·시설 어느 것이든. 데모 `closeSpot()` 의 일반화.
 *   선택이 없거나 busy 면 무시 → 상태 해제 → 카메라 중단 → 핀·강조 제거 →
 *   (상세가 열려 있었다면) 넓은 시점으로 복귀 + 목록 면으로 플립.
 *
 * 종류별로 갈리는 것은 복귀 카메라뿐이다 — 명당은 데모 수치(`releaseSpot`),
 * 구간은 계곡 수치(`releaseSegment`). 시설은 상세를 열지 않았으니 핀만 지우고
 * 끝난다. 어느 종류인지는 `selectedFeatureKind` 가 상태에서 읽는다.
 */

import type { CameraCommand } from '../../domain/camera/CameraPose';
import { releaseSegment, releaseSpot } from '../../domain/camera/CameraPresets';
import type { CancellationToken } from '../../shared/async/cancellation';
import type { SerialTaskQueue } from '../../shared/async/SerialTaskQueue';
import { CancelledError } from '../../shared/errors';
import type { Logger } from '../../shared/logger/Logger';
import { err, ok, type VoidResult } from '../../shared/result';
import type { MapContentComposer } from '../MapContentComposer';
import type { MapEnginePort } from '../ports/MapEnginePort';
import { refreshFilteredMapContent } from '../refreshFilteredMapContent';
import type { SheetFlipCoordinator } from '../SheetFlipCoordinator';
import { type NavTab, type SheetFace, selectedFeatureKind } from '../state/AppState';
import type { SessionStore } from '../state/SessionStore';

export type ClearSelectionDeps = {
  readonly engine: MapEnginePort;
  readonly store: SessionStore;
  readonly flip: SheetFlipCoordinator;
  readonly cameraQueue: SerialTaskQueue;
  /** N1 — 필터가 걸려 있으면 선택 해제 뒤(핀 고정이 풀린 뒤) 지도를 다시 그린다. */
  readonly composer: MapContentComposer;
  readonly logger: Logger;
};

/**
 * 해제 뒤 어디로 가는가. 기본은 목록 + 홈 탭(데모 `closeSpot`). 상세에서 설정 탭을 누르면
 * 설정 면 + 설정 탭으로 곧장 간다(C9) — 목록을 거치는 두 번째 플립을 만들지 않기 위해.
 */
export type ClearSelectionTarget = {
  readonly face: Exclude<SheetFace, 'detail'>;
  readonly navTab: NavTab;
};

const DEFAULT_TARGET: ClearSelectionTarget = { face: 'list', navTab: 'home' };

export class ClearSelectionUseCase {
  readonly #deps: ClearSelectionDeps;
  readonly #logger: Logger;

  constructor(deps: ClearSelectionDeps) {
    this.#deps = deps;
    this.#logger = deps.logger.child('clear-selection');
  }

  async execute(
    token: CancellationToken,
    target: ClearSelectionTarget = DEFAULT_TARGET,
  ): Promise<VoidResult> {
    const { engine, store, flip, cameraQueue, composer } = this.#deps;
    const state = store.state;
    const kind = selectedFeatureKind(state);

    if (kind === null || flip.busy) {
      return err(
        new CancelledError('clear-selection', {
          context: { reason: kind === null ? 'no-selection' : 'flip-busy' },
        }),
      );
    }

    store.endSelection(target.navTab);

    const unpinned = engine.setSelection(null);
    if (!unpinned.ok) this.#logger.error('선택 표시를 지우지 못했다', unpinned.error);

    // N1 — 핀 고정이 풀렸다. 필터가 걸려 있으면 다시 그린다(그 계곡이 다시 걸릴 수 있다).
    refreshFilteredMapContent({ engine, store, composer, logger: this.#logger });

    // 시설은 상세를 열지 않았다 — 카메라도 면도 건드릴 것이 없다.
    if (kind === 'facility') return ok();

    engine.stopCamera();
    const release: CameraCommand = kind === 'spot' ? releaseSpot() : releaseSegment();
    const [, flipped] = await Promise.all([
      cameraQueue.run(
        `camera:release-${kind}`,
        (cameraToken) => engine.moveCamera(release, cameraToken),
        'preempt',
      ),
      flip.flipTo(target.face),
    ]);

    const guard = token.checkpoint('clear-selection');
    if (!guard.ok) return guard;
    return flipped.ok ? ok() : flipped;
  }
}
