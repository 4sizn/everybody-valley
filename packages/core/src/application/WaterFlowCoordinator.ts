/**
 * 물줄기 흐름 애니메이션의 on/off 규칙 (C10c).
 *
 * 흐름(`line-dasharray` 시퀀스 교체)은 어댑터가 rAF/타이머로 돌린다. 언제 돌릴지는
 * 애플리케이션이 정한다 — 배터리를 쓰는 연출이라 **보일 때만**:
 *   · 계곡 장면이고 세션이 ready 인가
 *   · 시트가 `peek` 이 아닌가(접히면 사용자가 지도를 보는 중이 아니라 훑는 중 — 결정에
 *     따라 멈춘다. `half`·`full` 은 둘 다 "펴져 있다"로 친다, C8)
 *   · 앱이 전면인가(`appActive`, RN `AppState` / 브라우저 visibility 를 표현 계층이 넘긴다)
 * 셋이 모두 참일 때만 켠다. 상태가 바뀔 때마다 다시 계산하고 **값이 바뀔 때만** 엔진에
 * 말한다 — 어댑터의 타이머가 매 스냅샷마다 재시작되지 않게.
 *
 * festival 장면은 항상 꺼져 있다(물줄기 소스가 비어 있어 켜도 그릴 것이 없지만, 타이머
 * 자체를 돌리지 않는다 — `/firework` 는 이 클래스 전에도 후에도 같아야 한다).
 */
import type { Disposable } from '../shared/disposable';
import type { Logger } from '../shared/logger/Logger';
import type { MapEnginePort } from './ports/MapEnginePort';
import type { AppState } from './state/AppState';
import type { SessionStore } from './state/SessionStore';

export type WaterFlowCoordinatorDeps = {
  readonly engine: MapEnginePort;
  readonly store: SessionStore;
  readonly logger: Logger;
};

/** 스냅샷 하나에서 "흐름을 돌려야 하는가"를 읽는다. 순수 함수 — 테스트가 표로 고정한다. */
export function shouldAnimateWaterFlow(state: AppState): boolean {
  return (
    state.scene === 'valley' &&
    state.status === 'ready' &&
    state.sheetSnap !== 'peek' &&
    state.appActive
  );
}

export class WaterFlowCoordinator implements Disposable {
  readonly #deps: WaterFlowCoordinatorDeps;
  readonly #logger: Logger;
  readonly #subscription: Disposable;

  #enabled = false;
  #disposed = false;

  constructor(deps: WaterFlowCoordinatorDeps) {
    this.#deps = deps;
    this.#logger = deps.logger.child('water-flow');
    this.#subscription = deps.store.subscribe(() => this.#sync());
    this.#sync();
  }

  /** 지금 엔진에 말해 둔 값. */
  get enabled(): boolean {
    return this.#enabled;
  }

  #sync(): void {
    if (this.#disposed) return;
    const next = shouldAnimateWaterFlow(this.#deps.store.state);
    if (next === this.#enabled) return;
    const applied = this.#deps.engine.setWaterFlowEnabled(next);
    if (!applied.ok) {
      // 엔진이 아직 준비 전이거나 흐름을 모른다 — 다음 상태 변화에서 다시 시도한다.
      this.#logger.debug('물줄기 흐름 상태를 적용하지 못했다', { next, code: applied.error.code });
      return;
    }
    this.#enabled = next;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#subscription.dispose();
    if (this.#enabled) {
      const stopped = this.#deps.engine.setWaterFlowEnabled(false);
      if (!stopped.ok)
        this.#logger.debug('물줄기 흐름을 멈추지 못했다', { code: stopped.error.code });
      this.#enabled = false;
    }
  }
}
