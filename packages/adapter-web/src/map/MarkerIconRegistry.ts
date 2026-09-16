/**
 * 지연 마커 아이콘 레지스트리 (web) — valley-ds `lazy-marker-icons.ts` 의 이식.
 *
 * 스프라이트를 굽지 않는다. 심볼 레이어가 부르는 **아이콘 ID 가 곧 명세**이고, 스타일이 모르는
 * ID 를 요청하면(maplibre-gl 6 `setMissingStyleImageResolver`) 그 자리에서 SVG 문자열을 만들어
 * `<img>` 로 디코드한 뒤 `addImage(pixelRatio 2)` 로 넣는다. 지도는 resolver 가 돌려준 Promise 를
 * 기다렸다가 심볼을 배치하므로 첫 프레임에 빈 자리가 생기지 않는다.
 *
 * valley-ds 원본은 `createImageBitmap(Blob)` 을 썼지만 Chrome 은 SVG Blob 을 그 경로로 디코드하지
 * 못한다(`InvalidStateError: The source image could not be decoded`, Chrome 152 에서 확인). 그래서
 * data URL 을 `HTMLImageElement` 에 물려 `decode()` 를 기다린다 — maplibre 는 `<img>` 를 그대로
 * 받아 캔버스로 읽는다. SVG 의 `width`/`height`(dp × 2)가 그대로 픽셀 크기가 된다.
 *
 * SVG 는 `map-style` 의 순수 팩토리(`facilityIconSvgById` 등)가 만든다 — 이 클래스는 문자열을
 * 비트맵으로 바꾸는 web 전용 일만 한다. 팩토리는 `register` 로 여럿 꽂을 수 있고, 어느 팩토리도
 * 모르는 ID(openfreemap 스타일이 스프라이트에 없는 아이콘을 참조하는 경우)는 이전의 **투명 1px**
 * 폴백으로 간다 — 그 경고 억제는 C4 부터 있던 동작이고 `/firework` 는 이 폴백만 탄다.
 *
 * 규칙
 *   · 같은 ID 의 동시 요청은 한 번만 굽는다(`#pending`).
 *   · 스타일이 사라진 뒤(`map.style` 없음)에는 `addImage` 하지 않는다 — 언마운트 경합.
 *   · 실패는 `Logger` 로 남기고 지도는 계속 산다(아이콘 하나가 없다고 화면을 막지 않는다).
 *   · `dispose` 는 resolver 를 떼고 진행 중인 요청 결과를 버린다.
 */
import { type Disposable, type Logger, toDisposable } from '@modu-valley/core';
import { MARKER_ICON_PIXEL_RATIO } from '@modu-valley/map-style';
import type { Map as MapLibreMap } from 'maplibre-gl';

/** id → SVG 문자열. 내 담당이 아니면 `null`. */
export type SvgIconFactory = (id: string) => string | null;

export class MarkerIconRegistry implements Disposable {
  readonly #map: MapLibreMap;
  readonly #logger: Logger;
  readonly #factories = new Set<SvgIconFactory>();
  readonly #pending = new Map<string, Promise<void>>();

  #disposed = false;

  constructor(map: MapLibreMap, logger: Logger) {
    this.#map = map;
    this.#logger = logger.child('marker-icons');
    // 스타일 로드 중에 불리므로 지도 생성 직후에 걸어야 한다(`MapLibreEngine.#createMap`).
    map.setMissingStyleImageResolver((id) => this.#resolve(id));
  }

  /** 팩토리 하나를 꽂는다. 돌려준 Disposable 로 뺀다. */
  register(factory: SvgIconFactory): Disposable {
    if (this.#disposed) return toDisposable(() => {});
    this.#factories.add(factory);
    return toDisposable(() => this.#factories.delete(factory));
  }

  /** 지금 진행 중인 래스터화 수 — 테스트·디버그용. */
  get pendingCount(): number {
    return this.#pending.size;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#factories.clear();
    this.#pending.clear();
    if (alive(this.#map)) this.#map.setMissingStyleImageResolver(null);
  }

  #resolve(id: string): void | Promise<void> {
    if (this.#disposed || !alive(this.#map) || this.#map.hasImage(id)) return;

    const inflight = this.#pending.get(id);
    if (inflight !== undefined) return inflight;

    const svg = this.#buildSvg(id);
    if (svg === null) {
      // 어느 팩토리도 모르는 ID — 경고를 없애는 투명 1px(C4 부터의 동작).
      this.#map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
      return;
    }

    const task = svgToImage(svg)
      .then((image) => {
        if (this.#disposed || !alive(this.#map) || this.#map.hasImage(id)) return;
        this.#map.addImage(id, image, { pixelRatio: MARKER_ICON_PIXEL_RATIO });
        this.#logger.debug('마커 아이콘 생성', { id });
      })
      .catch((thrown: unknown) => {
        this.#logger.error('마커 아이콘을 만들지 못했다', thrown, { id });
      })
      .finally(() => {
        this.#pending.delete(id);
      });
    this.#pending.set(id, task);
    return task;
  }

  #buildSvg(id: string): string | null {
    for (const factory of this.#factories) {
      const svg = factory(id);
      if (svg !== null) return svg;
    }
    return null;
  }
}

/** 스타일이 날아간 뒤(`map.remove()` 이후·스타일 교체 중) `addImage` 하면 던진다. */
function alive(map: MapLibreMap): boolean {
  return Boolean(map.style);
}

/** SVG 문자열 → 디코드가 끝난 `<img>`. data URL 이라 해제할 것이 없다. */
async function svgToImage(svg: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  return image;
}
