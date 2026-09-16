/**
 * 지도 스타일 상수와 장식 — 원본 데모의 값 그대로.
 *
 * MapLibre 스타일 명세는 **플랫폼 무관 데이터**다. web(maplibre-gl)과
 * 네이티브(maplibre-native)가 같은 JSON 을 읽는다. 그래서 어느 한쪽
 * 어댑터가 아니라 이 패키지에 둔다 — 값이 두 곳에 복사되면 "파리티가 깨졌는지"
 * 를 두 파일을 비교해야 알 수 있다.
 *
 * 적용 방식은 두 플랫폼이 같다(C2 부터). 스타일 JSON 을 먼저 받아
 * `composeMapStyle()` 로 팔레트 → 라벨 → 장식을 미리 얹고, 완성된 **스타일
 * 객체**로 지도를 띄운다. web 도 URL 대신 객체를 넘기므로 화면이 뜬 뒤 레이어가
 * 깜빡이며 얹히는 일이 없다.
 */
import type {
  ExpressionSpecification,
  FillExtrusionLayerSpecification,
  SkySpecification,
  StyleSpecification,
} from '@maplibre/maplibre-gl-style-spec';
import type { MapStyleMode } from './palette';
import { insertLayers } from './placement';

/**
 * 모드별 베이스 스타일 — spotts.kr 과 같은 무료·무키 벡터 타일(OpenMapTiles 스키마).
 * 라이트 `positron` 과 다크 `dark` 는 Positron/Dark Matter 계열로 레이어 골격이
 * 같아 하나의 재색칠 규칙(`applyMapPalette`)이 둘 다 맞는다.
 */
export const MAP_STYLE_URLS: Readonly<Record<MapStyleMode, string>> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

/** 데모 원본(다크) 스타일 URL. `MAP_STYLE_URLS.dark` 와 같다. */
export const MAP_STYLE_URL = MAP_STYLE_URLS.dark;

/** OpenMapTiles 스키마의 소스 이름. 3D 건물 레이어가 이 소스를 참조한다. */
export const OPENMAPTILES_SOURCE = 'openmaptiles';

/** MapLibre 5 부터 내장된 밤하늘. 데모의 `map.setSky({...})`. */
export const NIGHT_SKY: SkySpecification = {
  'sky-color': '#070d1c',
  'horizon-color': '#16233f',
  'fog-color': '#0b1020',
  'sky-horizon-blend': 0.7,
  'horizon-fog-blend': 0.5,
  'fog-ground-blend': 0.75,
  // globe 일 때만 대기 테두리를 보여준다. 줌 7 부터 0 으로 사라진다.
  'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
};

export const BUILDINGS_LAYER_ID = '3d-buildings';

/** fill-extrusion 3D 건물. 데모의 `map.addLayer({...}, firstSymbol)`. */
export const BUILDINGS_LAYER: FillExtrusionLayerSpecification = {
  id: BUILDINGS_LAYER_ID,
  type: 'fill-extrusion',
  source: OPENMAPTILES_SOURCE,
  'source-layer': 'building',
  minzoom: 13,
  paint: {
    'fill-extrusion-color': [
      'interpolate',
      ['linear'],
      ['coalesce', ['get', 'render_height'], 10],
      0,
      '#1b2233',
      40,
      '#26304a',
      120,
      '#36436a',
      250,
      '#4a5b8c',
    ],
    'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 10],
    'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
    'fill-extrusion-opacity': 0.92,
  },
};

export const LIGHT_BUILDINGS_LAYER_ID = '3d-buildings-light';

/**
 * 라이트 지도의 fill-extrusion 3D 건물. 다크 `BUILDINGS_LAYER` 와 같은 기하·높이·
 * 삽입 위치이고 색만 다르다 — `/firework` 의 구성 요소(3D 건물)는 테마가 바뀌어도
 * 사라지면 안 된다(CLAUDE.md "`/firework` 결과물 보존").
 *
 * 색은 팔레트 `building` #ffffff 에서 높이가 올라갈수록 한 단계씩 어두워지는
 * 회색 — 밝은 배경(#f7f7f7)에서 흰색 한 가지로는 면이 갈리지 않아 도심이 덩어리로
 * 뭉개진다(C2 PR 의 첫 실험). 위쪽 면은 밝게 남고 옆면은 MapLibre 의 자체 음영을
 * 받아 윤곽이 생긴다. 불투명도는 다크보다 살짝 낮춰 도로·라벨이 비친다.
 */
export const LIGHT_BUILDINGS_LAYER: FillExtrusionLayerSpecification = {
  id: LIGHT_BUILDINGS_LAYER_ID,
  type: 'fill-extrusion',
  source: OPENMAPTILES_SOURCE,
  'source-layer': 'building',
  minzoom: 13,
  paint: {
    'fill-extrusion-color': [
      'interpolate',
      ['linear'],
      ['coalesce', ['get', 'render_height'], 10],
      0,
      '#f2f2ef',
      40,
      '#e3e4e0',
      120,
      '#d2d4d0',
      250,
      '#bfc2be',
    ],
    'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 10],
    'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
    'fill-extrusion-opacity': 0.85,
  },
};

/**
 * 라벨을 한국어로. valley-ds `labelLanguage.textField` 와 같은 순서 —
 * `name:ko → name:nonlatin → name → name:latin`. 한국 안에서는 `name:ko` 가
 * 거의 항상 있고, 없을 때 라틴 음차보다 현지 문자(`name:nonlatin`)·원어(`name`)
 * 가 먼저 오도록 했다. 이전 저장소 순서(`name:ko → name:latin → name`)는 C2 에서
 * 이것으로 통일했다(docs/TODO.md "valley-ds 내부 불일치").
 */
export const LOCALIZED_TEXT_FIELD: ExpressionSpecification = [
  'coalesce',
  ['get', 'name:ko'],
  ['get', 'name:nonlatin'],
  ['get', 'name'],
  ['get', 'name:latin'],
];

/**
 * `text-field` 가 이름(`name*`)을 읽는지. 도로 번호 방패(`["to-string",["get","ref"]]`)
 * 같은 라벨은 이름이 아니므로 한국어 폴백으로 바꾸면 안 된다 — 바꾸면 번호 자리에
 * 도로 이름이 들어가거나 비어 버린다. 문자열 템플릿(`"{name:latin}"`)과 표현식 둘 다 본다.
 */
export function readsNameProperty(textField: unknown): boolean {
  if (typeof textField === 'string') return /\{name(:[a-z_]+)?\}/i.test(textField);
  if (!Array.isArray(textField)) return false;
  if (textField[0] === 'get' && typeof textField[1] === 'string') {
    return (
      textField[1] === 'name' || textField[1].startsWith('name:') || textField[1] === 'name_en'
    );
  }
  return textField.some((part) => readsNameProperty(part));
}

/**
 * 이름 라벨의 `text-field` 를 `LOCALIZED_TEXT_FIELD` 로 바꾼 **새 스타일**.
 * 이름을 읽지 않는 심볼(도로 번호 방패·일방통행 아이콘)은 그대로 둔다.
 */
export function localizeLabels(style: StyleSpecification): StyleSpecification {
  const layers = style.layers.map((layer) => {
    if (layer.type !== 'symbol') return layer;
    const textField = layer.layout?.['text-field'];
    if (textField === undefined || !readsNameProperty(textField)) return layer;
    return { ...layer, layout: { ...layer.layout, 'text-field': LOCALIZED_TEXT_FIELD } };
  });
  return { ...style, layers };
}

/**
 * 밤 장식 — 밤하늘 + 3D 건물을 얹은 **새 스타일**. 다크 지도 전용이다.
 *
 * 건물은 첫 심볼 레이어 **앞**에 끼워 라벨이 건물에 가리지 않게 한다.
 * 원본을 변형하지 않으므로 같은 스타일로 지도를 두 번 띄워도 레이어가 두 번
 * 끼워지지 않는다.
 */
export function decorateNight(style: StyleSpecification): StyleSpecification {
  return { ...insertBelowLabels(style, BUILDINGS_LAYER), sky: NIGHT_SKY };
}

/**
 * 낮 장식 — 라이트 3D 건물만. 하늘은 없다(positron 은 밝은 배경 자체가 하늘 역할).
 */
export function decorateDay(style: StyleSpecification): StyleSpecification {
  return insertBelowLabels(style, LIGHT_BUILDINGS_LAYER);
}

/** 레이어 하나를 첫 심볼 레이어 **앞**에 끼운 새 스타일. 심볼이 없으면 맨 뒤(`insertLayers`). */
function insertBelowLabels(
  style: StyleSpecification,
  layer: FillExtrusionLayerSpecification,
): StyleSpecification {
  return insertLayers(style, [layer], 'below-labels');
}

/**
 * 데모와 같은 다크 장식 — 라벨 → 하늘 → 건물. `composeMapStyle(style, 'dark')` 와 같다.
 * 기존 호출부를 위해 남겨 둔 이름이다.
 */
export function decorateNightStyle(style: StyleSpecification): StyleSpecification {
  return decorateNight(localizeLabels(style));
}

/**
 * 네트워크에서 온 값이므로 타입 단언 전에 최소한만 확인한다.
 * 전체 명세를 검증하지는 않는다 — 그 일은 지도 SDK 가 한다.
 */
export function isStyleSpecification(payload: unknown): payload is StyleSpecification {
  if (payload === null || typeof payload !== 'object') return false;
  const candidate = payload as { version?: unknown; layers?: unknown };
  return typeof candidate.version === 'number' && Array.isArray(candidate.layers);
}
