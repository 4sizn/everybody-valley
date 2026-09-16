/**
 * 그늘 보기 on/off (F4).
 *
 * 순서: 지도에 먼저 반영 → 상태 갱신 → 저장. 엔진이 못 그리면 상태도 바꾸지 않는다
 * (`ToggleFireworksUseCase` 와 같은 태도 — 눌렸는데 아무 일도 안 일어나는 버튼을 만들지
 * 않는다). 저장 실패는 화면을 되돌릴 이유가 아니라 경고만 남긴다(`SetSpotLayoutUseCase`).
 *
 * festival 장면에는 계곡 데이터가 없으므로 `not-loaded` 취소로 조용히 끝난다.
 */
import type { CancellationToken } from '../../shared/async/cancellation';
import { CancelledError } from '../../shared/errors';
import type { Logger } from '../../shared/logger/Logger';
import { err, ok, type VoidResult } from '../../shared/result';
import type { MapContentComposer } from '../MapContentComposer';
import type { MapEnginePort } from '../ports/MapEnginePort';
import { STORAGE_KEYS, type StoragePort } from '../ports/StoragePort';
import { mapContentFilterOf } from '../state/AppState';
import type { SessionStore } from '../state/SessionStore';

export type ToggleShadeDeps = {
  readonly engine: MapEnginePort;
  readonly store: SessionStore;
  readonly storage: StoragePort;
  readonly composer: MapContentComposer;
  readonly logger: Logger;
};

export class ToggleShadeUseCase {
  readonly #deps: ToggleShadeDeps;
  readonly #logger: Logger;

  constructor(deps: ToggleShadeDeps) {
    this.#deps = deps;
    this.#logger = deps.logger.child('toggle-shade');
  }

  async execute(token: CancellationToken): Promise<VoidResult> {
    const { engine, store, storage, composer } = this.#deps;
    const state = store.state;
    if (state.valleys === null) {
      return err(new CancelledError('toggle-shade', { context: { reason: 'not-loaded' } }));
    }

    const next = !state.shadeVisible;
    const rendered = engine.renderContent(
      composer.content(next, state.shadeHourIndex, mapContentFilterOf(state)),
    );
    if (!rendered.ok) {
      this.#logger.error('그늘 레이어를 반영하지 못했다', rendered.error);
      return rendered;
    }
    store.setShadeVisible(next);
    if (next && !composer.hasShade) {
      this.#logger.info('그늘 데이터가 없어 지도에는 얹히지 않는다', { visible: next });
    }

    const written = await storage.write(STORAGE_KEYS.shadeVisible, String(next), token);
    if (!written.ok) {
      this.#logger.warn('그늘 보기 설정을 저장하지 못했다', {
        code: written.error.code,
        visible: next,
      });
    }
    return ok();
  }
}
