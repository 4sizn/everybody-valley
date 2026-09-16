/**
 * 기하 도우미 — 하버사인 거리, 폴리라인 길이·절단·투영, 타일 좌표.
 *
 * 좌표는 `[lng, lat]` 튜플(GeoJSON 순서). 계곡 규모(수 km)에서 등장방형 근사로 충분하다.
 */
export type Position = readonly [lng: number, lat: number];

const EARTH_RADIUS_M = 6_371_008.8;
const DEG_TO_RAD = Math.PI / 180;

export function distanceM(a: Position, b: Position): number {
  const dLat = (b[1] - a[1]) * DEG_TO_RAD;
  const dLng = (b[0] - a[0]) * DEG_TO_RAD;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * DEG_TO_RAD) * Math.cos(b[1] * DEG_TO_RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

export function lineLengthM(line: readonly Position[]): number {
  let total = 0;
  for (let index = 1; index < line.length; index += 1) {
    total += distanceM(line[index - 1] as Position, line[index] as Position);
  }
  return total;
}

/** 점 `p` 에서 선분 `a-b` 로의 최근접점과 거리(m). 위도 기준 미터 평면. */
function nearestOnSegment(
  p: Position,
  a: Position,
  b: Position,
): { point: Position; distance: number; t: number } {
  const kx = Math.cos(p[1] * DEG_TO_RAD) * 111_320;
  const ky = 111_320;
  const ax = (a[0] - p[0]) * kx;
  const ay = (a[1] - p[1]) * ky;
  const bx = (b[0] - p[0]) * kx;
  const by = (b[1] - p[1]) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return {
    point: [p[0] + px / kx, p[1] + py / ky],
    distance: Math.hypot(px, py),
    t,
  };
}

export interface LineProjection {
  /** 선 위 최근접점. */
  readonly point: Position;
  /** 점에서 선까지 거리(m). */
  readonly distance: number;
  /** 선 시작에서 최근접점까지 선을 따라 간 거리(m). */
  readonly along: number;
}

/** 점을 폴리라인에 투영. */
export function projectOnLine(line: readonly Position[], p: Position): LineProjection {
  let best: LineProjection = {
    point: line[0] as Position,
    distance: Number.POSITIVE_INFINITY,
    along: 0,
  };
  let walked = 0;
  for (let index = 1; index < line.length; index += 1) {
    const a = line[index - 1] as Position;
    const b = line[index] as Position;
    const hit = nearestOnSegment(p, a, b);
    if (hit.distance < best.distance) {
      best = { point: hit.point, distance: hit.distance, along: walked + hit.t * distanceM(a, b) };
    }
    walked += distanceM(a, b);
  }
  return best;
}

/** 선 시작에서 `along` m 지점의 좌표(선형 보간). 범위를 벗어나면 양끝. */
export function pointAlong(line: readonly Position[], along: number): Position {
  if (along <= 0) return line[0] as Position;
  let walked = 0;
  for (let index = 1; index < line.length; index += 1) {
    const a = line[index - 1] as Position;
    const b = line[index] as Position;
    const leg = distanceM(a, b);
    if (walked + leg >= along) {
      const t = leg === 0 ? 0 : (along - walked) / leg;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    walked += leg;
  }
  return line[line.length - 1] as Position;
}

/** 선의 `[from, to]` m 구간을 잘라 낸다(끝점은 보간). 결과는 최소 두 점. */
export function sliceLine(line: readonly Position[], from: number, to: number): Position[] {
  const total = lineLengthM(line);
  const start = Math.max(0, Math.min(from, total));
  const end = Math.max(start, Math.min(to, total));
  const out: Position[] = [pointAlong(line, start)];
  let walked = 0;
  for (let index = 1; index < line.length; index += 1) {
    const a = line[index - 1] as Position;
    const b = line[index] as Position;
    const leg = distanceM(a, b);
    const at = walked + leg;
    if (at > start && at < end) out.push(b);
    walked = at;
  }
  const last = pointAlong(line, end);
  const tail = out[out.length - 1] as Position;
  if (tail[0] !== last[0] || tail[1] !== last[1]) out.push(last);
  if (out.length < 2) out.push(last);
  return out;
}

/** 슬리피 맵 타일 좌표 + 타일 안 픽셀 위치. */
export function lngLatToTile(
  p: Position,
  z: number,
): { x: number; y: number; px: number; py: number } {
  const n = 2 ** z;
  const xf = ((p[0] + 180) / 360) * n;
  const latR = p[1] * DEG_TO_RAD;
  const yf = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n;
  const x = Math.floor(xf);
  const y = Math.floor(yf);
  return { x, y, px: Math.floor((xf - x) * 256), py: Math.floor((yf - y) * 256) };
}

export const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;
export const round3 = (value: number): number => Math.round(value * 1e3) / 1e3;

/** 점 주변 `radiusM` 상자 — `[minLng, minLat, maxLng, maxLat]`. */
export function bboxAround(p: Position, radiusM: number): [number, number, number, number] {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos(p[1] * DEG_TO_RAD));
  return [p[0] - dLng, p[1] - dLat, p[0] + dLng, p[1] + dLat];
}
