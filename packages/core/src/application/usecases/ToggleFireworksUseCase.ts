/**
 * 불꽃 발사 on/off.
 *
 * 데모는 상태를 `window.__fwOn` 전역에 둔다. 커스텀 레이어(GL 코드)와 버튼
 * (DOM 코드)이 서로를 모른 채 전역 하나로 이야기하는 구조라, 레이어가 두 개
 * 되거나 화면이 재진입하면 곧 어긋난다. 스토어 → 엔진 한 방향으로 바꿨다.
 */

import type { Logger } from '../../shared/logger/Logger';
import { ok, type VoidResult } from '../../shared/result';
import type { MapEnginePort } from '../ports/MapEnginePort';
import type { SessionStore } from '../state/SessionStore';

export type ToggleFireworksDeps = {
  readonly engine: MapEnginePort;
  readonly store: SessionStore;
  readonly logger: Logger;
};

export class ToggleFireworksUseCase {
  readonly #deps: ToggleFireworksDeps;
  readonly #logger: Logger;

  constructor(deps: ToggleFireworksDeps) {
    this.#deps = deps;
    this.#logger = deps.logger.child('toggle-fireworks');
  }

  execute(): VoidResult {
    const { engine, store } = this.#deps;
    const next = !store.state.fireworksEnabled;

    const applied = engine.setFireworksEnabled(next);
    if (!applied.ok) {
      // 엔진이 불꽃을 지원하지 않으면 버튼 상태도 바꾸지 않는다 —
      // 눌렸는데 아무 일도 안 일어나는 UI 를 만들지 않기 위해.
      this.#logger.warn('불꽃 토글을 적용할 수 없다', { code: applied.error.code });
      return applied;
    }

    store.setFireworksEnabled(next);
    return ok();
  }
}
