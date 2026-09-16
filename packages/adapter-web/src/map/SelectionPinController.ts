/**
 * 선택 핀 — 데모의 물방울 마커.
 *
 * `Marker` 는 DOM 요소를 지도에 붙인다. 데모는 새 핀을 세울 때마다
 * `pin.remove()` 를 부르지만 요소 자체는 놓아두고, 화면을 떠날 때 회수하는
 * 경로가 없다. `MutableDisposable` 로 "한 자리에 하나" 규칙을 코드로 만든다.
 *
 * 등장 애니메이션(`@keyframes drop`)과 그림자(`filter: drop-shadow`)는
 * react-native-web 이 표현할 수 없어 전역 스타일시트에 두었다(app/+html.tsx).
 * 이 컨트롤러는 클래스 이름만 붙인다.
 *
 * 선택 종류별 규칙
 *   · 명당(점)   — 그 자리에 핀. 색은 명당 자기 색.
 *   · 시설(점)   — 핀 없음(C5). 시설 마커가 이미 물방울 핀이라 그 위에 핀을 세우면 모양이
 *                  겹친다. 선택은 시설 레이어의 `selected` 가 핀 확대 + 흰 링으로 보인다.
 *   · 구간(선)   — 핀 없음. 강조는 레이어의 `selected` 속성이 맡는다.
 */
import {
  type Disposable,
  err,
  type HexColor,
  type LngLat,
  type Logger,
  MapEngineError,
  type MapSelection,
  MutableDisposable,
  ok,
  toDisposable,
  type VoidResult,
} from '@modu-valley/core';
import { type Map as MapLibreMap, Marker } from 'maplibre-gl';
import { toLngLatLike } from './mapStyle';

export const SELECTION_PIN_CLASS = 'mv-pin';

export class SelectionPinController implements Disposable {
  readonly #map: MapLibreMap;
  readonly #logger: Logger;
  readonly #current = new MutableDisposable();

  #disposed = false;

  constructor(map: MapLibreMap, logger: Logger) {
    this.#map = map;
    this.#logger = logger.child('selection-pin');
  }

  set(selection: MapSelection | null): VoidResult {
    if (this.#disposed) return ok();

    const pin = toPin(selection);
    if (pin === null) {
      this.#current.clear();
      return ok();
    }

    try {
      const element = createPinElement(pin.color);
      const marker = new Marker({ element, anchor: 'bottom' })
        .setLngLat(toLngLatLike(pin.position))
        .addTo(this.#map);
      this.#current.value = toDisposable(() => {
        marker.remove();
        element.remove();
      });
      return ok();
    } catch (thrown) {
      this.#logger.error('선택 핀을 세우지 못했다');
      return err(
        new MapEngineError('map/layer-failed', '선택 핀을 세우지 못했습니다.', {
          cause: thrown,
          context: { kind: pin.kind, id: pin.id },
        }),
      );
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#current.dispose();
  }
}

type Pin = {
  readonly kind: MapSelection['kind'];
  readonly id: string;
  readonly position: LngLat;
  readonly color: HexColor;
};

/** 선택 → 핀 명세. 명당만 핀을 갖고, 시설(자기 핀이 있다)·구간(선)은 `null`. */
function toPin(selection: MapSelection | null): Pin | null {
  if (selection === null) return null;
  switch (selection.kind) {
    case 'spot':
      return {
        kind: 'spot',
        id: selection.spot.id,
        position: selection.spot.position,
        color: selection.spot.color,
      };
    case 'facility':
    case 'segment':
      return null;
  }
}

/**
 * 데모의 핀 SVG 그대로. 색만 선택된 피처에서 온다.
 * `innerHTML` 에 들어가는 값은 도메인이 `#rrggbb` 로 제한한 색뿐이다.
 */
function createPinElement(color: HexColor): HTMLElement {
  const element = document.createElement('div');
  element.className = SELECTION_PIN_CLASS;
  element.innerHTML = `<svg width="34" height="46" viewBox="0 0 34 46">
    <path d="M17 45C17 45 32 27.5 32 16A15 15 0 1 0 2 16c0 11.5 15 29 15 29z"
          fill="${sanitizeColor(color)}" stroke="rgba(255,255,255,.92)" stroke-width="2.4"/>
    <circle cx="17" cy="16" r="5.4" fill="rgba(255,255,255,.95)"/></svg>`;
  return element;
}

/** 도메인 타입만으로는 런타임을 보장하지 못하므로 마지막 관문을 둔다. */
function sanitizeColor(color: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#ffffff';
}
