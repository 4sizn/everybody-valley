/**
 * 피처 레이어 셋 하나(소스 + 레이어들 + 히트)의 web 구현.
 *
 * 명당 전용이던 `SpotLayerController` 를 종류 무관하게 바꿨다. 무엇을 그리고
 * 어떤 속성에서 id 를 읽는지는 전부 `FeatureLayerSet` 이 들고 있고, 이
 * 클래스는 그것을 maplibre-gl 호출로 옮기기만 한다. 종류가 늘어도 이 파일은
 * 바뀌지 않는다.
 *
 * 데모는 GeoJSON 을 만들 때 `properties.idx` 에 배열 인덱스를 넣고, 클릭
 * 핸들러에서 `+e.features[0].properties.idx` 로 되돌린다. 목록 정렬이
 * 바뀌면 지도와 상세가 어긋나는 구조다. 여기서는 안정된 도메인 id 를 싣고,
 * 그 id 를 종류와 함께 `feature-press` 로 올린다.
 *
 * 갱신은 `FeatureLayerSet.dependencies` 의 참조 비교로 걸러 낸다 — 내용 중
 * 이 소스와 무관한 부분이 바뀌었을 때 `setData` 를 부르지 않는다.
 *
 * F4 부터 셋이 둘로 갈린다. 히트 대상(`isInteractiveLayerSet`)은 이전과 같고,
 * 비인터랙티브 셋(그늘)은 클릭·커서 배선을 하지 않는다. `placement` 가 있으면
 * `findPlacementLayerId` 가 고른 레이어 앞에 끼운다(라벨 아래·물줄기 아래 — 네이티브와 같은 규칙).
 */
import {
  type Disposable,
  DisposableStore,
  type Emitter,
  err,
  type Logger,
  type MapContent,
  MapEngineError,
  type MapEngineEvents,
  type MapSelection,
  ok,
  toDisposable,
  toMapFeatureRef,
  type VoidResult,
} from '@modu-valley/core';
import {
  type FeatureLayerSet,
  findPlacementLayerId,
  isInteractiveLayerSet,
  type MapLayerKind,
  sameDependencies,
} from '@modu-valley/map-style';
import type {
  GeoJSONSource,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  Map as MapLibreMap,
  PointLike,
} from 'maplibre-gl';

export class FeatureLayerController implements Disposable {
  readonly kind: MapLayerKind;

  readonly #map: MapLibreMap;
  readonly #set: FeatureLayerSet;
  readonly #events: Emitter<MapEngineEvents>;
  readonly #logger: Logger;
  readonly #subscriptions: DisposableStore;

  #dependencies: readonly unknown[] | undefined;
  #installed = false;
  #disposed = false;

  constructor(
    map: MapLibreMap,
    layerSet: FeatureLayerSet,
    events: Emitter<MapEngineEvents>,
    logger: Logger,
  ) {
    this.kind = layerSet.kind;
    this.#map = map;
    this.#set = layerSet;
    this.#events = events;
    this.#logger = logger.child(`${layerSet.kind}-layers`);
    this.#subscriptions = new DisposableStore(this.#logger);
  }

  /** 소스·레이어를 얹고 히트 핸들러를 붙인다. 스타일 로드 이후에만 부를 수 있다. */
  install(): VoidResult {
    if (this.#installed || this.#disposed) return ok();

    try {
      this.#map.addSource(this.#set.sourceId, this.#set.emptySource);
      /* 배치가 있으면 그 기준 레이어 앞에 끼운다. 기준이 없으면(테스트 스타일 등) 맨 위 —
         `insertLayers`(map-style)·네이티브 `placementLayerIds` 와 같은 규칙. */
      const beforeId =
        this.#set.placement === undefined
          ? undefined
          : findPlacementLayerId(this.#map.getStyle(), this.#set.placement);
      for (const layer of this.#set.layers) this.#map.addLayer(layer, beforeId);
    } catch (thrown) {
      return err(
        new MapEngineError('map/layer-failed', `${this.kind} 레이어를 추가하지 못했습니다.`, {
          cause: thrown,
          context: { sourceId: this.#set.sourceId },
        }),
      );
    }

    this.#wireHitTesting();
    this.#installed = true;
    return ok();
  }

  /**
   * 내용·선택을 반영한다. 이 소스가 의존하는 값이 하나도 바뀌지 않았으면
   * 아무 일도 하지 않는다.
   */
  update(content: MapContent, selection: MapSelection | null): VoidResult {
    if (this.#disposed) return ok();

    const dependencies = this.#set.dependencies(content, selection);
    if (sameDependencies(this.#dependencies, dependencies)) return ok();

    const source = this.#map.getSource(this.#set.sourceId);
    if (source === undefined) {
      return err(
        new MapEngineError('map/source-failed', `${this.kind} 소스를 찾을 수 없습니다.`, {
          context: { sourceId: this.#set.sourceId },
        }),
      );
    }

    const collection = this.#set.toFeatureCollection(content, selection);
    (source as GeoJSONSource).setData(collection);
    this.#dependencies = dependencies;
    // 어느 소스가 언제 다시 쓰였는지 — "시각을 바꾸면 그늘 소스만" 같은 성능 주장의 근거가 이 줄이다.
    this.#logger.debug('소스 데이터 갱신', {
      sourceId: this.#set.sourceId,
      features: collection.features.length,
    });
    return ok();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#subscriptions.dispose();
    if (!this.#installed) return;

    // 스타일이 이미 교체·파괴된 뒤일 수 있으니 실패를 삼키고 로그만 남긴다.
    for (const layer of [...this.#set.layers].reverse()) {
      try {
        if (this.#map.getLayer(layer.id) !== undefined) this.#map.removeLayer(layer.id);
      } catch (thrown) {
        this.#logger.debug('레이어 제거를 건너뛴다', { layerId: layer.id, reason: String(thrown) });
      }
    }
    try {
      if (this.#map.getSource(this.#set.sourceId) !== undefined) {
        this.#map.removeSource(this.#set.sourceId);
      }
    } catch (thrown) {
      this.#logger.debug('소스 제거를 건너뛴다', { reason: String(thrown) });
    }
  }

  #wireHitTesting(): void {
    const set = this.#set;
    // 그늘처럼 히트 대상이 아닌 셋은 클릭·커서 배선이 없다 — 아래 구간 선의 클릭을 가로채지 않는다.
    if (!isInteractiveLayerSet(set)) return;
    const canvas = this.#map.getCanvas();

    for (const layerId of set.interactiveLayerIds) {
      const onClick = (event: MapLayerMouseEvent): void => {
        // 빈 곳 클릭 핸들러가 이어서 상세를 닫지 않도록 표시한다(데모와 동일).
        event.preventDefault();
        // X2 — 시설이 몰린 곳(상가·주차장 밀집)은 한 클릭에 점 여럿이 잡힌다. `[0]` 은
        // 화면 근접도가 아니라 내부 타일 순서라 엉뚱한 시설이 뽑혔다 — `nearestFeature` 로 고친다.
        const feature = nearestFeature(this.#map, event.point, event.features ?? []);
        const id = set.readFeatureId(feature?.properties);
        if (id === undefined) return;
        this.#events.emit('feature-press', toMapFeatureRef(set.kind, id));
      };
      const onEnter = (): void => {
        canvas.style.cursor = 'pointer';
      };
      const onLeave = (): void => {
        canvas.style.cursor = '';
      };

      this.#map.on('click', layerId, onClick);
      this.#map.on('mouseenter', layerId, onEnter);
      this.#map.on('mouseleave', layerId, onLeave);
      this.#subscriptions.add(
        toDisposable(() => {
          this.#map.off('click', layerId, onClick);
          this.#map.off('mouseenter', layerId, onEnter);
          this.#map.off('mouseleave', layerId, onLeave);
        }),
      );
    }
  }
}

/**
 * 클릭 지점에 매칭된 피처 중 화면상 가장 가까운 것 — X2 버그 수정.
 *
 * `queryRenderedFeatures` 는 매칭된 피처를 화면 근접도가 아니라 내부 타일 순서로
 * 돌려준다(maplibre-gl 소스 `_createDelegatedListener` — 클릭마다 그 레이어를 다시
 * 쿼리해 `[0]` 을 쓰면 그 순서를 그대로 믿는 셈이다). 시설이 몰린 곳(상가 옆 주차장,
 * 공원 옆 화장실)에서 점 두세 개가 같은 픽셀에 잡히면 탭한 핀이 아니라 순서상 앞선
 * 딴 시설이 선택된다 — 사용자가 "핀 정보가 사라진다"고 본 것이 이거였다(실측:
 * 안골계곡 '떡볶이 대박집' 을 탭하면 '호국로 주차장' 이 선택됨).
 *
 * 점 지오메트리만 다시 고른다(시설·명당) — 선 지오메트리(구간)는 겹칠 일이 드물고
 * "가장 가까운 점" 개념이 없어 첫 피처를 그대로 쓴다.
 */
function nearestFeature(
  map: MapLibreMap,
  point: PointLike,
  features: readonly MapGeoJSONFeature[],
): MapGeoJSONFeature | undefined {
  if (features.length <= 1) return features[0];

  const target = toXY(point);
  let best: MapGeoJSONFeature | undefined;
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  for (const feature of features) {
    const coordinates = pointCoordinatesOf(feature);
    if (coordinates === undefined) {
      best ??= feature;
      continue;
    }
    const projected = map.project(coordinates);
    const dx = projected.x - target.x;
    const dy = projected.y - target.y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      best = feature;
    }
  }
  return best ?? features[0];
}

/** `Point` 지오메트리의 좌표만 — 그 외(선 등)는 거리 비교 대상이 아니다. */
function pointCoordinatesOf(feature: MapGeoJSONFeature): [number, number] | undefined {
  const geometry = feature.geometry;
  return geometry.type === 'Point' ? (geometry.coordinates as [number, number]) : undefined;
}

function toXY(point: PointLike): { x: number; y: number } {
  return Array.isArray(point) ? { x: point[0], y: point[1] } : point;
}
