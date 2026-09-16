/**
 * 베이스맵 헬스 감시
 * spotts.kr/firework의 noteBaseMapFailure / evaluateBaseMapOutage / reloadBaseMapSources 재구현.
 *
 * 목적: 타일 서버가 잠깐 흔들릴 때마다 에러 배너를 띄우면 안 되고,
 *       진짜로 지속되는 장애는 사용자에게 알려야 한다.
 *
 * 규칙:
 *  - onError 중 "우리 베이스맵 리소스"의 오류만 센다 (외부 이미지·분석 스크립트 오류는 무시)
 *  - 첫 실패에서 타이머를 arm 하고, OUTAGE_SUSTAIN_MS 동안 성공이 하나도 없으면 장애로 판정
 *  - onSourceData에서 타일이 하나라도 들어오면 즉시 회복
 *  - 재시도는 맵을 다시 만들지 않고 소스만 reload
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, ErrorEvent, MapSourceDataEvent } from "maplibre-gl";

export const OUTAGE_SUSTAIN_MS = 8_000;

export type BaseMapHealth = {
  armedAt: number | null;
  failures: number;
  outage: boolean;
};

export const INITIAL_BASE_MAP_HEALTH: BaseMapHealth = {
  armedAt: null,
  failures: 0,
  outage: false,
};

/** 베이스맵 소스로 취급할 호스트. 계곡 배포에 맞게 바꿀 것. */
export type BaseMapOrigins = {
  /** 앱 오리진 (예: window.location.origin) */
  appOrigin: string;
  /** 타일 호스트들 */
  tileHosts: string[];
};

function urlOf(err: unknown): string | null {
  const e = err as { url?: string; error?: { url?: string }; sourceId?: string };
  return e?.url ?? e?.error?.url ?? null;
}

export function isBaseMapUrl(url: string, origins: BaseMapOrigins): boolean {
  try {
    const u = new URL(url, origins.appOrigin);
    if (origins.tileHosts.includes(u.host)) return true;
    if (u.origin !== origins.appOrigin) return false;
    // 자체 오리진이면 스타일/타일 라우트만
    return u.pathname.startsWith("/api/map/") || u.pathname.startsWith("/tiles/");
  } catch {
    return false;
  }
}

/** 우리 베이스맵 리소스 오류인가 */
export function isBaseMapResourceError(e: ErrorEvent, origins: BaseMapOrigins): boolean {
  const url = urlOf(e);
  if (url) return isBaseMapUrl(url, origins);
  // url이 없는 오류는 세지 않는다 (표현식 오류 등은 장애가 아님)
  return false;
}

/** 스타일 요청 자체가 실패했는가 — 이건 배너가 아니라 전체 재시도 화면 */
export function isStyleRequestError(e: ErrorEvent, origins: BaseMapOrigins): boolean {
  const url = urlOf(e);
  if (!url) return false;
  try {
    const u = new URL(url, origins.appOrigin);
    return u.pathname.includes("/api/map/style");
  } catch {
    return false;
  }
}

export function noteBaseMapFailure(health: BaseMapHealth, now: number): BaseMapHealth {
  return {
    armedAt: health.armedAt ?? now,
    failures: health.failures + 1,
    outage: health.outage,
  };
}

export function noteBaseMapSuccess(_health: BaseMapHealth): BaseMapHealth {
  return INITIAL_BASE_MAP_HEALTH;
}

export function evaluateBaseMapOutage(health: BaseMapHealth, now: number): BaseMapHealth {
  if (health.armedAt === null) return health;
  const sustained = now - health.armedAt >= OUTAGE_SUSTAIN_MS;
  return { ...health, outage: sustained };
}

/** 맵을 다시 만들지 않고 소스만 재로드 */
export function reloadBaseMapSources(map: MapLibreMap, origins: BaseMapOrigins): void {
  const style = map.getStyle();
  if (!style?.sources) return;

  for (const [id, source] of Object.entries(style.sources)) {
    const url =
      (source as { url?: string }).url ?? (source as { tiles?: string[] }).tiles?.[0] ?? null;
    if (!url || !isBaseMapUrl(url, origins)) continue;

    const live = map.getSource(id) as { setTiles?: (t: string[]) => void; setUrl?: (u: string) => void } | undefined;
    const tiles = (source as { tiles?: string[] }).tiles;
    if (tiles && live?.setTiles) live.setTiles([...tiles]);
    else if ((source as { url?: string }).url && live?.setUrl) live.setUrl((source as { url: string }).url);
  }
  map.triggerRepaint();
}

/* ── React 훅 ────────────────────────────────────────────── */

export type UseBaseMapHealth = {
  outage: boolean;
  styleFailed: boolean;
  onError: (e: ErrorEvent) => void;
  onSourceData: (e: MapSourceDataEvent) => void;
  retry: () => void;
};

export function useBaseMapHealth(
  getMap: () => MapLibreMap | null,
  origins: BaseMapOrigins,
): UseBaseMapHealth {
  const healthRef = useRef<BaseMapHealth>(INITIAL_BASE_MAP_HEALTH);
  const timerRef = useRef<number | null>(null);
  const baseSourceCache = useRef(new Map<string, boolean>());
  const [outage, setOutage] = useState(false);
  const [styleFailed, setStyleFailed] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onError = useCallback(
    (e: ErrorEvent) => {
      if (isStyleRequestError(e, origins)) {
        setStyleFailed(true);
        return;
      }
      if (!isBaseMapResourceError(e, origins)) return;

      const wasArmed = healthRef.current.armedAt !== null;
      healthRef.current = noteBaseMapFailure(healthRef.current, Date.now());
      if (wasArmed || healthRef.current.armedAt === null) return;

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        healthRef.current = evaluateBaseMapOutage(healthRef.current, Date.now());
        if (healthRef.current.outage) setOutage(true);
      }, OUTAGE_SUSTAIN_MS);
    },
    [origins],
  );

  const onSourceData = useCallback(
    (e: MapSourceDataEvent) => {
      if (healthRef.current === INITIAL_BASE_MAP_HEALTH) return;
      if (!("tile" in e) || !e.tile) return; // 타일이 실제로 들어온 이벤트만

      const cache = baseSourceCache.current;
      let isBase = cache.get(e.sourceId);
      if (isBase === undefined) {
        const src = e.source as { url?: string; tiles?: string[] };
        const url = src?.url ?? src?.tiles?.[0] ?? "";
        isBase = url ? isBaseMapUrl(url, origins) : false;
        cache.set(e.sourceId, isBase);
      }
      if (!isBase) return;

      clearTimer();
      healthRef.current = noteBaseMapSuccess(healthRef.current);
      setOutage(false);
    },
    [origins, clearTimer],
  );

  const retry = useCallback(() => {
    const map = getMap();
    if (map) reloadBaseMapSources(map, origins);
    clearTimer();
    healthRef.current = INITIAL_BASE_MAP_HEALTH;
    baseSourceCache.current.clear();
    setOutage(false);
    setStyleFailed(false);
  }, [getMap, origins, clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  return { outage, styleFailed, onError, onSourceData, retry };
}

/* ── 사용 예 ──────────────────────────────────────────────

const origins = {
  appOrigin: window.location.origin,
  tileHosts: ["tile.modugyegok.kr"],
};
const health = useBaseMapHealth(() => mapRef.current?.getMap() ?? null, origins);

if (health.styleFailed) {
  return <RetryState title="지도를 불러오지 못했어요" onRetry={health.retry} />;
}

<Map ref={mapRef} onError={health.onError} onSourceData={health.onSourceData} ... />
{health.outage && <OutageNotice onRetry={health.retry} />}

──────────────────────────────────────────────────────── */
