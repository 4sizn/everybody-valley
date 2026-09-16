/**
 * 개발용 경보 주입(F3b 검증) — `?devAlert=<level>:<valleyId>` 쿼리로 한 계곡의 경보 상태를
 * 고정해 스크린샷을 찍는다. 서버 없이 평시·watch·warning·evacuate·stale 화면을 재현한다.
 *
 * web 전용(`window.location`이 있을 때만) — 네이티브에는 쿼리 문자열이 없다. 쿼리가 없으면
 * `devAlertOverride()` 가 `null` 을 돌려주고 `SessionProvider` 는 평소대로 `createApiClient()`
 * 를 쓴다. 프로덕션에서는 쿼리 주입을 비활성화한다.
 */
import {
  type ApiAlert,
  type ApiBasinLookup,
  type ApiEvent,
  type ApiEventChannel,
  type ApiHealth,
  type ApiLatest,
  ApiPort,
  type ApiResult,
  type ApiStation,
  type ApiStationsQuery,
  EMPTY_DISPOSABLE,
  type LngLat,
  ok,
  type StationCode,
} from '@modu-valley/core';

export const DEV_ALERT_QUERY_KEY = 'devAlert';
const DEV_ALERT_LEVELS = ['watch', 'warning', 'evacuate', 'stale'] as const;
type DevAlertLevel = (typeof DEV_ALERT_LEVELS)[number];

export type DevAlertSpec = { readonly level: DevAlertLevel; readonly valleyId: string };

/** `"watch:eobi"` → `{ level: 'watch', valleyId: 'eobi' }`. 형식이 안 맞으면 `null`. */
export function parseDevAlertParam(raw: string | null): DevAlertSpec | null {
  if (!raw) return null;
  const [level, valleyId] = raw.split(':');
  if (valleyId === undefined || valleyId.length === 0) return null;
  return DEV_ALERT_LEVELS.includes(level as DevAlertLevel)
    ? { level: level as DevAlertLevel, valleyId }
    : null;
}

/** 현재 URL(web)에서 `devAlert` 쿼리를 읽는다. 네이티브·쿼리 없음은 `null`. */
export function devAlertOverride(): DevAlertSpec | null {
  if (process.env.NODE_ENV === 'production') return null;
  if (typeof window === 'undefined' || typeof window.location?.search !== 'string') return null;
  return parseDevAlertParam(new URLSearchParams(window.location.search).get(DEV_ALERT_QUERY_KEY));
}

// 타일의 "N분 전"은 실제 시계(Date.now())로 잰다 — 고정 시각을 넣으면 스크린샷을 언제
// 찍든 "며칠 전"이 돼 버린다. 그래서 여기서도 지금 시각 기준 상대 시각을 만든다.
const NOW = new Date().toISOString();
/** 10분 전 — "N분 전" 배지·타일 문구를 재현한다. */
const OBSERVED_10M_AGO = new Date(Date.now() - 10 * 60_000).toISOString();
/** 40분 전 — 15분 신선도 상한을 넘긴 stale 재현. */
const OBSERVED_40M_AGO = new Date(Date.now() - 40 * 60_000).toISOString();

function alertFixtureOf(spec: DevAlertSpec): ApiAlert {
  if (spec.level === 'stale') {
    return {
      valleyId: spec.valleyId,
      level: null,
      stale: true,
      lastObservedAt: OBSERVED_40M_AGO,
    };
  }
  const base = {
    valleyId: spec.valleyId,
    source: 'gauge' as const,
    confidence: 'observed' as const,
    observedAt: OBSERVED_10M_AGO,
    issuedAt: OBSERVED_10M_AGO,
    stale: false,
    lastObservedAt: OBSERVED_10M_AGO,
  };
  if (spec.level === 'watch') return { ...base, level: 'watch', rainfall1hMm: 12 };
  if (spec.level === 'warning') {
    return {
      ...base,
      level: 'warning',
      source: 'waterlevel',
      rainfall1hMm: 22,
      waterLevelDeltaM: 0.12,
    };
  }
  return {
    ...base,
    level: 'evacuate',
    rainfall1hMm: 55,
    waterLevelStage: 'severe',
    waterLevelDeltaM: 0.2,
  };
}

/**
 * 고정 응답만 내는 `ApiPort`. `devAlert` 로 고른 계곡 하나만 배열에 담는다 — 나머지 계곡은
 * 응답에 없으므로 앱은 평소대로 평시로 그린다. SSE 는 구독만 받고 다시는 부르지 않는다
 * (스크린샷은 정적 상태면 충분하다).
 */
export class DevAlertFixtureApiPort extends ApiPort {
  readonly #alerts: readonly ApiAlert[];

  constructor(spec: DevAlertSpec) {
    super();
    this.#alerts = [alertFixtureOf(spec)];
  }

  alerts(): ApiResult<readonly ApiAlert[]> {
    return Promise.resolve(ok(this.#alerts));
  }

  subscribeEvents(_channels: readonly ApiEventChannel[], _handler: (event: ApiEvent) => void) {
    return EMPTY_DISPOSABLE;
  }

  health(): ApiResult<ApiHealth> {
    return Promise.resolve(ok({ ok: true, now: NOW, lastPoll: { hydro: null, aws: null } }));
  }

  hydroStations(_query?: ApiStationsQuery): ApiResult<readonly ApiStation[]> {
    return Promise.resolve(ok([]));
  }

  hydroLatest(_codes: readonly StationCode[]): ApiResult<ApiLatest> {
    return Promise.resolve(ok({ observedAt: null, observations: [] }));
  }

  awsLatest(_codes: readonly StationCode[]): ApiResult<ApiLatest> {
    return Promise.resolve(ok({ observedAt: null, observations: [] }));
  }

  basinAt(_point: LngLat): ApiResult<ApiBasinLookup | null> {
    return Promise.resolve(ok(null));
  }
}
