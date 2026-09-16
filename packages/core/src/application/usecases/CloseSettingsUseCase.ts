/**
 * 설정 면 닫기 (C9) — × 버튼, Esc/뒤로가기, 다른 내비 탭.
 *
 * 목록 면으로 돌아간다(결정 (a) "닫기 = 목록 면"). 내비 탭은 기본 홈이고, 다른 탭을
 * 눌러 닫힌 경우 그 탭이 켜진다. 설정 면이 아닐 때는 조용히 끝난다.
 */
import type { CancellationToken } from '../../shared/async/cancellation';
import { CancelledError } from '../../shared/errors';
import { err, ok, type VoidResult } from '../../shared/result';
import type { SheetFlipCoordinator } from '../SheetFlipCoordinator';
import type { NavTab } from '../state/AppState';
import type { SessionStore } from '../state/SessionStore';

export type CloseSettingsDeps = {
  readonly store: SessionStore;
  readonly flip: SheetFlipCoordinator;
};

export class CloseSettingsUseCase {
  readonly #deps: CloseSettingsDeps;

  constructor(deps: CloseSettingsDeps) {
    this.#deps = deps;
  }

  async execute(token: CancellationToken, navTab: NavTab = 'home'): Promise<VoidResult> {
    const { store, flip } = this.#deps;
    if (store.state.sheetFace !== 'settings') {
      return err(new CancelledError('close-settings', { context: { reason: 'not-open' } }));
    }
    if (flip.busy) {
      return err(new CancelledError('close-settings', { context: { reason: 'flip-busy' } }));
    }

    // 탭 표시는 플립이 시작되는 순간 바뀐다 — 뒤집힘이 끝날 때까지 설정 탭이 켜져 있으면 늦어 보인다.
    store.setNavTab(navTab);
    const flipped = await flip.flipTo('list');
    const guard = token.checkpoint('close-settings');
    if (!guard.ok) return guard;
    return flipped.ok ? ok() : flipped;
  }
}
