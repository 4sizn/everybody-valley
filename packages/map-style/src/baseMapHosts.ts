/**
 * 베이스맵 호스트 — 헬스 감시(C7)가 "우리 베이스맵 리소스" 로 세는 URL 의 목록.
 *
 * 스타일·타일·스프라이트·글리프는 openfreemap 한 호스트에서 오고(`MAP_STYLE_URLS`), DEM 은
 * AWS Open Data 의 S3 버킷 경로 하나다(`TERRAIN_DEM_SOURCE`). 명당·구간·시설·그늘·물줄기
 * GeoJSON 소스와 시설 아이콘 이미지는 베이스맵이 아니다 — 목록에 없으니 세지 않는다
 * (결정 (b)). 판별 함수는 코어 `isBaseMapUrl` 이고, 여기는 값만 든다. 값이 상수와 어긋나면
 * 테스트가 잡는다(`baseMapHosts.test.ts`).
 *
 * 개발용 강제 장애 — `overrideBaseMapOrigin` 은 스타일 소스의 openfreemap URL 을 다른
 * 오리진(로컬 프록시)으로 바꾼 **새 스타일**을 만든다. 앱이 `EXPO_PUBLIC_BASEMAP_HOST_OVERRIDE`
 * 로 넘기고, 두 어댑터가 구성 직후 같은 함수를 부른다. 정상 빌드에서는 호출되지 않는다.
 */

import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { BaseMapHost } from '@modu-valley/core';

/** openfreemap — 스타일·TileJSON·타일·스프라이트·글리프 모두 이 호스트. */
export const OPENFREEMAP_HOST = 'tiles.openfreemap.org';

/** AWS Open Data Terrarium — 공용 S3 호스트라 버킷 경로까지 붙인다(`host/경로접두`). */
export const TERRAIN_DEM_HOST: BaseMapHost = 's3.amazonaws.com/elevation-tiles-prod';

export const BASE_MAP_HOSTS: readonly BaseMapHost[] = [OPENFREEMAP_HOST, TERRAIN_DEM_HOST];

/**
 * `host[:port]` 또는 `scheme://host[:port]` → 오리진. 스킴이 없으면 로컬은 http, 나머지는 https.
 * 뒤 슬래시는 뗀다. 빈 값은 `null`.
 */
export function normalizeOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length === 0) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `${/^(localhost|127\.|\[::1\]|0\.0\.0\.0)/i.test(trimmed) ? 'http' : 'https'}://${trimmed}`;
  return withScheme.replace(/\/+$/, '');
}

/** 오리진 문자열의 host(포트 포함). `isBaseMapUrl` 의 호스트 목록에 넣을 값. */
export function hostOfOrigin(origin: string): string {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(origin);
  return match?.[1]?.toLowerCase() ?? origin.toLowerCase();
}

/** openfreemap URL 이면 스킴+호스트를 `origin` 으로 바꾼 URL, 아니면 그대로. */
export function overrideOpenFreeMapUrl(url: string, origin: string): string {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)(.*)$/i.exec(url);
  if (match === null || match[1]?.toLowerCase() !== OPENFREEMAP_HOST) return url;
  return `${origin}${match[2] ?? ''}`;
}

/**
 * 스타일 소스의 openfreemap `url`/`tiles` 를 `origin` 으로 바꾼 **새 스타일**. `sprite`·`glyphs` 도
 * 함께 바꾼다 — 같은 호스트에서 오고, 프록시를 끊었을 때 그것들만 살아 있으면 시연이 어긋난다.
 * DEM(s3)·GeoJSON 소스는 건드리지 않는다.
 */
export function overrideBaseMapOrigin(
  style: StyleSpecification,
  origin: string,
): StyleSpecification {
  const sources = Object.fromEntries(
    Object.entries(style.sources).map(([id, source]) => {
      const next = { ...source } as { url?: unknown; tiles?: unknown };
      if (typeof next.url === 'string') next.url = overrideOpenFreeMapUrl(next.url, origin);
      if (Array.isArray(next.tiles)) {
        next.tiles = next.tiles.map((tile: unknown) =>
          typeof tile === 'string' ? overrideOpenFreeMapUrl(tile, origin) : tile,
        );
      }
      return [id, next as typeof source];
    }),
  ) as StyleSpecification['sources'];

  const next: StyleSpecification = { ...style, sources };
  if (typeof style.sprite === 'string') {
    return {
      ...next,
      sprite: overrideOpenFreeMapUrl(style.sprite, origin),
      ...(typeof style.glyphs === 'string'
        ? { glyphs: overrideOpenFreeMapUrl(style.glyphs, origin) }
        : {}),
    };
  }
  return typeof style.glyphs === 'string'
    ? { ...next, glyphs: overrideOpenFreeMapUrl(style.glyphs, origin) }
    : next;
}
