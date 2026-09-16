/**
 * N1 — 선택이 바뀐 뒤 필터 걸린 지도 내용을 다시 그린다(해석 4, "선택이 필터를 이긴다").
 *
 * `mapContentFilterOf` 는 지금 선택(`selectedSegmentId`/`selectedFacilityId`)에서 핀 고정
 * 계곡을 유도한다. 선택이 바뀌면 그 핀도 바뀌므로 — 상세를 닫으면 핀이 풀려 그 계곡이
 * 다시 필터에 걸릴 수 있고, 다른 구간을 고르면 핀이 옮겨 간다 — 필터가 걸려 있는 동안은
 * 선택 유즈케이스(`SelectSegmentUseCase`·`SelectFacilityUseCase`·`ClearSelectionUseCase`)
 * 도 지도 내용을 다시 그려야 한다. 필터가 비어 있으면(칩 없음) 핀은 의미가 없고
 * `composer.content` 도 같은 참조를 돌려주므로 조용히 아무 일도 하지 않는다.
 *
 * 실패는 경고만 남긴다 — 하이라이트(`engine.setSelection`)는 이미 반영된 뒤의 보조
 * 갱신이라 되돌릴 선택 자체가 없다(그늘 유즈케이스들과 다른 태도).
 */

import type { Logger } from '../shared/logger/Logger';
import type { MapContentComposer } from './MapContentComposer';
import type { MapEnginePort } from './ports/MapEnginePort';
import { mapContentFilterOf } from './state/AppState';
import type { SessionStore } from './state/SessionStore';

export type RefreshFilteredMapContentDeps = {
  readonly engine: MapEnginePort;
  readonly store: SessionStore;
  readonly composer: MapContentComposer;
  readonly logger: Logger;
};

export function refreshFilteredMapContent(deps: RefreshFilteredMapContentDeps): void {
  const { engine, store, composer, logger } = deps;
  const state = store.state;
  if (state.filterChips.size === 0) return;

  const filter = mapContentFilterOf(state);
  const rendered = engine.renderContent(
    composer.content(state.shadeVisible, state.shadeHourIndex, filter),
  );
  if (!rendered.ok) {
    logger.warn('선택이 바뀐 뒤 필터 지도를 다시 그리지 못했다', rendered.error.toLogPayload());
  }
}
