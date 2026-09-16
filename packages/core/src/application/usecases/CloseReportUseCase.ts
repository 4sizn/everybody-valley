/**
 * 제보 상세 닫기(F5c) — 상세 면의 × 버튼, Esc/뒤로가기.
 *
 * `CloseSettingsUseCase` 와 같은 모양 — 카메라·엔진 선택이 없으니 목록 면으로
 * 플립하고 선택을 지우는 것으로 끝난다.
 */
import type { CancellationToken } from '../../shared/async/cancellation';
import { CancelledError } from '../../shared/errors';
import { err, ok, type VoidResult } from '../../shared/result';
import type { SheetFlipCoordinator } from '../SheetFlipCoordinator';
import type { SessionStore } from '../state/SessionStore';

export type CloseReportDeps = {
  readonly store: SessionStore;
  readonly flip: SheetFlipCoordinator;
};

export class CloseReportUseCase {
  readonly #deps: CloseReportDeps;

  constructor(deps: CloseReportDeps) {
    this.#deps = deps;
  }

  async execute(token: CancellationToken): Promise<VoidResult> {
    const { store, flip } = this.#deps;
    if (store.state.selectedReportId === null) {
      return err(new CancelledError('close-report', { context: { reason: 'no-selection' } }));
    }
    if (flip.busy) {
      return err(new CancelledError('close-report', { context: { reason: 'flip-busy' } }));
    }

    store.endReportSelection();
    const flipped = await flip.flipTo('list');
    const guard = token.checkpoint('close-report');
    if (!guard.ok) return guard;
    return flipped.ok ? ok() : flipped;
  }
}
