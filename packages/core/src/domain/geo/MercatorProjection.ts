/**
 * 웹 메르카토르 투영 포트.
 *
 * 불꽃 파티클은 메르카토르 좌표계에서 시뮬레이션된다(커스텀 레이어의 정점이
 * 그 좌표계이기 때문). 시뮬레이션을 플랫폼에서 떼어 내려면 좌표 변환이
 * 지도 SDK 밖에 있어야 한다.
 *
 * 아래 상수와 공식은 maplibre-gl 의 `MercatorCoordinate` 와 동일하다.
 * 값이 조금이라도 다르면 불꽃의 고도·확산 반경이 어긋나므로 그대로 옮겼다.
 *   · earthRadius        6_371_008.8 m
 *   · mercatorX          (180 + lng) / 360
 *   · mercatorY          (180 - (180/π)·ln(tan(π/4 + lat·π/360))) / 360
 *   · mercatorZ          altitude / (2π·R·cos(lat))
 *   · meterInMercator    1 / (2π·R·cos(lat))
 */
import type { LngLat } from './LngLat';

export type MercatorPoint = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export abstract class MercatorProjectionPort {
  /** 경위도 + 고도(m) → 메르카토르 단위 좌표. */
  abstract project(position: LngLat, altitudeMeters: number): MercatorPoint;

  /** 해당 위도에서 1m 가 몇 메르카토르 단위인가. */
  abstract meterScaleAt(position: LngLat): number;
}

const EARTH_RADIUS_M = 6371008.8;
const EARTH_CIRCUMFERENCE_M = 2 * Math.PI * EARTH_RADIUS_M;
const DEG_TO_RAD = Math.PI / 180;

export function mercatorXFromLng(lng: number): number {
  return (180 + lng) / 360;
}

export function mercatorYFromLat(lat: number): number {
  return (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;
}

export function circumferenceAtLatitude(lat: number): number {
  return EARTH_CIRCUMFERENCE_M * Math.cos(lat * DEG_TO_RAD);
}

export function mercatorZFromAltitude(altitudeMeters: number, lat: number): number {
  return altitudeMeters / circumferenceAtLatitude(lat);
}

export class WebMercatorProjection extends MercatorProjectionPort {
  override project(position: LngLat, altitudeMeters: number): MercatorPoint {
    return {
      x: mercatorXFromLng(position.lng),
      y: mercatorYFromLat(position.lat),
      z: mercatorZFromAltitude(altitudeMeters, position.lat),
    };
  }

  override meterScaleAt(position: LngLat): number {
    return 1 / circumferenceAtLatitude(position.lat);
  }
}
