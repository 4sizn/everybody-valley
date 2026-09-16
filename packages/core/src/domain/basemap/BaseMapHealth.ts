/**
 * 베이스맵 헬스 — 순수 상태기계 (C7).
 *
 * valley-ds `base-map-health.ts`(spotts.kr/firework 의 `noteBaseMapFailure` /
 * `evaluateBaseMapOutage` 재구현)가 기준이다. 목적은 둘이다 — 타일 서버가 잠깐
 * 흔들릴 때마다 오류를 띄우지 않고, 진짜로 지속되는 장애는 알린다.
 *
 * 규칙
 *  · 첫 실패에서 타이머를 arm 한다(`armedAt`). 이후 실패는 횟수만 늘린다.
 *  · arm 뒤 `OUTAGE_SUSTAIN_MS` 동안 성공이 하나도 없으면 장애(`outage`).
 *  · 타일이 하나라도 들어오면 즉시 회복 — 상태가 처음으로 돌아간다.
 *  · 재시도는 지도를 다시 만들지 않고 소스만 reload 한다(어댑터 `retryBaseMap`).
 *
 * 이 파일은 시계를 모른다. `now` 는 호출부가 넘기고(ms), 타이머는
 * `BaseMapHealthMonitor` 가 든다 — 그래서 경계 시각을 테스트에서 정확히 밟을 수 있다.
 *
 * 무엇을 "우리 베이스맵" 으로 볼지는 `isBaseMapUrl` 이 정한다. 호스트 목록은
 * `map-style` 의 `BASE_MAP_HOSTS`(스타일·타일 openfreemap, DEM s3 경로)에서 온다 —
 * 명당·구간·시설·그늘·물줄기 GeoJSON 소스와 아이콘 이미지는 대상이 아니다(결정 (b)).
 */

/** 첫 실패 뒤 이 시간 동안 성공이 없으면 장애. spotts 원본과 같은 8초. */
export const OUTAGE_SUSTAIN_MS = 8_000;

export type BaseMapHealth = {
  /** 첫 실패 시각(ms). `null` 이면 실패가 없다. */
  readonly armedAt: number | null;
  /** arm 이후 누적 실패 수. 로그·디버그용이며 판정에는 쓰지 않는다. */
  readonly failures: number;
  /** 장애 판정. 배너는 이 값만 본다. */
  readonly outage: boolean;
};

export const INITIAL_BASE_MAP_HEALTH: BaseMapHealth = {
  armedAt: null,
  failures: 0,
  outage: false,
};

/** 실패 하나. 이미 arm 돼 있으면 시각은 그대로 두고 횟수만 늘린다. */
export function noteFailure(state: BaseMapHealth, now: number): BaseMapHealth {
  return {
    armedAt: state.armedAt ?? now,
    failures: state.failures + 1,
    outage: state.outage,
  };
}

/** 성공 하나 — 타일이 들어왔다. 장애든 arm 상태든 즉시 처음으로. */
export function noteSuccess(): BaseMapHealth {
  return INITIAL_BASE_MAP_HEALTH;
}

/**
 * 지금 시각으로 장애를 판정한다. arm 되지 않았으면 그대로. 경계는 `>=` —
 * 정확히 `OUTAGE_SUSTAIN_MS` 가 지난 순간부터 장애다.
 */
export function evaluate(state: BaseMapHealth, now: number): BaseMapHealth {
  if (state.armedAt === null) return state;
  const outage = now - state.armedAt >= OUTAGE_SUSTAIN_MS;
  return outage === state.outage ? state : { ...state, outage };
}

/**
 * 베이스맵 호스트 표기 — `host` 또는 `host/경로접두`.
 *   'tiles.openfreemap.org'                → 그 호스트의 모든 경로
 *   's3.amazonaws.com/elevation-tiles-prod' → 그 호스트에서 그 경로 아래만
 * 뒤 형식은 공용 호스트(AWS S3)에서 우리 버킷만 집어내기 위한 것이다.
 */
export type BaseMapHost = string;

/** URL 이 베이스맵 리소스인가. 상대 URL·`data:`·잘못된 URL 은 거짓. */
export function isBaseMapUrl(url: string, hosts: readonly BaseMapHost[]): boolean {
  const parsed = parseAbsoluteUrl(url);
  if (parsed === null) return false;
  return hosts.some((entry) => {
    const slash = entry.indexOf('/');
    if (slash === -1) return parsed.host === entry.toLowerCase();
    const host = entry.slice(0, slash).toLowerCase();
    const prefix = entry.slice(slash);
    return parsed.host === host && (parsed.path === prefix || parsed.path.startsWith(`${prefix}/`));
  });
}

/**
 * 절대 URL 의 host(포트 포함)·경로만 뽑는다. 코어는 DOM 의 `URL` 을 쓰지 않으므로
 * (플랫폼 무관 컴파일) 스킴·호스트·경로 세 조각만 보는 최소 파서다. 쿼리·프래그먼트는 버린다.
 */
function parseAbsoluteUrl(url: string): { readonly host: string; readonly path: string } | null {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)([^?#]*)/i.exec(url);
  if (match === null) return null;
  const host = match[1]?.toLowerCase();
  if (host === undefined || host.length === 0) return null;
  const path = match[2] === undefined || match[2] === '' ? '/' : match[2];
  return { host, path };
}

/**
 * 스타일 소스 명세에서 대표 URL 하나 — TileJSON `url` 이 있으면 그것, 없으면 첫 `tiles`
 * 템플릿. 둘 다 없으면(GeoJSON·이미지 소스) `null`. 어댑터가 오류·타일 이벤트의 소스가
 * 베이스맵인지 가릴 때 쓴다.
 */
export function sourceUrlOf(source: unknown): string | null {
  if (source === null || typeof source !== 'object') return null;
  const candidate = source as { url?: unknown; tiles?: unknown };
  if (typeof candidate.url === 'string') return candidate.url;
  if (Array.isArray(candidate.tiles) && typeof candidate.tiles[0] === 'string') {
    return candidate.tiles[0];
  }
  return null;
}
