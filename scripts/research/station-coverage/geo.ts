export interface LngLat {
  lng: number;
  lat: number;
}

const R = 6371.0088;
const rad = (d: number): number => (d * Math.PI) / 180;

/** 하버사인 거리(km). */
export function distanceKm(a: LngLat, b: LngLat): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * 한강홍수통제소 제원의 `"128-33-04"` 형 도-분-초 문자열을 십진도로. 빈 값·`- -  -` 은 undefined.
 * 초가 60 이상인 오기(예 `37-20-91`)는 그대로 계산하되 `dmsSuspicious` 로 표시할 수 있게 별도 함수로 검사한다.
 */
export function dmsToDecimal(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const parts = s.trim().split('-').map((p) => p.trim());
  if (parts.length !== 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return undefined;
  const [d, m, sec] = parts.map(Number) as [number, number, number];
  return d + m / 60 + sec / 3600;
}

export function dmsSuspicious(s: string | undefined): boolean {
  if (!s) return false;
  const parts = s.trim().split('-').map(Number);
  return parts.length === 3 && ((parts[1] ?? 0) >= 60 || (parts[2] ?? 0) >= 60);
}

/** 슬리피 맵 타일 좌표 + 타일 안 픽셀 위치. */
export function lngLatToTile(p: LngLat, z: number): { x: number; y: number; px: number; py: number } {
  const n = 2 ** z;
  const xf = ((p.lng + 180) / 360) * n;
  const latR = rad(p.lat);
  const yf = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n;
  const x = Math.floor(xf);
  const y = Math.floor(yf);
  return { x, y, px: Math.floor((xf - x) * 256), py: Math.floor((yf - y) * 256) };
}

export const round5 = (v: number): number => Math.round(v * 1e5) / 1e5;
