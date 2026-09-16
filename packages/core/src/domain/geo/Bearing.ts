/**
 * 방위각 — 한 점에서 다른 점을 바라보는 나침반 방향.
 *
 * 카메라 프리셋이 "계곡 축을 가로질러 본다"(C10 결정 (e))를 만들 때 쓴다. 구간은
 * 수백 m 라 대권 초기 방위각(forward azimuth)과 평면 근사가 사실상 같지만, 위도가
 * 높은 곳에서도 어긋나지 않게 표준 공식을 쓴다.
 *
 *   θ = atan2( sin Δλ · cos φ₂ , cos φ₁ · sin φ₂ − sin φ₁ · cos φ₂ · cos Δλ )
 *
 * 결과는 MapLibre `bearing` 과 같은 규약 — 북 0°, 시계 방향, `[0, 360)`.
 */
import type { LngLat } from './LngLat';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** `[0, 360)` 으로 접는다. 음수·360 이상 모두. */
export function normalizeBearing(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** `from` 에서 `to` 를 향한 초기 방위각(도). 두 점이 같으면 0. */
export function bearingBetween(from: LngLat, to: LngLat): number {
  const lat1 = from.lat * DEG_TO_RAD;
  const lat2 = to.lat * DEG_TO_RAD;
  const dLng = (to.lng - from.lng) * DEG_TO_RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  if (x === 0 && y === 0) return 0;
  return normalizeBearing(Math.atan2(y, x) * RAD_TO_DEG);
}
