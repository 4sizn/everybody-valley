/**
 * SD1 시딩 빌드 — 계곡 30개 × (구간 GeoJSON + 시설 GeoJSON) 를 자동 채움으로 만든다 (결정 (h)).
 *
 *   취득   OSM 하천 중심선(Overpass) → 본류 절단(상류 2 km·하류 1 km) → 구간(1구간 `whole`, splits.csv 가 있으면 상·중·하)
 *          OSM 편의시설 + 표준데이터 CSV(있으면) + facilities-manual.csv → 시설
 *   자동   유역 코드(브이월드 WFS lt_c_wkmsbsn — 코드만), 접근 거리·경사(가장 가까운 주차장 ↔ 구간 시작점, Terrarium)
 *          그늘·수관은 `--shade` 로 P1 파이프라인을 계곡별로 호출(역기입)
 *   병합   data/seed/manual.csv(수심·바닥·금지·riskNote·무료·야영·반려견) — 자동 채움 뒤에 덮으므로 재실행에 안전
 *   검증   core `loadValleyBundle` 로 30세트를 한 번에 로드해 스키마·기하 규칙을 통과해야 쓴다
 *   쓰기   data/valleys/<id>.geojson · data/facilities/<id>.geojson (Prettier 식 포맷, 그늘 역기입 포맷과 동일)
 *          + data/seed/build-report.md(매칭 결과표) + manual.csv 템플릿 행 보충
 *
 *   pnpm seed:build                       # 전체 30개, 캐시 재사용
 *   pnpm seed:build --valley baegun-pocheon --valley myeongji
 *   pnpm seed:build --shade               # 쓰기 뒤 그늘 파이프라인까지(계곡당 ~35 s)
 *   pnpm seed:build --only-shade          # 파일은 두고 그늘만 다시
 *
 * 브이월드 응답은 저장하지 않는다(코드만). OSM 은 ODbL 출처표시(`metadata.sources`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadValleyBundle } from '@modu-valley/core';
import { buildCenterline, type Centerline, DOWNSTREAM_M, UPSTREAM_M } from './centerline.mts';
import { readCsv } from './csv.mts';
import { elevationAt, TERRARIUM_ATTRIBUTION } from './elevation.mts';
import { FACILITIES_DIR, loadKeys, SEED_DIR, todayKst, VALLEYS_DIR } from './env.mts';
import {
  EXTRA_MAX_FROM_LINE_M,
  extraFacilities,
  FACILITY_RADIUS_M,
  type FacilityRecord,
  loadManualFacilities,
  loadStdBins,
  loadStdParking,
  loadStdParkPlaygrounds,
  loadStdPlaygrounds,
  loadStdRestrooms,
  mergeFacilities,
  osmFacilities,
  shelterFacilities,
  stdNearLine,
  stdWithin,
  toFacilityFeature,
  trimFarFacilities,
} from './facilities.mts';
import { dumpsFile } from './format.mts';
import { distanceM, lineLengthM, type Position, pointAlong, sliceLine } from './geo.mts';
import { log, warn } from './log.mts';
import { applyManual, loadManual, MANUAL_FIELDS, MANUAL_HEADER, MANUAL_PATH } from './manual.mts';
import {
  fetchAmenities,
  fetchExtras,
  fetchShelters,
  fetchWaterways,
  OSM_ATTRIBUTION,
} from './overpass.mts';
import { runShade, shadeEnvironmentReady } from './shade.mts';
import { loadSplits, type SplitRow } from './splits.mts';
import { loadSeedValleys, type SeedValley, valleyFilterFromArgv } from './valleys.mts';
import { lookupBasin } from './vworld.mts';

const WATERWAY_RADIUS_M = 2000;
/**
 * 중심선을 손으로 만든 계곡 — `seed:build` 가 덮어쓰면 안 된다. 긴고랑(SD3)은 OSM 에 하천이 없어
 * Terrarium DEM 최소비용경로로 근사했는데, 2026-09-23 전체 재시딩이 934 m 떨어진 184 m 도랑을 중심선으로
 * 잡아 덮어쓴 적이 있다(HEAD 에서 되살림). 여기 있는 계곡은 건너뛴다.
 */
const HAND_BUILT_CENTERLINE = new Set(['gingorang']);
/** 정자 조회 반경(중심선 버퍼) — `SHELTER_MAX_FROM_LINE_M` 보다 조금 넉넉하게. */
const SHELTER_FETCH_RADIUS_M = 400;
const VWORLD_ATTRIBUTION =
  'https://www.vworld.kr/ (표준유역 lt_c_wkmsbsn 코드 조회 — 기하 저장 없음)';
const STD_PARKING_ATTRIBUTION =
  'https://www.data.go.kr/data/15012896/standard.do (전국주차장정보표준데이터, 공공누리 1유형)';
const STD_RESTROOM_ATTRIBUTION =
  'https://www.data.go.kr/data/15012892/standard.do (전국공중화장실표준데이터, 공공누리 1유형)';
const STD_BIN_ATTRIBUTION =
  'https://www.data.go.kr/data/15129450/standard.do (전국휴지통표준데이터, 공공누리 1유형)';
const STD_PARK_ATTRIBUTION =
  'https://www.data.go.kr/data/15012890/standard.do (전국도시공원정보표준데이터 유희시설, 공공누리 1유형)';
const STD_PLAYGROUND_ATTRIBUTION =
  'https://www.data.go.kr/data/15124519/openapi.do (행정안전부 전국어린이놀이시설정보서비스)';
/** 다른 파이프라인이 역기입하는 키(그늘 `--shade`, 표고 `seed:elevation`) — 재실행 때 기존 파일에서 그대로 옮긴다. */
const CARRIED_KEYS = ['shadeByHour', 'canopyCover', 'shadeRatio', 'elevationM'] as const;
/** 접근 거리·경사를 계산하는 주차장 최대 거리(m). 이보다 멀면 "이 구간의 주차장"이 아니다. */
const ACCESS_MAX_M = 3000;

type Json = Record<string, unknown>;

interface ValleyOutput {
  readonly valley: SeedValley;
  readonly centerline: Centerline;
  readonly segments: Json[];
  readonly facilities: FacilityRecord[];
  readonly basinCodes: string[];
  readonly manualApplied: number;
}

interface BuildOptions {
  readonly only: readonly string[];
  readonly shade: boolean;
  readonly onlyShade: boolean;
}

function parseOptions(argv: readonly string[]): BuildOptions {
  return {
    only: valleyFilterFromArgv(argv),
    shade: argv.includes('--shade'),
    onlyShade: argv.includes('--only-shade'),
  };
}

function readExisting(file: string): Json | undefined {
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Json;
}

function existingSegmentProps(existing: Json | undefined): Map<string, Json> {
  const out = new Map<string, Json>();
  const features = (existing?.['features'] as Json[] | undefined) ?? [];
  for (const feature of features) {
    const props = feature['properties'] as Json | undefined;
    if (props !== undefined && typeof props['id'] === 'string') out.set(props['id'], props);
  }
  return out;
}

/** 구간 절단 계획 — splits.csv 행이 있으면 그대로, 없으면 1구간. */
function planSegments(
  centerline: Centerline,
  splits: readonly SplitRow[] | undefined,
): { id: string; segment: string; splitBasis: string; path: Position[] }[] {
  if (splits === undefined || splits.length === 0) {
    return [{ id: 'whole', segment: 'whole', splitBasis: 'none', path: [...centerline.path] }];
  }
  const total = lineLengthM(centerline.path);
  return splits.map((row) => ({
    id: row.segment,
    segment: row.segment,
    splitBasis: row.splitBasis,
    path: sliceLine(centerline.path, Math.min(row.fromM, total), Math.min(row.toM, total)),
  }));
}

async function accessOf(
  start: Position,
  facilities: readonly FacilityRecord[],
  keys: ReturnType<typeof loadKeys>,
): Promise<{ accessDistanceM: number; accessGradePct: number } | undefined> {
  const parking = facilities
    .filter((facility) => facility.facilityType === 'parking')
    .map((facility) => ({ facility, distance: distanceM(facility.position, start) }))
    .sort((a, b) => a.distance - b.distance)[0];
  if (parking === undefined || parking.distance > ACCESS_MAX_M || parking.distance < 1)
    return undefined;
  const startElevation = await elevationAt(start, keys);
  const parkingElevation = await elevationAt(parking.facility.position, keys);
  const grade = (Math.abs(startElevation - parkingElevation) / parking.distance) * 100;
  return {
    accessDistanceM: Math.round(parking.distance),
    accessGradePct: Math.round(grade * 10) / 10,
  };
}

async function buildValley(
  valley: SeedValley,
  context: {
    keys: ReturnType<typeof loadKeys>;
    stdParking: readonly FacilityRecord[];
    stdRestrooms: readonly FacilityRecord[];
    /** 쓰레기통·놀이터 표준데이터 전체 행 — 중심선이 나온 뒤 `stdNearLine` 으로 자른다. */
    stdBins: readonly import('./facilities.mts').StdParkingRow[];
    stdPlaygrounds: readonly import('./facilities.mts').StdParkingRow[];
    stdParkPlaygrounds: readonly import('./facilities.mts').StdParkingRow[];
    manualFacilities: readonly FacilityRecord[];
    manual: readonly import('./manual.mts').ManualEntry[];
    splits: readonly SplitRow[] | undefined;
  },
): Promise<ValleyOutput | undefined> {
  const center: Position = [valley.lng, valley.lat];
  const ways = await fetchWaterways(valley.id, center, WATERWAY_RADIUS_M, context.keys);
  const centerline = await buildCenterline(ways, center, context.keys);
  if (centerline === undefined) {
    warn(
      `${valley.id}: 반경 ${WATERWAY_RADIUS_M} m 에 OSM 하천 way 가 없다 — 좌표열을 만들 수 없어 건너뜀`,
    );
    return undefined;
  }
  if (centerline.flipped) warn(`${valley.id}: OSM 방향과 표고가 어긋나 상·하류를 뒤집었다`);

  const pois = await fetchAmenities(valley.id, center, FACILITY_RADIUS_M, context.keys);
  /* 정자·쉼터(2026-09-08)는 계곡 점 반경이 아니라 **중심선 버퍼**로 받는다 — 물가에 앉는 자리라
     계곡을 벗어나면 남의 동네 공원 정자다. 규칙과 거리 기준은 `facilities.mts` 가 소유하고
     `pnpm seed:shelters`(기존 파일에 덧붙이는 스크립트)도 같은 함수를 쓴다. */
  const shelterPois = await fetchShelters(
    valley.id,
    centerline.path,
    SHELTER_FETCH_RADIUS_M,
    context.keys,
  );
  /* 쓰레기통·놀이터(2026-09-23)도 중심선 기준 — `EXTRA_MAX_FROM_LINE_M`. 표준데이터 3종 + OSM. */
  const extraPois = await fetchExtras(
    valley.id,
    centerline.path,
    EXTRA_MAX_FROM_LINE_M,
    context.keys,
  );
  const line = centerline.path;
  const facilities = trimFarFacilities(
    mergeFacilities(
      [
        ...context.stdParking,
        ...context.stdRestrooms,
        ...stdNearLine(context.stdPlaygrounds, line, valley.id, 'playground', 'std-playground'),
        ...stdNearLine(context.stdParkPlaygrounds, line, valley.id, 'playground', 'std-park'),
        ...stdNearLine(context.stdBins, line, valley.id, 'bin', 'std-bin'),
      ],
      [
        ...osmFacilities(pois, center, valley.id),
        ...shelterFacilities(shelterPois, line, valley.id),
        ...extraFacilities(extraPois, line, valley.id),
      ],
      context.manualFacilities,
    ),
    line,
  );

  const existing = existingSegmentProps(
    readExisting(path.join(VALLEYS_DIR, `${valley.id}.geojson`)),
  );
  const segments: Json[] = [];
  const basinCodes: string[] = [];
  let manualApplied = 0;
  const plan = planSegments(centerline, context.splits);
  for (const [order, piece] of plan.entries()) {
    const id = `${valley.id}-${piece.id}`;
    const midpoint = pointAlong(piece.path, lineLengthM(piece.path) / 2);
    const basin = await lookupBasin(midpoint, context.keys);
    if (basin?.sbsncd) basinCodes.push(basin.sbsncd);
    const access = await accessOf(piece.path[0] as Position, facilities, context.keys);
    const previous = existing.get(id) ?? {};
    const properties: Json = {
      id,
      valleyId: valley.id,
      valleyName: valley.name,
      segment: piece.segment,
      order,
      splitBasis: piece.splitBasis,
    };
    for (const key of CARRIED_KEYS)
      if (previous[key] !== undefined) properties[key] = previous[key];
    if (access !== undefined) {
      properties['accessDistanceM'] = access.accessDistanceM;
      properties['accessGradePct'] = access.accessGradePct;
    }
    if (basin?.sbsncd) properties['basinCode'] = basin.sbsncd;
    properties['mapIconTier'] = 0;
    properties['mapLabelTier'] = 0;
    properties['mapImportance'] = 10 + order;
    manualApplied += applyManual(properties, context.manual);
    segments.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: piece.path.map((point) => [point[0], point[1]]),
      },
      properties: orderProperties(properties),
    });
  }
  return { valley, centerline, segments, facilities, basinCodes, manualApplied };
}

/** 스키마 `segmentProps` 의 열 순서대로 — 파일 diff 가 읽히게. */
const PROPERTY_ORDER = [
  'id',
  'valleyId',
  'valleyName',
  'segment',
  'order',
  'splitBasis',
  'depth',
  'bed',
  'shadeByHour',
  'canopyCover',
  'shadeRatio',
  'accessDistanceM',
  'accessGradePct',
  'accessDifficulty',
  'swimBanned',
  'riskNote',
  'upstreamStationCode',
  'basinCode',
  'freeAccess',
  'campingAllowed',
  'petAllowed',
  'mapIconTier',
  'mapLabelTier',
  'mapImportance',
];

function orderProperties(properties: Json): Json {
  const out: Json = {};
  for (const key of PROPERTY_ORDER) if (properties[key] !== undefined) out[key] = properties[key];
  for (const [key, value] of Object.entries(properties)) if (!(key in out)) out[key] = value;
  return out;
}

function segmentMetadata(
  output: ValleyOutput,
  dates: { version: string; collectedAt: string },
): Json {
  const { valley, centerline } = output;
  const names = centerline.names.length === 0 ? '이름 없음' : centerline.names.join('·');
  const sources = [OSM_ATTRIBUTION, TERRARIUM_ATTRIBUTION];
  if (output.basinCodes.length > 0) sources.push(VWORLD_ATTRIBUTION);
  return {
    description: `${valley.name}(${valley.region}) — 구간 ${output.segments.length}개. OSM 하천 중심선(${names}, way ${centerline.wayIds.join('·')}) 을 계곡 점 기준 상류 ${UPSTREAM_M / 1000} km·하류 ${DOWNSTREAM_M / 1000} km 로 자른 ${centerline.lengthM} m. 데스크 검수 — 수심·바닥·금지·요금은 manual.csv 로 채운다.`,
    source:
      'OSM 하천 중심선(© OpenStreetMap contributors, ODbL) + 브이월드 표준유역 코드 + Terrarium 표고 · 데스크 검수(현장 미확인)',
    sourceFile: 'scripts/seed/build.mts (pnpm seed:build)',
    datasetVersion: dates.version,
    collectedAt: dates.collectedAt,
    coordinateOrder: '[longitude, latitude]',
    crs: 'EPSG:4326',
    filter: `계곡 점 (${valley.lng}, ${valley.lat}) [${valley.source}] · 중심선 오프셋 ${centerline.offsetM} m · 표고 ${centerline.elevation.start}→${centerline.elevation.end} m · 구간 분할 근거 ${output.segments.map((segment) => (segment['properties'] as Json)['splitBasis']).join(',')}`,
    verified: 'desk',
    sources,
  };
}

function facilityMetadata(
  output: ValleyOutput,
  dates: { version: string; collectedAt: string },
): Json {
  const { valley, facilities } = output;
  const count = (origin: FacilityRecord['origin']): number =>
    facilities.filter((facility) => facility.origin === origin).length;
  const sources = [OSM_ATTRIBUTION];
  if (count('std-parking') > 0) sources.push(STD_PARKING_ATTRIBUTION);
  if (count('std-restroom') > 0) sources.push(STD_RESTROOM_ATTRIBUTION);
  if (count('std-bin') > 0) sources.push(STD_BIN_ATTRIBUTION);
  if (count('std-park') > 0) sources.push(STD_PARK_ATTRIBUTION);
  if (count('std-playground') > 0) sources.push(STD_PLAYGROUND_ATTRIBUTION);
  const extras = count('std-bin') + count('std-park') + count('std-playground');
  return {
    description: `${valley.name} 시설 ${facilities.length}개 — 표준데이터 주차장 ${count('std-parking')} · 화장실 ${count('std-restroom')} · 쓰레기통·놀이터 ${extras} · OSM ${count('osm')} · 수기 ${count('manual')}. 계곡 점 반경 ${FACILITY_RADIUS_M / 1000} km, 쓰레기통·놀이터는 중심선 ${EXTRA_MAX_FROM_LINE_M} m.`,
    source:
      '전국주차장정보·공중화장실·휴지통·도시공원 표준데이터(공공누리 1유형) + 행안부 어린이놀이시설 API + OSM amenity·leisure(ODbL) + 수기 · 데스크 검수(현장 미확인)',
    sourceFile: 'scripts/seed/build.mts (pnpm seed:build)',
    datasetVersion: dates.version,
    collectedAt: dates.collectedAt,
    coordinateOrder: '[longitude, latitude]',
    crs: 'EPSG:4326',
    filter: `계곡 점 반경 ${FACILITY_RADIUS_M} m · 표준데이터 ↔ OSM 주차장 50 m 중복 제거`,
    verified: 'desk',
    sources,
  };
}

/**
 * 파일 내용이 이미 있는 것과(날짜 빼고) 같으면 옛 날짜를 유지해 재실행이 diff 를 만들지 않게 한다.
 */
function writeCollection(
  file: string,
  build: (dates: { version: string; collectedAt: string }) => Json,
): boolean {
  const today = todayKst();
  const existing = readExisting(file);
  const existingMeta = existing?.['metadata'] as Json | undefined;
  const previousDates =
    typeof existingMeta?.['datasetVersion'] === 'string' &&
    typeof existingMeta['collectedAt'] === 'string'
      ? { version: existingMeta['datasetVersion'], collectedAt: existingMeta['collectedAt'] }
      : undefined;
  if (previousDates !== undefined) {
    const unchanged = dumpsFile(build(previousDates));
    if (unchanged === fs.readFileSync(file, 'utf8')) return false;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, dumpsFile(build({ version: `${today}.0`, collectedAt: today })));
  return true;
}

function collectionOf(metadata: Json, features: readonly unknown[]): Json {
  return {
    $schema: '../.schema/valleys.schema.json',
    type: 'FeatureCollection',
    metadata,
    features,
  };
}

/** manual.csv 에 없는 (계곡, 구간, 항목) 조합을 빈 행으로 보충한다 — 사용자가 채울 템플릿. 기존 행은 건드리지 않는다. */
function refreshManualTemplate(outputs: readonly ValleyOutput[]): number {
  const { header, rows } = readCsv(MANUAL_PATH);
  const columns = header.length === 0 ? [...MANUAL_HEADER] : header;
  const present = new Set(
    rows.map((row) => `${row['valleyId']}|${row['segmentId']}|${row['field']}`),
  );
  const added: string[] = [];
  for (const output of outputs) {
    for (const segment of output.segments) {
      const props = segment['properties'] as Json;
      for (const field of MANUAL_FIELDS) {
        const key = `${output.valley.id}|${props['id']}|${field}`;
        if (present.has(key)) continue;
        present.add(key);
        added.push([output.valley.id, String(props['id']), field, '', '', '', ''].join(','));
      }
    }
  }
  if (added.length === 0 && header.length > 0) return 0;
  const existingLines = rows.map((row) =>
    columns.map((column) => csvCell(row[column] ?? '')).join(','),
  );
  fs.writeFileSync(MANUAL_PATH, `${[columns.join(','), ...existingLines, ...added].join('\n')}\n`);
  return added.length;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function report(
  outputs: readonly ValleyOutput[],
  missing: readonly SeedValley[],
  stdParkingTotal: number,
): string {
  const count = (output: ValleyOutput, origin: FacilityRecord['origin'], type?: string): number =>
    output.facilities.filter(
      (facility) =>
        facility.origin === origin && (type === undefined || facility.facilityType === type),
    ).length;
  const head =
    '| # | 계곡 | 구간 | OSM 하천 | 중심선 m | 오프셋 m | 표고 m | 유역(sbsncd) | 주차장 표준/OSM/수기 | 화장실 | 식음(식당·카페·매점) | 접근 m·경사% | 수기 적용 |\n' +
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |';
  const lines = outputs.map((output, index) => {
    const c = output.centerline;
    const first = output.segments[0]?.['properties'] as Json | undefined;
    const access =
      first?.['accessDistanceM'] === undefined
        ? '—'
        : `${first['accessDistanceM']} · ${first['accessGradePct']}`;
    const food = output.facilities.filter((facility) =>
      ['food', 'cafe', 'store'].includes(facility.facilityType),
    ).length;
    return `| ${index + 1} | ${output.valley.name} | ${output.segments.length} | ${c.names.join('·') || '이름 없음'} (way ${c.wayIds.length}) | ${c.lengthM} | ${c.offsetM} | ${c.elevation.start}→${c.elevation.end}${c.flipped ? ' ⚠뒤집음' : ''} | ${[...new Set(output.basinCodes)].join('·') || '—'} | ${count(output, 'std-parking')}/${count(output, 'osm', 'parking')}/${count(output, 'manual', 'parking')} | ${count(output, 'std-restroom') + count(output, 'osm', 'restroom') + count(output, 'manual', 'restroom')} | ${food} | ${access} | ${output.manualApplied} |`;
  });
  const totals = {
    parkingStd: outputs.reduce((sum, output) => sum + count(output, 'std-parking'), 0),
    parkingOsm: outputs.reduce((sum, output) => sum + count(output, 'osm', 'parking'), 0),
    withParking: outputs.filter((output) =>
      output.facilities.some((facility) => facility.facilityType === 'parking'),
    ).length,
    facilities: outputs.reduce((sum, output) => sum + output.facilities.length, 0),
    basins: outputs.filter((output) => output.basinCodes.length > 0).length,
  };
  return [
    `# 시딩 빌드 결과 — SD1a (${todayKst()})`,
    '',
    '`pnpm seed:build` 산출. 표준데이터 CSV 는 `data/seed/std/` 에 있을 때만 매칭된다(이번 실행: 주차장 표준데이터 행 ' +
      `${stdParkingTotal}개 로드).`,
    '',
    `계곡 ${outputs.length}개 생성 · 건너뜀 ${missing.length}개(${missing.map((valley) => valley.id).join(', ') || '없음'})`,
    `구간 ${outputs.reduce((sum, output) => sum + output.segments.length, 0)}개(전부 1구간 whole 인지 표에서 확인) · 시설 ${totals.facilities}개 · 주차장 있는 계곡 ${totals.withParking}/${outputs.length} (표준 ${totals.parkingStd} · OSM ${totals.parkingOsm}) · 유역 코드 있는 계곡 ${totals.basins}/${outputs.length}`,
    '',
    head,
    ...lines,
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const keys = loadKeys();
  if (keys.vworld === undefined) warn('.env.local 에 VWORLD_API_KEY 가 없어 유역 코드를 건너뛴다');
  const valleys = loadSeedValleys(options.only);

  if (options.onlyShade) {
    runShadeFor(valleys.map((valley) => valley.id));
    return;
  }

  const stdParkingRows = loadStdParking();
  const stdRestroomRows = loadStdRestrooms();
  const stdBinRows = loadStdBins();
  const stdPlaygroundRows = loadStdPlaygrounds();
  const stdParkPlaygroundRows = loadStdParkPlaygrounds();
  if (stdPlaygroundRows.length === 0)
    warn(
      'data/seed/std/ 에 놀이시설 CSV 가 없다 — `pnpm seed:playgrounds` (도시공원 유희시설·OSM 만 쓴다)',
    );
  if (stdParkingRows.length === 0) {
    warn(
      'data/seed/std/ 에 전국주차장정보표준데이터 CSV 가 없다 — 주차장은 OSM·수기만 (README 의 다운로드 안내)',
    );
  }
  const manualFacilities = loadManualFacilities();
  const manual = loadManual();
  const splits = loadSplits();
  const errors = [...manualFacilities.errors, ...manual.errors, ...splits.errors];
  if (errors.length > 0) {
    for (const error of errors) warn(error);
    throw new Error(`수기 CSV 오류 ${errors.length}건 — 고친 뒤 다시 실행`);
  }

  const outputs: ValleyOutput[] = [];
  const missing: SeedValley[] = [];
  for (const valley of valleys) {
    if (HAND_BUILT_CENTERLINE.has(valley.id)) {
      warn(
        `${valley.id}: 수기 중심선(SD3) — seed:build 가 덮어쓰지 않는다. 시설·봉우리는 별도 스크립트로`,
      );
      continue;
    }
    const center: Position = [valley.lng, valley.lat];
    const output = await buildValley(valley, {
      keys,
      stdParking: stdWithin(stdParkingRows, center, valley.id, 'parking'),
      stdRestrooms: stdWithin(stdRestroomRows, center, valley.id, 'restroom'),
      stdBins: stdBinRows,
      stdPlaygrounds: stdPlaygroundRows,
      stdParkPlaygrounds: stdParkPlaygroundRows,
      manualFacilities: manualFacilities.byValley.get(valley.id) ?? [],
      manual: manual.byValley.get(valley.id) ?? [],
      splits: splits.byValley.get(valley.id),
    });
    if (output === undefined) {
      missing.push(valley);
      continue;
    }
    outputs.push(output);
    const c = output.centerline;
    log(
      `${valley.id.padEnd(18)} 구간 ${output.segments.length} · 중심선 ${c.lengthM} m(오프셋 ${c.offsetM} m, ${c.names.join('·') || '이름 없음'}) · 유역 ${output.basinCodes[0] ?? '—'} · 시설 ${output.facilities.length}`,
    );
  }

  // 검증 — 쓰기 전에 30세트를 core 로더로 한 번에.
  const dates = { version: `${todayKst()}.0`, collectedAt: todayKst() };
  const bundle = {
    metadata: { ...segmentMetadata(outputs[0] as ValleyOutput, dates), description: '검증용' },
    collections: outputs.map((output) =>
      collectionOf(segmentMetadata(output, dates), output.segments),
    ),
  };
  const facilityBundle = {
    metadata: bundle.metadata,
    collections: outputs.map((output) =>
      collectionOf(
        facilityMetadata(output, dates),
        output.facilities.map((facility, index) =>
          toFacilityFeature(facility, facility.facilityType === 'parking' ? 5 : 20 + index),
        ),
      ),
    ),
  };
  const validated = loadValleyBundle(bundle, facilityBundle);
  if (!validated.ok) {
    throw new Error(
      `스키마 검증 실패: ${validated.error.message} (${JSON.stringify(validated.error.context)})`,
    );
  }

  let written = 0;
  for (const output of outputs) {
    const id = output.valley.id;
    if (
      writeCollection(path.join(VALLEYS_DIR, `${id}.geojson`), (d) =>
        collectionOf(segmentMetadata(output, d), output.segments),
      )
    )
      written += 1;
    if (
      writeCollection(path.join(FACILITIES_DIR, `${id}.geojson`), (d) =>
        collectionOf(
          facilityMetadata(output, d),
          output.facilities.map((facility, index) =>
            toFacilityFeature(facility, facility.facilityType === 'parking' ? 5 : 20 + index),
          ),
        ),
      )
    )
      written += 1;
  }
  const templateRows = refreshManualTemplate(outputs);
  fs.writeFileSync(
    path.join(SEED_DIR, 'build-report.md'),
    report(outputs, missing, stdParkingRows.length),
  );
  log('');
  log(
    `계곡 ${outputs.length}/${valleys.length} · 파일 ${written}개 갱신 · 검증 통과(${validated.value.valleys.length} 계곡, 구간 ${validated.value.valleys.reduce((sum, valley) => sum + valley.segments.length, 0)}) · manual.csv 템플릿 행 +${templateRows} (채워진 값 ${manual.filled})`,
  );
  if (missing.length > 0) warn(`건너뜀: ${missing.map((valley) => valley.id).join(', ')}`);
  log(`→ ${path.join(SEED_DIR, 'build-report.md')}`);

  if (options.shade) runShadeFor(outputs.map((output) => output.valley.id));
}

function runShadeFor(valleyIds: readonly string[]): void {
  if (!shadeEnvironmentReady()) {
    warn('scripts/shade/.venv 가 없다 — scripts/shade/README.md 의 설치 뒤 --shade 를 다시');
    return;
  }
  let ok = 0;
  for (const id of valleyIds) if (runShade(id)) ok += 1;
  log(`[shade] ${ok}/${valleyIds.length} 계곡 산출 → data/shade/`);
}

await main();
