/**
 * 조건 필터 칩 토글 (N1, 결정 (c) 다중 선택).
 *
 * 순서는 그늘 토글(`ToggleShadeUseCase`)과 같다 — **지도에 먼저 반영** → 상태 갱신.
 * 엔진이 못 그리면 칩 선택도 바뀌지 않는다(눌렀는데 아무 일도 안 일어나는 버튼을
 * 만들지 않는다). 저장은 하지 않는다 — 세션 상태다(결정, 앱을 다시 열면 빈 선택).
 *
 * 동기다 — 그늘 시각(`SetShadeHourUseCase`)과 같은 이유. 카메라·플립처럼 취소할
 * 애니메이션이 없다.
 */
import type { FilterChipKey } from '../../domain/valley/filterChips';
import { toggleFilterChip } from '../../domain/valley/filterChips';
import { CancelledError } from '../../shared/errors';
import type { Logger } from '../../shared/logger/Logger';
import { err, ok, type VoidResult } from '../../shared/result';
import type { MapContentComposer } from '../MapContentComposer';
import type { MapEnginePort } from '../ports/MapEnginePort';
import { mapContentFilterOf } from '../state/AppState';
import type { SessionStore } from '../state/SessionStore';

export type ToggleFilterChipDeps = {
  readonly engine: MapEnginePort;
  readonly store: SessionStore;
  readonly composer: MapContentComposer;
  readonly logger: Logger;
};

export class ToggleFilterChipUseCase {
  readonly #deps: ToggleFilterChipDeps;
  readonly #logger: Logger;

  constructor(deps: ToggleFilterChipDeps) {
    this.#deps = deps;
    this.#logger = deps.logger.child('toggle-filter-chip');
  }

  execute(key: FilterChipKey): VoidResult {
    const { engine, store, composer } = this.#deps;
    const state = store.state;
    if (state.valleys === null) {
      return err(new CancelledError('toggle-filter-chip', { context: { reason: 'not-loaded' } }));
    }

    const nextSelected = toggleFilterChip(state.filterChips, key);
    const filter = mapContentFilterOf(state, nextSelected);
    const rendered = engine.renderContent(
      composer.content(state.shadeVisible, state.shadeHourIndex, filter),
    );
    if (!rendered.ok) {
      this.#logger.error('필터를 지도에 반영하지 못했다', rendered.error);
      return rendered;
    }
    store.setFilterChips(nextSelected);
    return ok();
  }
}
