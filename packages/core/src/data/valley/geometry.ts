/**
 * GeoJSON 기하 → `LngLat`.
 *
 * 좌표 순서는 `[경도, 위도]` 다(GeoJSON·MapLibre 규약, 스키마 `coordinateOrder`).
 * 뒤집힌 `[37.83, 127.26]` 는 위도 127 이 ±90 을 넘어 `LngLat.create` 가 거절한다 —
 * 한국 좌표에서는 순서 위반이 곧 범위 위반이라 별도 판정이 필요 없다.
 * 세 번째 성분(고도)은 허용하되 버린다. 네 번째 이상은 거절한다.
 *
 * 좌표계 변환은 하지 않는다. 저장 시점에 EPSG:4326 으로 정규화하는 것이 규칙이고,
 * 로더는 `metadata.crs` 상수 검사로만 그것을 강제한다.
 */
import { LngLat } from '../../domain/geo/LngLat';
import { ValleyDataError } from '../../shared/errors';
import { err, ok, type Result } from '../../shared/result';
import { describe, isJsonRecord } from './PropsReader';

const MIN_POSITION_LENGTH = 2;
const MAX_POSITION_LENGTH = 3;
const MIN_LINE_POINTS = 2;

function invalidGeometry(path: string, reason: string, actual?: unknown): ValleyDataError {
  return new ValleyDataError('valley-data/invalid-geometry', `${path}: ${reason}`, {
    context: { path, reason, ...(actual === undefined ? {} : { actual: describe(actual) }) },
  });
}

/** `[lng, lat]` 또는 `[lng, lat, alt]` 한 점. */
export function parsePosition(raw: unknown, path: string): Result<LngLat, ValleyDataError> {
  if (
    !Array.isArray(raw) ||
    raw.length < MIN_POSITION_LENGTH ||
    raw.length > MAX_POSITION_LENGTH ||
    !raw.every((component) => typeof component === 'number')
  ) {
    return err(invalidGeometry(path, '좌표는 [경도, 위도] 또는 [경도, 위도, 고도] 숫자 배열', raw));
  }
  const lng = raw[0];
  const lat = raw[1];
  const position = LngLat.create(
    typeof lng === 'number' ? lng : Number.NaN,
    typeof lat === 'number' ? lat : Number.NaN,
  );
  if (!position.ok) {
    return err(
      invalidGeometry(
        path,
        `좌표 범위 위반 — 순서가 [경도, 위도] 인지 확인 (${position.error.message})`,
        raw,
      ),
    );
  }
  return ok(position.value);
}

function readGeometry(
  raw: unknown,
  path: string,
  expectedType: string,
): Result<readonly unknown[], ValleyDataError> {
  if (!isJsonRecord(raw)) return err(invalidGeometry(path, 'geometry 는 객체', raw));
  if (raw['type'] !== expectedType) {
    return err(invalidGeometry(`${path}.type`, `'${expectedType}' 만 허용`, raw['type']));
  }
  const coordinates = raw['coordinates'];
  if (!Array.isArray(coordinates)) {
    return err(invalidGeometry(`${path}.coordinates`, '배열이어야 함', coordinates));
  }
  return ok(coordinates);
}

/** 구간 기하. 최소 두 점. */
export function parseLineString(
  raw: unknown,
  path: string,
): Result<readonly LngLat[], ValleyDataError> {
  const coordinates = readGeometry(raw, path, 'LineString');
  if (!coordinates.ok) return coordinates;
  if (coordinates.value.length < MIN_LINE_POINTS) {
    return err(
      invalidGeometry(
        `${path}.coordinates`,
        `LineString 은 최소 ${MIN_LINE_POINTS} 점`,
        coordinates.value,
      ),
    );
  }
  const points: LngLat[] = [];
  for (const [index, position] of coordinates.value.entries()) {
    const point = parsePosition(position, `${path}.coordinates[${index}]`);
    if (!point.ok) return point;
    points.push(point.value);
  }
  return ok(points);
}

/** 시설 기하. */
export function parsePoint(raw: unknown, path: string): Result<LngLat, ValleyDataError> {
  const coordinates = readGeometry(raw, path, 'Point');
  if (!coordinates.ok) return coordinates;
  return parsePosition(coordinates.value, `${path}.coordinates`);
}
