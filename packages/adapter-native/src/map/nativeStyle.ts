/**
 * 스타일 JSON 을 받아 `map-style` 의 구성(팔레트 → 라벨 → 장식)을 미리 얹는다.
 *
 * 네이티브 래퍼는 `setSky` · `setLayoutProperty` · `addLayer` 를 노출하지 않고
 * `mapStyle` 로 **스타일 객체**를 받는다. 그래서 먼저 JSON 을 가져와 바꿔 놓고,
 * 완성된 스타일로 지도를 띄운다. web 어댑터도 C2 부터 같은 순서를 쓴다
 * (`MapLibreEngine.#loadStyle`) — 두 플랫폼이 같은 함수(`composeMapStyle`)를
 * 같은 시점에 부르므로 결과가 같다.
 *
 * 구성 규칙 자체는 `@modu-valley/map-style` 에 있다.
 */
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import {
  type CancellationToken,
  err,
  type Logger,
  MapEngineError,
  ok,
  type Result,
} from '@modu-valley/core';
import {
  composeMapStyle,
  isStyleSpecification,
  type MapStyleMode,
  overrideBaseMapOrigin,
  overrideOpenFreeMapUrl,
} from '@modu-valley/map-style';

export type LoadMapStyleOptions = {
  readonly styleUrl: string;
  readonly styleMode: MapStyleMode;
  /** 지형(DEM 소스 + 고도색·음영기복)을 얹는가 — 계곡 장면만. `composeMapStyle` 옵션 그대로. */
  readonly terrain: boolean;
  /** 개발용 강제 장애(C7) — openfreemap 오리진을 이 값으로 바꾼다. web 과 같은 함수. */
  readonly baseMapOriginOverride?: string;
  readonly logger: Logger;
};

export async function loadMapStyle(
  options: LoadMapStyleOptions,
  token: CancellationToken,
): Promise<Result<StyleSpecification>> {
  const guard = token.checkpoint('native-style-fetch');
  if (!guard.ok) return guard;

  const override = options.baseMapOriginOverride;
  const styleUrl =
    override === undefined ? options.styleUrl : overrideOpenFreeMapUrl(options.styleUrl, override);
  let payload: unknown;
  try {
    const response = await fetch(styleUrl);
    if (!response.ok) {
      return err(
        new MapEngineError('map/style-load-failed', '지도 스타일을 받아오지 못했습니다.', {
          context: { styleUrl, status: response.status },
        }),
      );
    }
    payload = await response.json();
  } catch (thrown) {
    return err(
      new MapEngineError('map/style-load-failed', '지도 스타일 요청이 실패했습니다.', {
        cause: thrown,
        context: { styleUrl },
      }),
    );
  }

  const afterFetch = token.checkpoint('native-style-compose');
  if (!afterFetch.ok) return afterFetch;

  if (!isStyleSpecification(payload)) {
    return err(
      new MapEngineError('map/style-load-failed', '지도 스타일 형식이 예상과 다릅니다.', {
        context: { styleUrl: options.styleUrl },
      }),
    );
  }

  try {
    const composed = composeMapStyle(payload, options.styleMode, { terrain: options.terrain });
    options.logger.debug('지도 스타일 구성', {
      mode: composed.mode,
      recolored: composed.recolored,
      unmatched: composed.unmatched,
      terrain: composed.terrain,
    });
    // 개발용 강제 장애(C7) — 정상 빌드는 이 분기를 타지 않는다.
    return ok(
      override === undefined ? composed.style : overrideBaseMapOrigin(composed.style, override),
    );
  } catch (thrown) {
    return err(
      new MapEngineError('map/layer-failed', '지도 스타일 구성에 실패했습니다.', {
        cause: thrown,
      }),
    );
  }
}
