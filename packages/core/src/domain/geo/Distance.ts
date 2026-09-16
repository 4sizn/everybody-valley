/**
 * 거리 값 객체와 측정 함수.
 *
 * 표기는 원본 데모의 `distLabel` 과 문자 단위로 같아야 한다.
 *   1000m 미만 → 정수 + 'm'      (예: 400m)
 *   1000m 이상 → 소수 1자리 'km' (예: 1.2km)
 */
import { GeoError } from '../../shared/errors';
import { err, ok, type Result } from '../../shared/result';
import type { LngLat } from './LngLat';

const KILOMETER = 1000;
/** 데모가 쓰는 지구 반경. 메르카토르 투영의 6_371_008.8 과 다르다 — 의도된 차이다. */
const DEMO_EARTH_RADIUS_M = 6371000;
const DEG_TO_RAD = Math.PI / 180;

export class Distance {
  readonly meters: number;

  private constructor(meters: number) {
    this.meters = meters;
  }

  static ofMeters(meters: number): Result<Distance, GeoError> {
    if (!Number.isFinite(meters) || meters < 0) {
      return err(
        new GeoError('geo/invalid-distance', '거리는 0 이상의 유한한 수여야 합니다.', {
          context: { meters: String(meters) },
        }),
      );
    }
    return ok(new Distance(meters));
  }

  /** 내부 계산 결과처럼 이미 유효함이 보장된 값에만 쓴다. */
  static unsafeOfMeters(meters: number): Distance {
    return new Distance(meters);
  }

  /** 원본 데모와 동일한 표기. */
  format(): string {
    return this.meters < KILOMETER
      ? `${Math.round(this.meters)}m`
      : `${(this.meters / KILOMETER).toFixed(1)}km`;
  }

  toString(): string {
    return this.format();
  }
}

/**
 * 두 지점 사이 거리 — 등장방형(equirectangular) 근사.
 *
 * 원본 데모의 `distLabel` 은 하버사인이 아니라 이 근사를 쓴다.
 *
 *   x = (lng2 − lng1) · rad · cos((lat1 + lat2) · rad / 2)
 *   y = (lat2 − lat1) · rad
 *   d = √(x² + y²) · R
 *
 * 수 km 범위에서 오차가 무시할 만해 데모에는 충분하다. 라벨 문자열이 100%
 * 같아야 하므로 공식·상수·연산 순서를 그대로 옮겼다.
 */
export function equirectangularDistance(from: LngLat, to: LngLat): Distance {
  const x = (to.lng - from.lng) * DEG_TO_RAD * Math.cos(((from.lat + to.lat) * DEG_TO_RAD) / 2);
  const y = (to.lat - from.lat) * DEG_TO_RAD;
  return Distance.unsafeOfMeters(Math.sqrt(x * x + y * y) * DEMO_EARTH_RADIUS_M);
}

/** 정확한 측지 거리가 필요할 때. 표시용 라벨은 위 근사를 유지한다. */
export function haversineDistance(from: LngLat, to: LngLat): Distance {
  const lat1 = from.lat * DEG_TO_RAD;
  const lat2 = to.lat * DEG_TO_RAD;
  const dLat = lat2 - lat1;
  const dLng = (to.lng - from.lng) * DEG_TO_RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Distance.unsafeOfMeters(2 * DEMO_EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a))));
}

/** 점을 `origin` 을 원점으로 한 평면(미터)에 투영한다 — `equirectangularDistance` 와 같은 근사. */
function projectRelativeToMeters(
  origin: LngLat,
  point: LngLat,
): { readonly x: number; readonly y: number } {
  return {
    x:
      (point.lng - origin.lng) *
      DEG_TO_RAD *
      Math.cos(((origin.lat + point.lat) * DEG_TO_RAD) / 2) *
      DEMO_EARTH_RADIUS_M,
    y: (point.lat - origin.lat) * DEG_TO_RAD * DEMO_EARTH_RADIUS_M,
  };
}

/** 원점(0,0)에서 선분 `a`–`b`(평면 미터 좌표)까지 최단 거리. */
function originToSegmentMeters(
  a: { readonly x: number; readonly y: number },
  b: { readonly x: number; readonly y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(a.x, a.y);
  const t = Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared));
  return Math.hypot(a.x + t * dx, a.y + t * dy);
}

/**
 * 점에서 폴리라인(계곡 중심선 등, F5d)까지 최단 거리 — 각 변에 내린 수선의 발까지 거리 중
 * 최솟값. 정점끼리의 거리만 보면(변 중간에 가장 가까운 경우) 실제보다 먼 값이 나올 수 있어
 * `equirectangularDistance` 만으로는 부족하다 — 두 정점을 잇는 변 자체에 투영한다.
 *
 * 평면 근사는 `equirectangularDistance` 와 같은 축척(`DEMO_EARTH_RADIUS_M`)을 점 기준
 * 로컬 미터 좌표로 써서 만든다 — 표시용 거리와 판정 기준이 어긋나지 않게 한다. 계곡 중심선
 * 범위(수 km)에서는 근사 오차가 무시할 만하다(위 근사와 같은 전제).
 *
 * `polyline` 이 빈 배열이면 판정할 대상이 없다는 뜻이라 무한대를 돌려준다(호출자는 실패로 다룬다).
 */
export function distanceToPolyline(point: LngLat, polyline: readonly LngLat[]): Distance {
  const first = polyline[0];
  if (first === undefined) return Distance.unsafeOfMeters(Number.POSITIVE_INFINITY);
  if (polyline.length === 1) return equirectangularDistance(point, first);

  let minMeters = Number.POSITIVE_INFINITY;
  let prev = projectRelativeToMeters(point, first);
  for (let index = 1; index < polyline.length; index += 1) {
    const vertex = polyline[index] as LngLat;
    const curr = projectRelativeToMeters(point, vertex);
    minMeters = Math.min(minMeters, originToSegmentMeters(prev, curr));
    prev = curr;
  }
  return Distance.unsafeOfMeters(minMeters);
}
