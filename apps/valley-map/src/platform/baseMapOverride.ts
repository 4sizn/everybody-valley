/**
 * 개발용 강제 장애 스위치(C7 검증) — `EXPO_PUBLIC_BASEMAP_HOST_OVERRIDE`.
 *
 * 값이 있으면 openfreemap 오리진(스타일·TileJSON·타일·스프라이트·글리프)을 그 오리진으로 바꾼다.
 * 보통 로컬 프록시(`scripts/dev/basemap-outage-proxy.mjs`, 예 `localhost:8099`)를 가리켜 프록시를
 * 끊고 잇는 것으로 배너·재시도·회복·전면 재시도 화면을 시연한다. `EXPO_PUBLIC_*` 는 babel 이
 * 번들에 인라인하므로 바꾸면 서버를 다시 띄운다(`EXPO_PUBLIC_THEME` 과 같은 사정).
 *
 * 정상 빌드에서는 비어 있고 `undefined` — 어댑터는 이 옵션이 없으면 스타일을 한 바이트도 바꾸지
 * 않는다(`/firework` 보존).
 */
import { normalizeOrigin } from '@modu-valley/map-style';

export const BASEMAP_ORIGIN_OVERRIDE: string | undefined =
  normalizeOrigin(process.env.EXPO_PUBLIC_BASEMAP_HOST_OVERRIDE) ?? undefined;
