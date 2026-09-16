/**
 * 물줄기 흐름 애니메이션 (web) — `line-dasharray` 를 rAF 로 갈아 끼운다 (C10c).
 *
 * MapLibre 공식 "animate a line" 패턴. 프레임마다 그리지 않고 `FLOW_FRAME_MS` 단위로
 * 단계가 **바뀔 때만** `setPaintProperty` 를 부른다 — 60ms 마다 한 번, 스타일 diff 한 건.
 * 켜고 끄는 결정은 코어(`WaterFlowCoordinator`)가 하고 여기서는 루프의 생애만 맡는다.
 * 브라우저가 탭을 숨기면 rAF 가 스스로 멈추므로 별도 visibility 처리는 없다(RN `AppState`
 * 경로로도 코어가 끈다).
 */
import type { Disposable, Logger } from '@modu-valley/core';
import { FLOW_DASH_LAYER_ID, flowDashArray, flowStepAt } from '@modu-valley/map-style';
import type { Map as MapLibreMap } from 'maplibre-gl';

export class WaterFlowController implements Disposable {
  readonly #map: MapLibreMap;
  readonly #logger: Logger;

  #frame: number | null = null;
  #startedAt = 0;
  #step = -1;
  #disposed = false;

  constructor(map: MapLibreMap, logger: Logger) {
    this.#map = map;
    this.#logger = logger.child('water-flow');
  }

  get running(): boolean {
    return this.#frame !== null;
  }

  /** 같은 값은 no-op. 끄면 점선을 첫 단계로 되돌려 정지 화면이 항상 같게 한다. */
  setEnabled(enabled: boolean): void {
    if (this.#disposed || enabled === this.running) return;
    if (enabled) {
      this.#startedAt = performance.now();
      this.#step = -1;
      this.#frame = requestAnimationFrame(this.#tick);
      this.#logger.debug('흐름 애니메이션 시작');
      return;
    }
    this.#stop();
    this.#apply(0);
    this.#logger.debug('흐름 애니메이션 정지');
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#stop();
  }

  readonly #tick = (now: number): void => {
    if (this.#frame === null) return;
    const step = flowStepAt(now - this.#startedAt);
    if (step !== this.#step) {
      this.#step = step;
      this.#apply(step);
    }
    this.#frame = requestAnimationFrame(this.#tick);
  };

  #stop(): void {
    if (this.#frame !== null) cancelAnimationFrame(this.#frame);
    this.#frame = null;
  }

  #apply(step: number): void {
    // 스타일이 교체·파괴된 뒤일 수 있다 — 레이어가 없으면 조용히 건너뛴다.
    if (this.#map.getLayer(FLOW_DASH_LAYER_ID) === undefined) return;
    try {
      this.#map.setPaintProperty(FLOW_DASH_LAYER_ID, 'line-dasharray', flowDashArray(step));
    } catch (thrown) {
      this.#logger.debug('점선 위상 교체를 건너뛴다', { reason: String(thrown) });
    }
  }
}
