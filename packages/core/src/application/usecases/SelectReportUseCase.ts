/**
 * 제보 상세 열기(F5c) — 목록 면 "실시간 정보" 카드 탭.
 *
 * `SelectSegmentUseCase` 의 제보판이지만 훨씬 단순하다: 지도에 제보를 그리지 않으므로
 * (결정 (j)) 카메라·엔진 선택이 없다 — 선택 기록 + 시트 플립뿐이다.
 */
import type { CancellationToken } from '../../shared/async/cancellation';
import { CancelledError } from '../../shared/errors';
import { err, ok, type VoidResult } from '../../shared/result';
import { revealSheet } from '../revealSheet';
import type { SheetFlipCoordinator } from '../SheetFlipCoordinator';
import type { SessionStore } from '../state/SessionStore';

export type SelectReportDeps = {
  readonly store: SessionStore;
  readonly flip: SheetFlipCoordinator;
};

export class SelectReportUseCase {
  readonly #deps: SelectReportDeps;

  constructor(deps: SelectReportDeps) {
    this.#deps = deps;
  }

  async execute(reportId: string, token: CancellationToken): Promise<VoidResult> {
    const { store, flip } = this.#deps;
    const state = store.state;

    if (flip.busy) {
      return err(new CancelledError('select-report', { context: { reason: 'flip-busy' } }));
    }
    if (state.reports === null) {
      return err(new CancelledError('select-report', { context: { reason: 'not-loaded' } }));
    }
    const found = state.reports.some((report) => report.id === reportId);
    if (!found) {
      return err(new CancelledError('select-report', { context: { reason: 'not-found' } }));
    }

    // 이미 이 제보의 상세가 열려 있으면 할 일이 없다 — 다시 뒤집으면 화면만 깜빡인다.
    if (state.selectedReportId === reportId && state.sheetFace === 'detail') return ok();

    store.beginReportSelection(reportId);

    // 접혀 있으면 상세·목록이 화면 밖이라 아무 정보도 안 보인다(사용자 보고 2026-09-08).

    revealSheet(store);
    const needsFlip = state.sheetFace !== 'detail';
    const flipped = needsFlip ? await flip.flipTo('detail') : ok();

    const guard = token.checkpoint('select-report');
    if (!guard.ok) return guard;
    return flipped.ok ? ok() : flipped;
  }
}
