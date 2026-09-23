/**
 * GeoJSON FeatureCollection → 계곡 도메인 로더.
 *
 * 입력은 `unknown` 이다 — 파일에서 읽었든 HTTP 로 받았든 신뢰하지 않는다.
 * 스키마 `data/.schema/valleys.schema.json` 의 required·enum·const·기하 규칙을
 * 여기서 코드로 다시 검사하고, 어긋나면 `ValleyDataError` 를 `Result` 로 돌려준다.
 * 스키마 검증 라이브러리를 들이지 않은 이유: 코어는 의존성이 없고, 검증 결과가
 * 곧 타입이 붙은 도메인 객체여야 하기 때문이다(검증과 변환을 두 번 하지 않는다).
 *
 * 하지 않는 것
 *  · 좌표계 변환. `metadata.crs === 'EPSG:4326'` 상수 검사가 전부다.
 *  · `selected` 같은 런타임 주입 필드 해석. 모르는 필드는 조용히 무시한다.
 */
import { LngLat } from '../../domain/geo/LngLat';
import { FACILITY_TYPES, Facility } from '../../domain/valley/Facility';
import {
  toBasinCode,
  toFacilityId,
  toSegmentId,
  toStationCode,
  toValleyId,
  type ValleyId,
} from '../../domain/valley/ids';
import { MAP_TIERS } from '../../domain/valley/MapTier';
import {
  ACCESS_DIFFICULTIES,
  BEDS,
  DEPTHS,
  SEGMENT_POSITIONS,
  Segment,
  SHADE_HOUR_COUNT,
  SPLIT_BASES,
} from '../../domain/valley/Segment';
import type { ValleyShade } from '../../domain/valley/Shade';
import { Valley } from '../../domain/valley/Valley';
import type {
  DatasetMetadata,
  ValleyDataset,
  Verification,
} from '../../domain/valley/ValleyDataset';
import { type AppError, ValleyDataError, type ValleyError } from '../../shared/errors';
import { err, ok, type Result } from '../../shared/result';
import { parseDatasetMetadata } from './DatasetMetadata';
import { parseLineString, parsePoint } from './geometry';
import { loadPeaksBundle } from './loadPeaksBundle';
import { loadShadeBundle } from './loadShadeBundle';
import { isJsonRecord, type JsonRecord, PropsReader } from './PropsReader';

const ROOT = '$';
/** 기하 파싱이 실패했을 때 reader 에 넣는 자리표시자. `finish()` 가 실패하므로 밖으로 나가지 않는다. */
const PLACEHOLDER_POSITION = LngLat.of(0, 0);

export type SegmentCollection = {
  readonly metadata: DatasetMetadata;
  readonly segments: readonly Segment[];
};

export type FacilityCollection = {
  readonly metadata: DatasetMetadata;
  readonly facilities: readonly Facility[];
};

/** `valleys.geojson` — 구간 LineString 컬렉션. */
export function parseSegmentCollection(raw: unknown): Result<SegmentCollection, ValleyDataError> {
  return parseCollection(raw, parseSegmentFeature, (metadata, segments) => ({
    metadata,
    segments,
  }));
}

/**
 * `facilities.geojson` — 시설 Point 컬렉션. 스키마 `$defs.facilityCollection`.
 *
 * 식당(`food`)은 정보에 보여주지 않는다(사용자 결정 2026-09-23). 데이터·스키마는 그대로 두고
 * 파싱 직후 한 번 걸러 목록·검색·핀·집계가 같이 사라지게 한다. 파일 로더와 합본 로더가
 * 모두 이 함수를 지난다.
 */
export function parseFacilityCollection(raw: unknown): Result<FacilityCollection, ValleyDataError> {
  return parseCollection(raw, parseFacilityFeature, (metadata, facilities) => ({
    metadata,
    facilities: facilities.filter((facility) => facility.facilityType !== 'food'),
  }));
}

/**
 * 구간·시설 컬렉션(+ 그늘 합본)을 한 번에 도메인으로. 시설 파일과 그늘 합본은 선택이다
 * (시딩 초기에는 시설이 없고, 그늘 미산출 체크아웃에는 합본이 없다).
 * 두 파일의 `metadata` 는 구간 파일 것을 대표로 삼는다.
 *
 * 합본에 있지만 구간 파일에 없는 계곡의 그늘은 **버린다** — 그늘은 사용자가 켜는 렌즈라
 * 어긋난 사본 하나 때문에 계곡 화면 전체를 막을 이유가 없다. 합본 자체가 규약을
 * 어기면(길이·링·범위) 실패다 — 그건 산출 파이프라인의 버그다.
 */
export function loadValleyDataset(
  segmentsRaw: unknown,
  facilitiesRaw?: unknown,
  shadeBundleRaw?: unknown,
): Result<ValleyDataset, AppError> {
  const segments = parseSegmentCollection(segmentsRaw);
  if (!segments.ok) return segments;
  let facilities: readonly Facility[] = [];
  if (facilitiesRaw !== undefined) {
    const parsed = parseFacilityCollection(facilitiesRaw);
    if (!parsed.ok) return parsed;
    facilities = parsed.value.facilities;
  }
  const valleys = groupIntoValleys(segments.value.segments, facilities);
  if (!valleys.ok) return valleys;

  const shade = new Map<ValleyId, ValleyShade>();
  if (shadeBundleRaw !== undefined) {
    const bundle = loadShadeBundle(shadeBundleRaw);
    if (!bundle.ok) return bundle;
    const known = new Set(valleys.value.map((valley) => valley.id));
    for (const [valleyId, valleyShade] of bundle.value) {
      if (known.has(valleyId)) shade.set(valleyId, valleyShade);
    }
  }
  return ok({ metadata: segments.value.metadata, valleys: valleys.value, shade });
}

/**
 * 합본 — 계곡별 파일 여러 장을 한 파일에 모은 것 (SD1 (f)).
 *
 *   valleys-bundle.json    = { metadata, collections: [ <data/valleys/<id>.geojson> … ] }
 *   facilities-bundle.json = { metadata, collections: [ <data/facilities/<id>.geojson> … ] }
 *
 * `apps/valley-map/scripts/sync-valley-data.mjs` 가 만들고 앱이 import 한다. 합본의
 * `metadata` 는 데이터셋 전체의 머리말(목록 footer), 각 컬렉션의 `metadata` 는 그 계곡의
 * 것 — `verified`(검수 수준)는 여기서 계곡으로 옮겨 붙인다.
 */
export type ValleyBundle = {
  readonly metadata: unknown;
  readonly collections: readonly unknown[];
};

/**
 * 합본 두 장(+ 그늘 합본) → 데이터셋. `loadValleyDataset` 의 다계곡판.
 * 계곡 순서는 합본의 컬렉션 순서다. 한 컬렉션에 계곡이 여럿 있어도 된다(샘플 파일 호환).
 */
export function loadValleyBundle(
  valleysBundleRaw: unknown,
  facilitiesBundleRaw?: unknown,
  shadeBundleRaw?: unknown,
  peaksBundleRaw?: unknown,
): Result<ValleyDataset, AppError> {
  const bundle = readBundle(valleysBundleRaw, ROOT);
  if (!bundle.ok) return bundle;
  const metadata = parseDatasetMetadata(bundle.value.metadata, `${ROOT}.metadata`);
  if (!metadata.ok) return metadata;
  const segments = collectBundle(bundle.value, parseSegmentCollection, (collection) => ({
    items: collection.segments,
    verified: collection.metadata.verified,
  }));
  if (!segments.ok) return segments;

  let facilities: readonly Facility[] = [];
  if (facilitiesBundleRaw !== undefined) {
    const facilityBundle = readBundle(facilitiesBundleRaw, ROOT);
    if (!facilityBundle.ok) return facilityBundle;
    const collected = collectBundle(
      facilityBundle.value,
      parseFacilityCollection,
      (collection) => ({
        items: collection.facilities,
        verified: undefined,
      }),
    );
    if (!collected.ok) return collected;
    facilities = collected.value.items;
  }

  const valleys = groupIntoValleys(segments.value.items, facilities, segments.value.verified);
  if (!valleys.ok) return valleys;
  const shade = attachShade(valleys.value, shadeBundleRaw);
  if (!shade.ok) return shade;
  // 봉우리는 아는 계곡의 것만(그늘과 같은 규칙). 합본이 없으면 빈 배열.
  const known = new Set(valleys.value.map((valley) => valley.id));
  const peaks = loadPeaksBundle(peaksBundleRaw).filter((peak) => known.has(peak.valleyId));
  return ok({ metadata: metadata.value, valleys: valleys.value, shade: shade.value, peaks });
}

type Collected<T> = {
  readonly items: readonly T[];
  /** 항목의 `valleyId` → 그 컬렉션 파일의 `metadata.verified`. */
  readonly verified: Map<ValleyId, Verification>;
};

/** 합본의 컬렉션을 차례로 파싱해 항목을 모은다. 실패 경로는 `$.collections[n]…` 로 고쳐 돌려준다. */
function collectBundle<C, T extends { readonly valleyId: ValleyId }>(
  bundle: ValleyBundle,
  parse: (raw: unknown) => Result<C, ValleyDataError>,
  pick: (collection: C) => { items: readonly T[]; verified: Verification | undefined },
): Result<Collected<T>, ValleyDataError> {
  const items: T[] = [];
  const verified = new Map<ValleyId, Verification>();
  for (const [index, raw] of bundle.collections.entries()) {
    const collection = parse(raw);
    if (!collection.ok) return prefixPath(collection, `${ROOT}.collections[${index}]`);
    const picked = pick(collection.value);
    for (const item of picked.items) {
      items.push(item);
      if (picked.verified !== undefined) verified.set(item.valleyId, picked.verified);
    }
  }
  return ok({ items, verified });
}

/** 그늘 합본을 아는 계곡에만 붙인다(`loadValleyDataset` 과 같은 규칙). 합본이 없으면 빈 맵. */
function attachShade(
  valleys: readonly Valley[],
  shadeBundleRaw: unknown,
): Result<ReadonlyMap<ValleyId, ValleyShade>, AppError> {
  const shade = new Map<ValleyId, ValleyShade>();
  if (shadeBundleRaw === undefined) return ok(shade);
  const parsed = loadShadeBundle(shadeBundleRaw);
  if (!parsed.ok) return parsed;
  const known = new Set(valleys.map((valley) => valley.id));
  for (const [valleyId, valleyShade] of parsed.value) {
    if (known.has(valleyId)) shade.set(valleyId, valleyShade);
  }
  return ok(shade);
}

function readBundle(raw: unknown, path: string): Result<ValleyBundle, ValleyDataError> {
  if (!isJsonRecord(raw)) {
    return err(
      new ValleyDataError('valley-data/invalid-collection', `${path} 합본은 객체여야 합니다.`, {
        context: { path },
      }),
    );
  }
  const reader = new PropsReader(raw, path);
  const collections = reader.array('collections');
  return reader.finish(() => ({ metadata: raw['metadata'], collections }));
}

/** 컬렉션 안 경로(`$.features[2]…`)를 합본 안 자리(`$.collections[7].features[2]…`)로 바꿔 돌려준다. */
function prefixPath<T>(
  failure: Result<T, ValleyDataError> & { readonly ok: false },
  prefix: string,
): Result<never, ValleyDataError> {
  const error = failure.error;
  const path = error.context['path'];
  if (typeof path !== 'string' || !path.startsWith('$')) return failure;
  return err(
    new ValleyDataError(error.code, error.message, {
      context: { ...error.context, path: `${prefix}${path.slice(1)}` },
    }),
  );
}

/**
 * 구간을 `valleyId` 로 묶어 `Valley` 로. 계곡 순서는 첫 구간이 나타난 순서다.
 * 같은 계곡의 구간이 서로 다른 `valleyName` 을 들고 있으면 데이터 오류다.
 * `verifiedByValley` 는 계곡별 파일의 `metadata.verified`(합본 로더가 채운다).
 */
export function groupIntoValleys(
  segments: readonly Segment[],
  facilities: readonly Facility[] = [],
  verifiedByValley: ReadonlyMap<ValleyId, Verification> = new Map(),
): Result<readonly Valley[], ValleyError | ValleyDataError> {
  const segmentsByValley = bucketSegments(segments);
  if (!segmentsByValley.ok) return segmentsByValley;
  const facilitiesByValley = bucketFacilities(facilities, segmentsByValley.value);
  if (!facilitiesByValley.ok) return facilitiesByValley;

  const valleys: Valley[] = [];
  for (const [valleyId, valleySegments] of segmentsByValley.value) {
    const verified = verifiedByValley.get(valleyId);
    const valley = Valley.create({
      id: valleyId,
      name: (valleySegments[0] as Segment).valleyName,
      segments: valleySegments,
      facilities: facilitiesByValley.value.get(valleyId) ?? [],
      ...(verified === undefined ? {} : { verified }),
    });
    if (!valley.ok) return valley;
    valleys.push(valley.value);
  }
  return ok(valleys);
}

function bucketSegments(
  segments: readonly Segment[],
): Result<ReadonlyMap<ValleyId, readonly Segment[]>, ValleyDataError> {
  const byValley = new Map<ValleyId, Segment[]>();
  const seenIds = new Set<string>();
  for (const segment of segments) {
    if (seenIds.has(segment.id)) return err(duplicateId('구간', segment.id));
    seenIds.add(segment.id);
    const bucket = byValley.get(segment.valleyId);
    if (bucket === undefined) {
      byValley.set(segment.valleyId, [segment]);
      continue;
    }
    const expectedName = (bucket[0] as Segment).valleyName;
    if (expectedName !== segment.valleyName) {
      return err(
        new ValleyDataError(
          'valley-data/invalid-value',
          `계곡 '${segment.valleyId}' 의 구간들이 서로 다른 valleyName 을 갖습니다.`,
          {
            context: {
              path: `features[id=${segment.id}].properties.valleyName`,
              expected: expectedName,
              actual: segment.valleyName,
            },
          },
        ),
      );
    }
    bucket.push(segment);
  }
  return ok(byValley);
}

function bucketFacilities(
  facilities: readonly Facility[],
  knownValleys: ReadonlyMap<ValleyId, unknown>,
): Result<ReadonlyMap<ValleyId, readonly Facility[]>, ValleyDataError> {
  const byValley = new Map<ValleyId, Facility[]>();
  const seenIds = new Set<string>();
  for (const facility of facilities) {
    if (seenIds.has(facility.id)) return err(duplicateId('시설', facility.id));
    seenIds.add(facility.id);
    if (!knownValleys.has(facility.valleyId)) {
      return err(
        new ValleyDataError(
          'valley-data/invalid-value',
          `시설 '${facility.id}' 이 가리키는 계곡 '${facility.valleyId}' 에 구간이 없습니다.`,
          {
            context: {
              path: `features[id=${facility.id}].properties.valleyId`,
              actual: facility.valleyId,
            },
          },
        ),
      );
    }
    const bucket = byValley.get(facility.valleyId);
    if (bucket === undefined) byValley.set(facility.valleyId, [facility]);
    else bucket.push(facility);
  }
  return ok(byValley);
}

function duplicateId(kind: string, id: string): ValleyDataError {
  return new ValleyDataError('valley-data/invalid-value', `${kind} id 가 중복됩니다: '${id}'`, {
    context: { path: `features[id=${id}].properties.id`, actual: id },
  });
}

type FeatureParser<T> = (feature: JsonRecord, path: string) => Result<T, ValleyDataError>;

function parseCollection<T, C>(
  raw: unknown,
  parseFeature: FeatureParser<T>,
  assemble: (metadata: DatasetMetadata, items: readonly T[]) => C,
): Result<C, ValleyDataError> {
  if (!isJsonRecord(raw)) {
    return err(
      new ValleyDataError(
        'valley-data/invalid-collection',
        'FeatureCollection 은 객체여야 합니다.',
        {
          context: { path: ROOT },
        },
      ),
    );
  }
  const root = new PropsReader(raw, ROOT);
  root.const('type', 'FeatureCollection');
  const features = root.array('features');
  const shape = root.finish(() => undefined);
  if (!shape.ok) return shape;
  const metadata = parseDatasetMetadata(raw['metadata'], `${ROOT}.metadata`);
  if (!metadata.ok) return metadata;

  const items: T[] = [];
  for (const [index, feature] of features.entries()) {
    const path = `${ROOT}.features[${index}]`;
    if (!isJsonRecord(feature)) {
      return err(
        new ValleyDataError(
          'valley-data/invalid-collection',
          `${path} 는 Feature 객체여야 합니다.`,
          {
            context: { path },
          },
        ),
      );
    }
    const item = parseFeature(feature, path);
    if (!item.ok) return item;
    items.push(item.value);
  }
  return ok(assemble(metadata.value, items));
}

function parseSegmentFeature(feature: JsonRecord, path: string): Result<Segment, ValleyDataError> {
  const reader = new PropsReader(feature, path);
  reader.const('type', 'Feature');
  const linePath = reader.absorb(parseLineString(feature['geometry'], `${path}.geometry`), []);
  const props = reader.record('properties');

  const id = props.string('id');
  const valleyId = props.string('valleyId');
  const valleyName = props.string('valleyName');
  const position = props.enum('segment', SEGMENT_POSITIONS);
  const order = props.number('order', { integer: true, min: 0 });
  const splitBasis = props.optionalEnum('splitBasis', SPLIT_BASES);

  const depth = props.optionalEnum('depth', DEPTHS);
  const bed = props.optionalEnum('bed', BEDS);
  const shadeByHour = props.optionalNumberArray('shadeByHour', {
    length: SHADE_HOUR_COUNT,
    min: 0,
    max: 1,
  });
  const canopyCover = props.optionalNumber('canopyCover', { min: 0, max: 1 });
  const shadeRatio = props.optionalNumber('shadeRatio', { min: 0, max: 1 });
  const accessDistanceM = props.optionalNumber('accessDistanceM', { integer: true, min: 0 });
  const accessGradePct = props.optionalNumber('accessGradePct');
  const elevationM = props.optionalNumber('elevationM', { integer: true });
  const accessDifficulty = props.optionalEnum('accessDifficulty', ACCESS_DIFFICULTIES);

  const swimBanned = props.optionalBoolean('swimBanned');
  const riskNote = props.optionalString('riskNote');
  const upstreamStationCode = props.optionalString('upstreamStationCode');
  const basinCode = props.optionalString('basinCode');

  const freeAccess = props.optionalBoolean('freeAccess');
  const campingAllowed = props.optionalBoolean('campingAllowed');
  const petAllowed = props.optionalBoolean('petAllowed');

  const mapIconTier = props.optionalNumberEnum('mapIconTier', MAP_TIERS);
  const mapLabelTier = props.optionalNumberEnum('mapLabelTier', MAP_TIERS);
  const mapImportance = props.optionalNumber('mapImportance');

  return reader.finish(
    () =>
      new Segment({
        id: toSegmentId(id),
        valleyId: toValleyId(valleyId),
        valleyName,
        position,
        order,
        path: linePath,
        ...optional('splitBasis', splitBasis),
        ...optional('depth', depth),
        ...optional('bed', bed),
        ...optional('shadeByHour', shadeByHour),
        ...optional('canopyCover', canopyCover),
        ...optional('shadeRatio', shadeRatio),
        ...optional('accessDistanceM', accessDistanceM),
        ...optional('accessGradePct', accessGradePct),
        ...optional('elevationM', elevationM),
        ...optional('accessDifficulty', accessDifficulty),
        ...optional('swimBanned', swimBanned),
        ...optional('riskNote', riskNote),
        ...optional(
          'upstreamStationCode',
          upstreamStationCode === undefined ? undefined : toStationCode(upstreamStationCode),
        ),
        ...optional('basinCode', basinCode === undefined ? undefined : toBasinCode(basinCode)),
        ...optional('freeAccess', freeAccess),
        ...optional('campingAllowed', campingAllowed),
        ...optional('petAllowed', petAllowed),
        ...optional('mapIconTier', mapIconTier),
        ...optional('mapLabelTier', mapLabelTier),
        ...optional('mapImportance', mapImportance),
      }),
  );
}

function parseFacilityFeature(
  feature: JsonRecord,
  path: string,
): Result<Facility, ValleyDataError> {
  const reader = new PropsReader(feature, path);
  reader.const('type', 'Feature');
  const position = reader.absorb(
    parsePoint(feature['geometry'], `${path}.geometry`),
    PLACEHOLDER_POSITION,
  );
  const props = reader.record('properties');

  const id = props.string('id');
  const valleyId = props.string('valleyId');
  const name = props.string('name');
  const facilityType = props.enum('facilityType', FACILITY_TYPES);
  const capacity = props.optionalNumber('capacity', { integer: true, min: 0 });
  const feeNote = props.optionalString('feeNote');
  const operatingHours = props.optionalString('operatingHours');
  const nationalPointNumber = props.optionalString('nationalPointNumber');
  const mapIconTier = props.optionalNumberEnum('mapIconTier', MAP_TIERS);
  const mapImportance = props.optionalNumber('mapImportance');

  return reader.finish(
    () =>
      new Facility({
        id: toFacilityId(id),
        valleyId: toValleyId(valleyId),
        name,
        facilityType,
        position,
        ...optional('capacity', capacity),
        ...optional('feeNote', feeNote),
        ...optional('operatingHours', operatingHours),
        ...optional('nationalPointNumber', nationalPointNumber),
        ...optional('mapIconTier', mapIconTier),
        ...optional('mapImportance', mapImportance),
      }),
  );
}

/**
 * `exactOptionalPropertyTypes` 아래서 `{ depth: undefined }` 는 `depth?: Depth` 에
 * 대입할 수 없다. 값이 있을 때만 키를 만든다.
 */
function optional<K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } {
  return value === undefined ? {} : ({ [key]: value } as { [P in K]?: V });
}
