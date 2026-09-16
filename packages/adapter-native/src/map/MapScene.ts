/**
 * 네이티브 지도의 **렌더 대상 스냅샷**.
 *
 * web 과 네이티브의 결정적 차이는 SDK 의 모양이다. maplibre-gl 은 명령형
 * (`addLayer`, `setData`, `marker.remove()`)이라 어댑터가 지도 객체를 직접
 * 들고 있을 수 있다. `@maplibre/maplibre-react-native` 는 선언형이다 —
 * 소스·레이어·마커가 **React 엘리먼트**이므로 그것들을 만드는 주체는 React
 * 트리여야 하고, 어댑터가 지도 객체를 소유할 수 없다.
 *
 * 그래서 포트의 명령형 계약(`renderContent`, `setSelection`)을 이 스냅샷의
 * 갱신으로 바꾼다. 엔진은 스냅샷만 쓰고, 표현 계층은 스냅샷만 그린다.
 * 애플리케이션 계층은 이 파일의 존재조차 모른다.
 *
 * 소스 데이터는 `sourceId` 를 키로 든다 — 표현 계층이 `MAP_LAYER_SETS` 를
 * 순회하며 같은 키로 꺼내 그리므로, 피처 종류가 늘어도 이 타입은 바뀌지 않는다.
 */
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { DEFAULT_MAP_GESTURES, INITIAL_VIEW, type MapGestures } from '@modu-valley/core';
import {
  EMPTY_FEATURE_COLLECTION,
  EMPTY_PAINT_OVERRIDES,
  LAYER_PLACEMENTS,
  type LayerPlacement,
  MAP_LAYER_SETS,
  type PaintOverrides,
} from '@modu-valley/map-style';
import type { FeatureCollection } from 'geojson';

/** 네이티브 `LngLat` 표현 — 지도 SDK 가 요구하는 튜플. */
export type NativeLngLat = readonly [longitude: number, latitude: number];

export type NativeViewPadding = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

/**
 * `CameraRef.setStop` 에 넘길 값. 어댑터가 SDK 를 import 하지 않기 위해
 * 필요한 필드만 다시 적었다. 표현 계층이 이 값을 그대로 넘긴다.
 *
 * 생략된 축은 현재 값이 유지된다 — 네이티브도 `CameraPosition.Builder(현재)`
 * 에서 시작하므로 web 과 같은 규약이다.
 */
export type NativeCameraStop = {
  readonly center?: NativeLngLat;
  readonly zoom?: number;
  readonly pitch?: number;
  readonly bearing?: number;
  readonly padding?: NativeViewPadding;
  readonly duration?: number;
  readonly easing?: 'linear' | 'ease' | 'fly';
};

/** 지도가 보고하는 현재 시점. `onRegionIsChanging` 에서 온다. */
export type NativeViewState = {
  readonly center: NativeLngLat;
  readonly zoom: number;
  readonly pitch: number;
  readonly bearing: number;
};

/**
 * 선택 핀 한 개. web 의 `Marker` + 물방울 SVG 에 대응한다. 종류를 모른다 —
 * 명당이든 시설이든 "이 좌표에 이 색 핀"이면 충분하다. 구간 선택은 핀이 없다.
 */
export type SelectedPin = {
  /** 선택된 피처의 도메인 id. 뷰가 `key` 로 써서 바뀔 때 낙하를 다시 재생한다. */
  readonly id: string;
  readonly center: NativeLngLat;
  readonly color: string;
};

/** `sourceId` → 소스 데이터. 모든 레이어 셋의 키가 항상 들어 있다(비어 있어도). */
export type SceneSources = Readonly<Record<string, FeatureCollection>>;

/** 모든 소스가 빈 상태. 게시 전·해제 후의 바탕. */
export const EMPTY_SCENE_SOURCES: SceneSources = Object.fromEntries(
  MAP_LAYER_SETS.map((set) => [set.sourceId, EMPTY_FEATURE_COLLECTION]),
);

export type MapScene = {
  /**
   * 장식이 끝난 스타일. `null` 이면 표현 계층은 지도를 띄우지 않는다 —
   * 스타일을 받아 오는 동안 빈 지도가 잠깐 보이는 것을 막는다.
   */
  readonly style: StyleSpecification | null;
  /**
   * 지도 첫 렌더의 시점. 엔진이 발사 지점을 채워 게시한다.
   *
   * `getCamera()` 가 동기 계약이라(`MapRef.getViewState()` 는 비동기다) 엔진도
   * 같은 값을 시점 스냅샷의 초깃값으로 쓴다. 두 곳이 같은 값을 보게 하려고
   * 스냅샷에 실어 나른다.
   */
  readonly initialView: NativeCameraStop;
  /**
   * 조작 제스처 정책. 애플리케이션 계층이 내려준 값을 그대로 실어 나른다 —
   * 네이티브에서 제스처는 `<Map>` 의 prop 이므로 스냅샷을 거쳐야 뷰에 닿는다.
   */
  readonly gestures: MapGestures;
  readonly sources: SceneSources;
  readonly selectedPin: SelectedPin | null;
  /**
   * 배치 이름 → 그 앞에 끼울 스타일 레이어 id. `placement` 가 있는 레이어 셋이 여기서
   * `Layer.beforeId` 를 꺼낸다. 엔진이 스타일을 게시할 때 `findPlacementLayerId` 로 한 번
   * 계산해 실어 보낸다 — 뷰가 렌더마다 스타일을 훑지 않게. 기준이 없거나 스타일 전이면
   * `null`(맨 위). web 의 `FeatureLayerController.install` 과 같은 함수·같은 규칙.
   */
  readonly placementLayerIds: PlacementLayerIds;
  /**
   * 레이어 id → 덧쓸 paint 속성. 프레임마다 바뀌는 값(물줄기 흐름의 `line-dasharray`, C10c)과
   * 상태 의존 값(케이싱 색·그늘 대비, V1 `valleyPaintOverrides`)을 레이어 명세를 다시 만들지
   * 않고 얹는 통로다. 뷰는 `MAP_LAYER_SETS` 의 레이어를 그리며 같은 id 가 있으면 `paint` 위에
   * spread 한다. 레이어 셋에 없는 id(스타일 JSON 의 음영기복)는 뷰가 그리지 않으므로 값만 남는다
   * — `valleyPaint.ts` 네이티브 주의. 비어 있으면 명세 그대로.
   */
  readonly layerPaintOverrides: LayerPaintOverrides;
};

export type LayerPaintOverrides = PaintOverrides;
export const EMPTY_LAYER_PAINT_OVERRIDES: LayerPaintOverrides = EMPTY_PAINT_OVERRIDES;

export type PlacementLayerIds = Readonly<Record<LayerPlacement, string | null>>;

/** 기준을 아직 모르는 상태 — 모든 배치가 맨 위. */
export const EMPTY_PLACEMENT_LAYER_IDS: PlacementLayerIds = Object.fromEntries(
  LAYER_PLACEMENTS.map((placement) => [placement, null]),
) as Record<LayerPlacement, string | null>;

export const EMPTY_MAP_SCENE: MapScene = {
  style: null,
  // 발사 지점은 엔진이 채운다. 그 전에는 지도를 띄우지 않으므로 쓰이지 않는다.
  initialView: {
    zoom: INITIAL_VIEW.zoom,
    pitch: INITIAL_VIEW.pitch,
    bearing: INITIAL_VIEW.bearing,
  },
  gestures: DEFAULT_MAP_GESTURES,
  sources: EMPTY_SCENE_SOURCES,
  selectedPin: null,
  placementLayerIds: EMPTY_PLACEMENT_LAYER_IDS,
  layerPaintOverrides: EMPTY_LAYER_PAINT_OVERRIDES,
};
