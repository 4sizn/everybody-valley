/**
 * 그늘 합본 → 계곡별 `ValleyShade` 로더 (F4).
 *
 * 입력은 앱이 번들한 `shade-bundle.json` 이다 — `scripts/sync-valley-data.mjs` 가
 * `data/shade/index.json` 과 `data/shade/<valleyId>/{canopy,shadow-10…18}.geojson`
 * 을 한 파일로 합친 것(Metro 는 정적 import 만 받아 계곡 수만큼 파일을 손으로
 * import 할 수 없다).
 *
 *   { index, valleys: { <valleyId>: { canopy: FeatureCollection,
 *                                     shadow: { "10": FC, …, "18": FC } } } }
 *
 * `loadValleyDataset` 과 같은 태도다: `unknown` 을 받아 규약을 코드로 다시 검사하고
 * 어긋나면 `ValleyDataError` 를 `Result` 로 돌려준다. 정점은 `LngLat` 객체로 만들지
 * 않고 범위만 검사한 `[lng, lat]` 튜플로 남긴다(`Shade.ts` 주석).
 */
import { toValleyId, type ValleyId } from '../../domain/valley/ids';
import { SHADE_HOUR_COUNT } from '../../domain/valley/Segment';
import {
  SHADE_HOUR_VALUES,
  type ShadeMetadata,
  type ShadePolygon,
  type ShadePolygons,
  type ShadePosition,
  type ShadeRing,
  type ValleyShade,
} from '../../domain/valley/Shade';
import { ValleyDataError } from '../../shared/errors';
import { err, ok, type Result } from '../../shared/result';
import { parseDatasetMetadata } from './DatasetMetadata';
import {
  invalidValue,
  isJsonRecord,
  type JsonRecord,
  missingField,
  PropsReader,
} from './PropsReader';

const ROOT = '$';
/** GeoJSON 링은 닫혀 있어야 하므로 삼각형도 4점이다. */
const MIN_RING_POINTS = 4;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ShadeBundle = ReadonlyMap<ValleyId, ValleyShade>;

/** 합본 `shadow` 객체의 키 — `SHADE_HOURS` 의 시 값을 두 자리 문자열로. */
export const SHADE_BUNDLE_HOUR_KEYS: readonly string[] = SHADE_HOUR_VALUES.map((hour) =>
  String(hour).padStart(2, '0'),
);

export function loadShadeBundle(raw: unknown): Result<ShadeBundle, ValleyDataError> {
  if (!isJsonRecord(raw)) {
    return err(
      new ValleyDataError('valley-data/invalid-collection', '그늘 합본은 객체여야 합니다.', {
        context: { path: ROOT },
      }),
    );
  }
  const valleysRaw = raw['valleys'];
  const valleysPath = `${ROOT}.valleys`;
  if (valleysRaw === undefined || valleysRaw === null) return err(missingField(valleysPath));
  if (!isJsonRecord(valleysRaw))
    return err(invalidValue(valleysPath, '계곡 id → 레이어 객체', valleysRaw));

  const bundle = new Map<ValleyId, ValleyShade>();
  for (const [rawId, entry] of Object.entries(valleysRaw)) {
    const parsed = parseValleyShade(rawId, entry, `${valleysPath}.${rawId}`);
    if (!parsed.ok) return parsed;
    bundle.set(parsed.value.valleyId, parsed.value);
  }
  return ok(bundle);
}

function parseValleyShade(
  rawId: string,
  entry: unknown,
  path: string,
): Result<ValleyShade, ValleyDataError> {
  if (rawId.length === 0) return err(invalidValue(path, '빈 문자열이 아닌 계곡 id', rawId));
  if (!isJsonRecord(entry)) return err(invalidValue(path, '객체', entry));

  const canopy = parseLayer(entry['canopy'], `${path}.canopy`);
  if (!canopy.ok) return canopy;
  const metadata = parseShadeMetadata(
    canopy.value.collection['metadata'],
    `${path}.canopy.metadata`,
  );
  if (!metadata.ok) return metadata;

  const shadowRaw = entry['shadow'];
  const shadowPath = `${path}.shadow`;
  if (shadowRaw === undefined || shadowRaw === null) return err(missingField(shadowPath));
  if (!isJsonRecord(shadowRaw))
    return err(invalidValue(shadowPath, '시각 → FeatureCollection', shadowRaw));

  const shadowByHour: ShadePolygons[] = [];
  for (const key of SHADE_BUNDLE_HOUR_KEYS) {
    const hourPath = `${shadowPath}.${key}`;
    if (shadowRaw[key] === undefined) return err(missingField(hourPath));
    const layer = parseLayer(shadowRaw[key], hourPath);
    if (!layer.ok) return layer;
    shadowByHour.push(layer.value.polygons);
  }
  if (shadowByHour.length !== SHADE_HOUR_COUNT) {
    // 위 루프가 키 수만큼 돌므로 도달하면 상수가 어긋난 것이다.
    return err(invalidValue(shadowPath, `시각 ${SHADE_HOUR_COUNT}개`, Object.keys(shadowRaw)));
  }

  return ok({
    valleyId: toValleyId(rawId),
    canopy: canopy.value.polygons,
    shadowByHour,
    metadata: metadata.value,
  });
}

type ParsedLayer = { readonly collection: JsonRecord; readonly polygons: ShadePolygons };

/** 레이어 파일 하나 — FeatureCollection 의 Polygon·MultiPolygon 을 평평한 폴리곤 목록으로. */
function parseLayer(raw: unknown, path: string): Result<ParsedLayer, ValleyDataError> {
  if (!isJsonRecord(raw)) {
    return err(
      new ValleyDataError(
        'valley-data/invalid-collection',
        `${path} 는 FeatureCollection 객체여야 합니다.`,
        {
          context: { path },
        },
      ),
    );
  }
  const root = new PropsReader(raw, path);
  root.const('type', 'FeatureCollection');
  const features = root.array('features');
  const shape = root.finish(() => undefined);
  if (!shape.ok) return shape;

  const polygons: ShadePolygon[] = [];
  for (const [index, feature] of features.entries()) {
    const featurePath = `${path}.features[${index}]`;
    if (!isJsonRecord(feature)) {
      return err(
        new ValleyDataError(
          'valley-data/invalid-collection',
          `${featurePath} 는 Feature 객체여야 합니다.`,
          {
            context: { path: featurePath },
          },
        ),
      );
    }
    const parsed = parseGeometry(feature['geometry'], `${featurePath}.geometry`);
    if (!parsed.ok) return parsed;
    polygons.push(...parsed.value);
  }
  return ok({ collection: raw, polygons });
}

function invalidGeometry(path: string, reason: string): ValleyDataError {
  return new ValleyDataError('valley-data/invalid-geometry', `${path}: ${reason}`, {
    context: { path, reason },
  });
}

function parseGeometry(
  raw: unknown,
  path: string,
): Result<readonly ShadePolygon[], ValleyDataError> {
  if (!isJsonRecord(raw)) return err(invalidGeometry(path, 'geometry 는 객체'));
  const coordinates = raw['coordinates'];
  if (!Array.isArray(coordinates))
    return err(invalidGeometry(`${path}.coordinates`, '배열이어야 함'));
  switch (raw['type']) {
    case 'Polygon': {
      const polygon = parsePolygon(coordinates, `${path}.coordinates`);
      return polygon.ok ? ok([polygon.value]) : polygon;
    }
    case 'MultiPolygon': {
      const polygons: ShadePolygon[] = [];
      for (const [index, member] of coordinates.entries()) {
        const polygon = parsePolygon(member, `${path}.coordinates[${index}]`);
        if (!polygon.ok) return polygon;
        polygons.push(polygon.value);
      }
      return ok(polygons);
    }
    default:
      return err(invalidGeometry(`${path}.type`, "'Polygon' | 'MultiPolygon' 만 허용"));
  }
}

function parsePolygon(raw: unknown, path: string): Result<ShadePolygon, ValleyDataError> {
  if (!Array.isArray(raw) || raw.length === 0) {
    return err(invalidGeometry(path, 'Polygon 은 링 배열(외곽 + 구멍) 이어야 함'));
  }
  const rings: ShadeRing[] = [];
  for (const [index, ring] of raw.entries()) {
    const parsed = parseRing(ring, `${path}[${index}]`);
    if (!parsed.ok) return parsed;
    rings.push(parsed.value);
  }
  return ok(rings);
}

function parseRing(raw: unknown, path: string): Result<ShadeRing, ValleyDataError> {
  if (!Array.isArray(raw) || raw.length < MIN_RING_POINTS) {
    return err(invalidGeometry(path, `링은 닫힌 최소 ${MIN_RING_POINTS} 점`));
  }
  const ring: ShadePosition[] = [];
  for (const [index, position] of raw.entries()) {
    const parsed = parsePosition(position, `${path}[${index}]`);
    if (!parsed.ok) return parsed;
    ring.push(parsed.value);
  }
  const first = ring[0] as ShadePosition;
  const last = ring[ring.length - 1] as ShadePosition;
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return err(invalidGeometry(path, '링은 첫 점과 끝 점이 같아야 함'));
  }
  return ok(ring);
}

/** `[lng, lat]` 또는 `[lng, lat, alt]`. `LngLat.create` 와 같은 범위 규칙, 객체는 만들지 않는다. */
function parsePosition(raw: unknown, path: string): Result<ShadePosition, ValleyDataError> {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 3) {
    return err(invalidGeometry(path, '좌표는 [경도, 위도] 또는 [경도, 위도, 고도] 숫자 배열'));
  }
  const lng = raw[0];
  const lat = raw[1];
  if (typeof lng !== 'number' || typeof lat !== 'number') {
    return err(invalidGeometry(path, '좌표 성분은 숫자'));
  }
  if (
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180 ||
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90
  ) {
    return err(invalidGeometry(path, '좌표 범위 위반 — 순서가 [경도, 위도] 인지 확인'));
  }
  return ok([lng, lat]);
}

/**
 * 수관 파일 `metadata` — 계곡 데이터 파일과 같은 머리말(`parseDatasetMetadata`, crs 검사 포함)에
 * 그늘 고유 필드(`representativeDate`·`chmAcquisition`)가 더 실려 있다.
 */
function parseShadeMetadata(raw: unknown, path: string): Result<ShadeMetadata, ValleyDataError> {
  const base = parseDatasetMetadata(raw, path);
  if (!base.ok) return base;
  const record = raw as JsonRecord;
  const reader = new PropsReader(record, path);
  const representativeDate = reader.pattern('representativeDate', DATE_PATTERN, 'YYYY-MM-DD');
  const acquisition = record['chmAcquisition'];
  let chmAcquisition: readonly string[] = [];
  if (acquisition !== undefined && acquisition !== null) {
    if (!Array.isArray(acquisition) || !acquisition.every((item) => typeof item === 'string')) {
      return err(invalidValue(`${path}.chmAcquisition`, '문자열 배열', acquisition));
    }
    chmAcquisition = acquisition as string[];
  }
  return reader.finish(() => ({ representativeDate, chmAcquisition, source: base.value.source }));
}
