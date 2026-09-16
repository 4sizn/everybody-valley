/**
 * 시간 트랙의 시각 변경 (F4).
 *
 * 상태의 `shadeHourIndex` 는 그늘이 꺼져 있어도 바뀐다 — 상세 시트의 "그늘 · HH:00 기준"
 * 타일이 같은 값을 읽기 때문이다. 지도는 그늘이 **켜져 있을 때만** 다시 그린다. 그때도
 * `MapContentComposer` 가 바탕(구간·시설)은 같은 참조로 두므로 어댑터는 그늘 소스 하나만
 * 다시 쓴다. 시각은 저장하지 않는다(결정 (a)).
 */
import type { ShadeHourIndex } from '../../domain/valley/Segment';
import { CancelledError } from '../../shared/errors';
import type { Logger } from '../../shared/logger/Logger';
import { err, ok, type VoidResult } from '../../shared/result';
import type { MapContentComposer } from '../MapContentComposer';
import type { MapEnginePort } from '../ports/MapEnginePort';
import { mapContentFilterOf } from '../state/AppState';
import type { SessionStore } from '../state/SessionStore';

export type SetShadeHourDeps = {
  readonly engine: MapEnginePort;
  readonly store: SessionStore;
  readonly composer: MapContentComposer;
  readonly logger: Logger;
};

export class SetShadeHourUseCase {
  readonly #deps: SetShadeHourDeps;
  readonly #logger: Logger;

  constructor(deps: SetShadeHourDeps) {
    this.#deps = deps;
    this.#logger = deps.logger.child('set-shade-hour');
  }

  execute(index: ShadeHourIndex): VoidResult {
    const { engine, store, composer } = this.#deps;
    const state = store.state;
    if (state.valleys === null) {
      return err(new CancelledError('set-shade-hour', { context: { reason: 'not-loaded' } }));
    }
    if (state.shadeHourIndex === index) return ok();

    if (state.shadeVisible) {
      const rendered = engine.renderContent(
        composer.content(true, index, mapContentFilterOf(state)),
      );
      if (!rendered.ok) {
        this.#logger.error('그늘 시각을 지도에 반영하지 못했다', rendered.error);
        return rendered;
      }
    }
    store.setShadeHour(index);
    return ok();
  }
}
