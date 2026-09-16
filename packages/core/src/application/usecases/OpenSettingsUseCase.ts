/**
 * 설정 면 열기 (C9) — 내비 설정 탭.
 *
 * 시트의 세 번째 면이다. 목록에서는 플립 한 번(접기 → 교체 → 펴기, 데모의 `flipTo`
 * 타이밍 그대로). 상세가 열려 있으면 선택을 해제하면서 **곧장** 설정 면으로 간다 —
 * 목록을 거쳐 두 번 뒤집으면 1초 가까이 화면이 접혔다 펴진다. 해제의 나머지(핀·강조
 * 제거, 복귀 카메라)는 `ClearSelectionUseCase` 가 그대로 하고 목적 면만 다르다.
 * 접힌 시트는 펴서 보여 준다 — 설정을 눌렀는데 손잡이만 남아 있으면 아무 일도 안 한 것처럼 보인다.
 * `full` 스냅이었다면 그대로 둔다(C8) — 사용자가 일부러 끌어올린 상태를 설정 열기가 되돌리지 않는다.
 */

import type { CancellationToken } from '../../shared/async/cancellation';
import { CancelledError } from '../../shared/errors';
import type { Logger } from '../../shared/logger/Logger';
import { err, ok, type VoidResult } from '../../shared/result';
import { revealSheet } from '../revealSheet';
import type { SheetFlipCoordinator } from '../SheetFlipCoordinator';
import { selectedFeatureKind } from '../state/AppState';
import type { SessionStore } from '../state/SessionStore';
import type { ClearSelectionUseCase } from './ClearSelectionUseCase';

export type OpenSettingsDeps = {
  readonly store: SessionStore;
  readonly flip: SheetFlipCoordinator;
  readonly clearSelection: ClearSelectionUseCase;
  readonly logger: Logger;
};

export class OpenSettingsUseCase {
  readonly #deps: OpenSettingsDeps;

  constructor(deps: OpenSettingsDeps) {
    this.#deps = deps;
  }

  async execute(token: CancellationToken): Promise<VoidResult> {
    const { store, flip, clearSelection } = this.#deps;
    const state = store.state;

    if (flip.busy) {
      return err(new CancelledError('open-settings', { context: { reason: 'flip-busy' } }));
    }

    store.setNavTab('settings');
    revealSheet(store);
    if (state.sheetFace === 'settings') return ok();

    if (selectedFeatureKind(state) !== null) {
      return clearSelection.execute(token, { face: 'settings', navTab: 'settings' });
    }

    const flipped = await flip.flipTo('settings');
    const guard = token.checkpoint('open-settings');
    if (!guard.ok) return guard;
    return flipped.ok ? ok() : flipped;
  }
}
