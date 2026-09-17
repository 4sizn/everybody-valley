/**
 * 제보 좌표(F5d) — 제보 폼에서 지도로 고른 지점의 검증·표시용 순수 함수.
 *
 * `docs/TODO.md` F5d 절 "해석" 그대로:
 *   1. 좌표는 **선택 사항**이다 — 없으면 이 파일이 다루는 어떤 검사에도 걸리지 않는다.
 *   4. 서버가 검증한다 — (a) 위도·경도 **둘 다** 오거나 둘 다 없어야 한다(한쪽만은 무효),
 *      (b) 한국 범위 안(오타·엉뚱한 좌표 차단), (c) 그 계곡 중심선에서 반경
 *      `REPORT_COORDINATE_MAX_DISTANCE_M`(3km) 안.
 *
 * (c)는 계곡 중심선(`data/valleys/*.geojson` 의 LineString)이 있어야 판정할 수 있어
 * 서버만 할 수 있다 — 이 파일은 그 중심선을 **받아서** 판정하는 순수 함수만 준다
 * (파일을 읽는 일은 `server/src/valleys.ts` 의 몫).
 */
import { distanceToPolyline, equirectangularDistance } from '../geo/Distance';
import type { LngLat } from '../geo/LngLat';

/**
 * 한국 범위 — 국경선 정밀도가 아니라 "오타·엉뚱한 좌표"(다른 나라, 위경도 순서 뒤바뀜,
 * `0,0` 등)를 걸러낼 만큼 넉넉한 여유. 마라도(위도 33.1)부터 최북단·백령도(위도 38.6
 * 안팎)까지, 서쪽 백령도(경도 124.6 안팎)부터 독도(경도 131.9 안팎)까지를 덮는다.
 */
export const REPORT_COORDINATE_LAT_RANGE = { min: 33, max: 39 } as const;
export const REPORT_COORDINATE_LNG_RANGE = { min: 124, max: 132 } as const;

/** 계곡 중심선에서 이 거리(m) 안이어야 한다(해석 4). */
export const REPORT_COORDINATE_MAX_DISTANCE_M = 3000;

/** 소수점 6자리 십진도 — 복사 문자열·상세 면 표시가 공유하는 자리수(F5d 계약). */
const REPORT_COORDINATE_DECIMALS = 6;

/**
 * 위도·경도가 **둘 다 있거나 둘 다 없어야** 유효하다 — 한쪽만 오면 무효(해석 1·4).
 * `null`/`undefined` 모두 "없음"으로 본다.
 */
export function isValidReportCoordinatePair(
  lat: number | null | undefined,
  lng: number | null | undefined,
): boolean {
  const hasLat = lat !== null && lat !== undefined;
  const hasLng = lng !== null && lng !== undefined;
  return hasLat === hasLng;
}

/** 한국 범위 안인가. 유한한 수가 아니면(NaN·Infinity) 무효로 본다. */
export function isReportCoordinateInRange(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= REPORT_COORDINATE_LAT_RANGE.min &&
    lat <= REPORT_COORDINATE_LAT_RANGE.max &&
    lng >= REPORT_COORDINATE_LNG_RANGE.min &&
    lng <= REPORT_COORDINATE_LNG_RANGE.max
  );
}

/**
 * 계곡 중심선에서 반경 안인가(해석 4). `centerline` 은 그 계곡 GeoJSON LineString 좌표열
 * (`server/src/valleys.ts` 가 읽어 넘긴다) — 빈 배열이면(중심선을 모르면) 항상 `false`.
 */
export function isWithinReportCoordinateRadius(
  point: LngLat,
  centerline: readonly LngLat[],
  maxDistanceM: number = REPORT_COORDINATE_MAX_DISTANCE_M,
): boolean {
  if (centerline.length === 0) return false;
  return distanceToPolyline(point, centerline).meters <= maxDistanceM;
}

/** "37.983412, 127.460591" — 소수점 6자리, 위도 먼저(119 에 읊는 순서). */
export function formatReportCoordinate(lat: number, lng: number): string {
  return `${lat.toFixed(REPORT_COORDINATE_DECIMALS)}, ${lng.toFixed(REPORT_COORDINATE_DECIMALS)}`;
}

/**
 * 상세 면 복사 버튼의 문자열 — "계곡명 구간\n위도, 경도"(F5d 계약). `segmentLabel` 이 없으면
 * (계곡 전체 제보) 첫 줄은 계곡명뿐이다.
 */
export function reportCoordinateCopyText(
  valleyName: string,
  segmentLabel: string | undefined,
  lat: number,
  lng: number,
): string {
  const firstLine =
    segmentLabel === undefined || segmentLabel.length === 0
      ? valleyName
      : `${valleyName} ${segmentLabel}`;
  return `${firstLine}\n${formatReportCoordinate(lat, lng)}`;
}

/**
 * 반경 밖 지점을 다시 허용 영역 안으로 끌어온다 — 피커가 너무 멀리 끌렸을 때 되돌릴 자리.
 * 반경 안이거나 중심선을 모르면 그대로 돌려준다(되돌릴 곳이 없다).
 *
 * ponytail: 수선의 발이 아니라 **가장 가까운 중심선 정점**으로 보낸다. 정점 간격이
 * 실데이터에서 중앙값 26m·최대 167m 라 최악 ~83m 어긋나지만, 목적은 "허용 영역 안으로
 * 되돌리기" 라 정점이면 충분하다(정점은 중심선 위라 거리 0). 더 정확한 자리가 필요해지면
 * `Distance.ts` 의 `originToSegmentMeters` 를 수선의 발을 돌려주도록 바꿔 쓴다.
 */
export function clampReportCoordinate(
  point: LngLat,
  centerline: readonly LngLat[],
  maxDistanceM: number = REPORT_COORDINATE_MAX_DISTANCE_M,
): LngLat {
  if (centerline.length === 0) return point;
  if (isWithinReportCoordinateRadius(point, centerline, maxDistanceM)) return point;
  let nearest = centerline[0] as LngLat;
  let nearestMeters = equirectangularDistance(point, nearest).meters;
  for (const vertex of centerline) {
    const meters = equirectangularDistance(point, vertex).meters;
    if (meters < nearestMeters) {
      nearest = vertex;
      nearestMeters = meters;
    }
  }
  return nearest;
}
