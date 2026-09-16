/**
 * 레이어 배치 — "스타일의 어느 레이어 **앞**에 끼우는가"를 이름으로 고른다.
 *
 * F4 가 `placement: 'below-labels'`(첫 `symbol` 앞) 하나로 시작했고, C10 이 지형
 * 레이어(음영기복·고도색)를 위해 `'below-waterway'` 를 더했다. 기준 레이어를 id 로
 * 박지 않고 **type · source-layer** 로 찾는 이유는 `applyMapPalette` 와 같다 — positron
 * 과 dark 는 레이어 골격이 같고 id 만 일부 다르다. 두 어댑터와 스타일 구성이 같은
 * 함수를 부르므로 web 과 네이티브의 끼우는 자리가 갈라질 수 없다.
 *
 * 인자를 `StyleSpecification` 이 아니라 필요한 만큼의 구조로 받는다. maplibre-gl 과
 * maplibre-react-native 가 각자 다른 버전의 `@maplibre/maplibre-gl-style-spec` 을 물고
 * 있어, 이름이 같아도 서로 대입되지 않는 별개 타입이 된다. 실제로 읽는 것은
 * `layers[].type` · `.id` · `['source-layer']` 뿐이므로 그만큼만 요구한다.
 */

/**
 *   'below-labels'   첫 `symbol` 레이어 앞 — 라벨 아래, 도로·물 위. 3D 건물보다도 아래.
 *   'below-waterway' 첫 `waterway` 선 레이어 앞 — 숲(`landcover_wood`) 위·물줄기 아래.
 *                    C10 결정 (a): 음영기복이 녹지 톤을 살리는 유일한 자리.
 *                    waterway 가 없는 스타일에서는 `'below-labels'` 로 물러난다.
 */
export const LAYER_PLACEMENTS = ['below-labels', 'below-waterway'] as const;
export type LayerPlacement = (typeof LAYER_PLACEMENTS)[number];

export type PlaceableLayer = {
  readonly id: string;
  readonly type: string;
  readonly 'source-layer'?: string;
};

export type PlaceableStyle = {
  readonly layers: readonly PlaceableLayer[];
};

/** 심볼 레이어 중 첫 번째 id — 건물·그늘을 라벨 아래에 끼워 넣는 기준점. */
export function findFirstSymbolLayerId(style: PlaceableStyle): string | undefined {
  return style.layers.find((layer) => layer.type === 'symbol')?.id;
}

/** 물줄기(`waterway` 소스 레이어) 선 중 첫 번째 id. positron·dark 모두 `waterway` 하나다. */
export function findFirstWaterwayLayerId(style: PlaceableStyle): string | undefined {
  return style.layers.find((layer) => layer.type === 'line' && layer['source-layer'] === 'waterway')
    ?.id;
}

/**
 * 배치 → 그 앞에 끼울 레이어 id. 기준이 없으면 `undefined`(= 맨 위). web 은 이 값을
 * `addLayer(layer, beforeId)` 에, 네이티브는 `Layer.beforeId` 에, 스타일 구성은
 * `insertLayers` 에 넘긴다.
 */
export function findPlacementLayerId(
  style: PlaceableStyle,
  placement: LayerPlacement,
): string | undefined {
  switch (placement) {
    case 'below-labels':
      return findFirstSymbolLayerId(style);
    case 'below-waterway':
      return findFirstWaterwayLayerId(style) ?? findFirstSymbolLayerId(style);
  }
}

/**
 * 레이어들을 배치 기준 레이어 **앞**에 순서대로 끼운 새 스타일. 기준이 없으면 맨 뒤.
 * 원본은 변형하지 않는다 — 같은 스타일로 지도를 두 번 띄워도 레이어가 두 번 끼워지지 않는다.
 */
export function insertLayers<L extends PlaceableLayer, S extends { readonly layers: readonly L[] }>(
  style: S,
  layers: readonly NoInfer<L>[],
  placement: LayerPlacement,
): S {
  const beforeId = findPlacementLayerId(style, placement);
  const found =
    beforeId === undefined ? -1 : style.layers.findIndex((candidate) => candidate.id === beforeId);
  const insertAt = found < 0 ? style.layers.length : found;

  const next = [...style.layers];
  next.splice(insertAt, 0, ...layers);
  return { ...style, layers: next };
}
