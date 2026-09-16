/**
 * 바텀시트 보정 카메라 훅
 * spotts.kr/firework의 useMapCamera / measuredCenterOffsetPx 패턴 재구현.
 *
 * 문제: 지도 위에 바텀시트가 떠 있으면 map.getCenter()는 시트 뒤에 가려진 지점이다.
 *       그냥 easeTo({center})를 부르면 목표 지점이 시트 밑으로 들어간다.
 * 해결: 보이는 사각형(visible rect)의 중심을 구해 easeTo의 offset으로 보정한다.
 *
 * 요구: react-map-gl (maplibre) + maplibre-gl v5/v6
 */

import { useCallback, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type { Map as MapLibreMap, LngLatLike } from "maplibre-gl";

export const FOCUS_ZOOM = 15;
export const LOCATE_MIN_ZOOM = 15;

/** 이동 거리(px)에 비례한 duration. 가까우면 짧게, 멀면 길게. */
export function focusDurationMs(distancePx: number): number {
  if (!Number.isFinite(distancePx) || distancePx <= 0) return 320;
  // 320ms 바닥 + 거리 비례, 1200ms 상한
  return Math.min(1200, Math.round(320 + distancePx * 0.55));
}

/** 현재 중심에서 목표까지 화면상 거리(px) */
export function cameraPanDistancePx(map: MapLibreMap, target: { lng: number; lat: number }): number {
  const a = map.project(map.getCenter());
  const b = map.project([target.lng, target.lat]);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/* ── 인셋 측정 ──────────────────────────────────────────────
   CSS 변수로 상단/하단 인셋을 노출해두고 여기서 읽는다.
   --vly-inset-top    : 검색바 등 상단 오버레이 높이
   --vly-inset-bottom : 현재 시트가 덮은 높이 (스냅 변경 시 갱신)
   ──────────────────────────────────────────────────────── */

function readCssPx(name: string): number {
  if (typeof window === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return 0;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

export function measuredTopInsetPx(): number {
  return readCssPx("--vly-inset-top");
}

export function measuredBottomInsetPx(): number {
  return readCssPx("--vly-inset-bottom");
}

/**
 * 보이는 사각형의 중심이 컨테이너 중심에서 얼마나 위로 떨어져 있는지(px).
 * easeTo({ offset: [0, -measuredCenterOffsetPx()] }) 형태로 쓴다.
 */
export function measuredCenterOffsetPx(): number {
  const top = measuredTopInsetPx();
  const bottom = measuredBottomInsetPx();
  return (bottom - top) / 2;
}

/** 특정 스냅 높이 기준으로 오프셋을 미리 계산 (시트를 옮기면서 동시에 카메라를 옮길 때) */
export function snapCenterOffsetPx(snapHeightPx: number): number {
  return (snapHeightPx - measuredTopInsetPx()) / 2;
}

/** 시트가 지도를 거의 다 덮었는지 — 남은 높이가 25% 미만이면 true */
export function isMapCoveredBySheet(map: MapLibreMap): boolean {
  const h = map.getContainer().clientHeight;
  if (h <= 0) return false;
  return Math.max(0, h - measuredBottomInsetPx()) < h * 0.25;
}

/** 보이는 사각형의 중심 화면 좌표 */
export function getVisibleCenterPoint(map: MapLibreMap): [number, number] {
  const el = map.getContainer();
  const w = el.clientWidth;
  const h = el.clientHeight;
  const top = measuredTopInsetPx();
  const bottom = measuredBottomInsetPx();
  return [w / 2, top + (h - top - bottom) / 2];
}

/** 보이는 사각형의 중심 좌표 (지도 중심이 아니라 "사용자가 보고 있는 중심") */
export function getVisibleCenterCoords(map: MapLibreMap): { lng: number; lat: number } {
  const p = map.unproject(getVisibleCenterPoint(map));
  return { lng: p.lng, lat: p.lat };
}

export type FocusOptions = {
  zoom?: number;
  offsetY?: number;
  duration?: number;
  /** 시트가 지도를 다 덮었을 때 시트를 내리는 콜백 */
  collapseSheet?: () => void;
};

export function useMapCamera(mapRef: React.RefObject<MapRef | null>) {
  const lastFocusRef = useRef<{ lng: number; lat: number } | null>(null);

  const defaultOffsetY = useCallback(() => -measuredCenterOffsetPx(), []);

  /** 한 지점으로 포커스 — 시트 보정 + 거리 비례 duration */
  const focus = useCallback(
    (target: { lng: number; lat: number }, opts: FocusOptions = {}) => {
      const ref = mapRef.current;
      if (!ref) return;
      const map = ref.getMap();

      if (opts.collapseSheet && isMapCoveredBySheet(map)) opts.collapseSheet();

      lastFocusRef.current = target;
      map.easeTo({
        center: [target.lng, target.lat],
        zoom: opts.zoom ?? FOCUS_ZOOM,
        offset: [0, opts.offsetY ?? defaultOffsetY()],
        duration: opts.duration ?? focusDurationMs(cameraPanDistancePx(map, target)),
      });
    },
    [mapRef, defaultOffsetY],
  );

  /** 내 위치로 — 현재 줌이 낮으면 LOCATE_MIN_ZOOM까지 당긴다 */
  const locate = useCallback(
    (target: { lng: number; lat: number }, opts: FocusOptions = {}) => {
      const ref = mapRef.current;
      if (!ref) return;
      const map = ref.getMap();
      const zoom = Math.max(map.getZoom(), opts.zoom ?? LOCATE_MIN_ZOOM);
      focus(target, { ...opts, zoom });
    },
    [mapRef, focus],
  );

  /**
   * 여러 지점을 담기 — fitBounds는 시트 보정이 까다로워서
   * 보이는 사각형을 padding으로 환산해 넘긴다.
   */
  const fitPoints = useCallback(
    (points: Array<{ lng: number; lat: number }>, opts: { maxZoom?: number; duration?: number } = {}) => {
      const ref = mapRef.current;
      if (!ref || points.length === 0) return;
      const map = ref.getMap();

      let west = points[0].lng;
      let east = points[0].lng;
      let south = points[0].lat;
      let north = points[0].lat;
      for (const p of points) {
        west = Math.min(west, p.lng);
        east = Math.max(east, p.lng);
        south = Math.min(south, p.lat);
        north = Math.max(north, p.lat);
      }

      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        {
          padding: {
            top: measuredTopInsetPx() + 24,
            bottom: measuredBottomInsetPx() + 24,
            left: 24,
            right: 24,
          },
          maxZoom: opts.maxZoom ?? FOCUS_ZOOM,
          duration: opts.duration ?? 520,
        },
      );
    },
    [mapRef],
  );

  /** 시트 스냅이 바뀔 때 현재 보고 있던 지점을 유지하도록 카메라만 밀어준다 */
  const reflowForSheet = useCallback(
    (nextBottomInsetPx: number) => {
      const ref = mapRef.current;
      if (!ref) return;
      const map = ref.getMap();
      const current = lastFocusRef.current ?? getVisibleCenterCoords(map);
      const nextOffset = -(nextBottomInsetPx - measuredTopInsetPx()) / 2;
      map.easeTo({
        center: [current.lng, current.lat] as LngLatLike,
        offset: [0, nextOffset],
        duration: 200,
      });
    },
    [mapRef],
  );

  return { focus, locate, fitPoints, reflowForSheet, getVisibleCenterCoords };
}
