/**
 * 시설 선택 — 핀 + 목록 면 최상단 미니 행. 상세 면은 열지 않는다(F1 결정 (c)).
 *
 * 시설은 구간의 부속이다. 주차장을 누른 사용자가 알고 싶은 것은 "이게 어디
 * 있고 무료인가" 한 줄이지 화면 절반짜리 상세가 아니다. 그래서
 *   선택 기록 → 핀 세우기 → (상세가 열려 있었다면) 목록으로 돌아가기
 * 까지만 한다. 카메라는 움직이지 않는다 — 방금 누른 곳이 이미 화면에 있다.
 *
 * 상세가 열려 있던 경우: 지도 선택은 하나뿐이라 구간 강조가 핀으로 바뀌고
 * 상태의 구간 선택도 지워진다. 그러면 상세 면은 그릴 것이 없으므로 목록으로
 * 접는다(구간 닫기와 같은 카메라 복귀 포함). "플립 없음"은 상세를 **열지**
 * 않는다는 뜻이다.
 */

import { releaseSegment } from '../../domain/camera/CameraPresets';
import { lookupFacility } from '../../domain/valley/catalog';
import type { FacilityId } from '../../domain/valley/ids';
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

export type SelectFacilityDeps = {
  readonly engine: MapEnginePort;
  readonly store: SessionStore;
  readonly flip: SheetFlipCoordinator;
  readonly cameraQueue: SerialTaskQueue;
  /** N1 — 필터가 걸려 있으면 선택이 바뀐 뒤(핀 고정 계곡이 옮겨 간 뒤) 지도를 다시 그린다. */
  readonly composer: MapContentComposer;
  readonly logger: Logger;
};

export class SelectFacilityUseCase {
  readonly #deps: SelectFacilityDeps;
  readonly #logger: Logger;

  constructor(deps: SelectFacilityDeps) {
    this.#deps = deps;
    this.#logger = deps.logger.child('select-facility');
  }

  async execute(facilityId: FacilityId, token: CancellationToken): Promise<VoidResult> {
    const { engine, store, flip, cameraQueue, composer } = this.#deps;
    const state = store.state;

    if (flip.busy) {
      return err(new CancelledError('select-facility', { context: { reason: 'flip-busy' } }));
    }
    if (state.valleys === null) {
      return err(new CancelledError('select-facility', { context: { reason: 'not-loaded' } }));
    }

    const found = lookupFacility(state.valleys, facilityId);
    if (!found.ok) return found;
    const { facility } = found.value;

    const closingDetail = state.sheetFace === 'detail';
    store.beginFacilitySelection(facility.id);

    // 접혀 있으면 상세·목록이 화면 밖이라 아무 정보도 안 보인다(사용자 보고 2026-09-08).
    revealSheet(store);
    const pinned = engine.setSelection({ kind: 'facility', facility });
    if (!pinned.ok) this.#logger.error('시설 핀을 세우지 못했다', pinned.error);

    // N1 — 핀 고정 계곡이 이 시설의 계곡으로 옮겨 왔다. 필터가 걸려 있으면 다시 그린다.
    refreshFilteredMapContent({ engine, store, composer, logger: this.#logger });

    if (!closingDetail) return ok();

    // 구간 상세 위에서 시설을 골랐다 — 상세 닫기와 같은 복귀 절차.
    engine.stopCamera();
    const [, flipped] = await Promise.all([
      cameraQueue.run(
        'camera:release-segment',
        (cameraToken) => engine.moveCamera(releaseSegment(), cameraToken),
        'preempt',
      ),
      flip.flipTo('list'),
    ]);

    const guard = token.checkpoint('select-facility');
    if (!guard.ok) return guard;
    return flipped.ok ? ok() : flipped;
  }
}
