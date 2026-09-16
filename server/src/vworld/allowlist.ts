/**
 * `/api/vworld/*` → `https://api.vworld.kr/req/*` 매핑의 순수 규칙.
 *
 * 허용목록(결정 (e)): WFS·WMS·검색·지오코더 네 서비스만. `key`·`domain` 은 클라이언트가 보낸 값을 버리고
 * 서버 것을 넣는다. 응답은 저장하지 않는다(브이월드 약관 §19) — 여기서는 URL 만 만들고, 캐시 금지 헤더는
 * 라우트가 붙인다.
 */

export const VWORLD_ORIGIN = 'https://api.vworld.kr';

/** 클라이언트 경로 조각 → 업스트림 `/req/<service>`. 여러 표기를 받아 한 서비스로 모은다. */
const SERVICES: Readonly<Record<string, string>> = {
  wfs: 'wfs',
  wms: 'wms',
  search: 'search',
  address: 'address',
  geocoder: 'address',
};

/** 서버가 채우는 파라미터. 클라이언트가 보낸 같은 이름은 버린다. */
const SERVER_PARAMS = ['key', 'domain', 'apiKey'] as const;

export const VWORLD_ALLOWED_METHODS = ['GET', 'HEAD', 'POST'] as const;

export interface VworldCredentials {
  readonly key: string;
  readonly domain: string;
}

export type UpstreamResolution =
  | { readonly ok: true; readonly url: URL; readonly service: string }
  | { readonly ok: false; readonly reason: 'not-allowed' | 'method-not-allowed' };

/**
 * @param subpath `/api/vworld/` 뒤의 경로. `wfs`, `req/wfs`, `wfs/` 모두 허용.
 * @param query   클라이언트 쿼리 문자열(`?` 포함 여부 무관).
 */
export function resolveVworldUpstream(
  subpath: string,
  query: string,
  method: string,
  credentials: VworldCredentials,
): UpstreamResolution {
  if (!(VWORLD_ALLOWED_METHODS as readonly string[]).includes(method.toUpperCase())) {
    return { ok: false, reason: 'method-not-allowed' };
  }
  const segments = subpath.split('/').filter((s) => s.length > 0);
  if (segments[0] === 'req') segments.shift();
  const service = segments.length === 1 ? SERVICES[segments[0]?.toLowerCase() ?? ''] : undefined;
  if (service === undefined) return { ok: false, reason: 'not-allowed' };

  const url = new URL(`${VWORLD_ORIGIN}/req/${service}`);
  const incoming = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  for (const p of SERVER_PARAMS) incoming.delete(p);
  for (const [k, v] of incoming) url.searchParams.append(k, v);
  url.searchParams.set('key', credentials.key);
  url.searchParams.set('domain', credentials.domain);
  return { ok: true, url, service };
}

/** 클라이언트에게 돌려줄 때 그대로 두는 응답 헤더. 그 밖(Set-Cookie 등)은 버린다. */
export const PASSTHROUGH_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-disposition',
  'last-modified',
] as const;
