/**
 * 구간 상세 열기 — 카드 탭과 지도 선 탭이 같은 경로를 탄다.
 *
 * `SelectSpotUseCase` 의 계곡판. 순서도 같다:
 *   busy 면 무시 → 선택 기록 → 진행 중 카메라 중단 → 선 강조(`setSelection`) →
 *   구간 중간점으로 비행 → 시트 플립.
 * 명당과 다른 점은 셋 — 핀이 아니라 선 강조(그 구분은 어댑터가 한다), 카메라가
 * 구간 **중간점**을 향한다(끝점은 옆 구간과 겹친다), 시점이 엔진의 3D 지형 유무로
 * 갈린다(C10 — 지형이 있으면 pitch 58 로 계곡 축을 가로질러, 없으면 pitch 30).
 */

import { focusSegment } from '../../domain/camera/CameraPresets';
import { lookupSegment } from '../../domain/valley/catalog';
import type { SegmentId } from '../../domain/valley/ids';
import type { CancellationToken } from '../../shared/async/cancellation';
import type { SerialTaskQueue } from '../../shared/async/SerialTaskQueue';
import { CancelledError } from '../../shared/errors';
import type { Logger } from '../../shared/logger/Logger';
import { err, ok, type VoidResult } from '../../shared/result';
import type { MapContentComposer } from '../MapContentComposer';
import type { MapEnginePort } from '../ports/MapEnginePort';
import { refreshFilteredMapContent } from '../refreshFilteredMapContent';
import { revealSheet } from '../revealSheet';
import type { SheetFlipCoordinator } from '../SheetFlipCoordinator';
import type { SessionStore } from '../state/SessionStore';

export type SelectSegmentDeps = {
  readonly engine: MapEnginePort;
  readonly store: SessionStore;
  readonly flip: SheetFlipCoordinator;
  readonly cameraQueue: SerialTaskQueue;
  /** N1 — 필터가 걸려 있으면 선택이 바뀐 뒤(핀 고정 계곡이 옮겨 간 뒤) 지도를 다시 그린다. */
  readonly composer: MapContentComposer;
  readonly logger: Logger;
};

export class SelectSegmentUseCase {
  readonly #deps: SelectSegmentDeps;
  readonly #logger: Logger;

  constructor(deps: SelectSegmentDeps) {
    this.#deps = deps;
    this.#logger = deps.logger.child('select-segment');
  }

  async execute(segmentId: SegmentId, token: CancellationToken): Promise<VoidResult> {
    const { engine, store, flip, cameraQueue, composer } = this.#deps;
    const state = store.state;

    if (flip.busy) {
      return err(new CancelledError('select-segment', { context: { reason: 'flip-busy' } }));
    }
    if (state.valleys === null) {
      return err(new CancelledError('select-segment', { context: { reason: 'not-loaded' } }));
    }

    const found = lookupSegment(state.valleys, segmentId);
    if (!found.ok) return found;
    const { segment } = found.value;

    // 이미 이 구간의 상세가 열려 있으면 할 일이 없다 — 상세 면에서 같은 선을
    // 다시 누른 경우. 플립을 다시 돌리면 화면만 깜빡인다.
    if (state.selectedSegmentId === segment.id && state.sheetFace === 'detail') return ok();

    store.beginSegmentSelection(segment.id);

    // 접혀 있으면 상세·목록이 화면 밖이라 아무 정보도 안 보인다(사용자 보고 2026-09-08).

    revealSheet(store);
    engine.stopCamera();

    const highlighted = engine.setSelection({ kind: 'segment', segment });
    if (!highlighted.ok) this.#logger.error('구간 강조를 반영하지 못했다', highlighted.error);

    // N1 — 핀 고정 계곡이 이 구간의 계곡으로 옮겨 왔다. 필터가 걸려 있으면 다시 그린다.
    refreshFilteredMapContent({ engine, store, composer, logger: this.#logger });

    /* 상세가 이미 열린 상태에서 다른 구간을 고르면 면은 그대로 두고 내용만
       바뀐다(선택 id 가 바뀌었으니 상세 면이 다시 그린다). 플립은 목록에서
       올 때만 돈다. */
    const needsFlip = state.sheetFace !== 'detail';
    const [camera, flipped] = await Promise.all([
      cameraQueue.run(
        'camera:focus-segment',
        (cameraToken) =>
          engine.moveCamera(
            focusSegment(segment, {
              terrain: engine.capabilities.terrain,
              insets: state.viewportInsets,
            }),
            cameraToken,
          ),
        'preempt',
      ),
      needsFlip ? flip.flipTo('detail') : Promise.resolve(ok()),
    ]);

    const guard = token.checkpoint('select-segment');
    if (!guard.ok) return guard;

    if (!camera.ok) this.#logger.debug('카메라 이동이 중단됐다', { code: camera.error.code });
    return flipped.ok ? ok() : flipped;
  }
}
