/**
 * 정자·쉼터 보강 (사용자 요청 2026-09-08 "팔각정이나 정자 데이터도").
 *
 * 이미 만들어진 `data/facilities/<id>.geojson` 에 **정자만 덧붙인다.** `seed:build` 전체를 다시
 * 돌리지 않는 이유는 긴고랑계곡 때문이다 — 그 구간은 OSM 하천선이 아니라 DEM 최소비용경로로
 * 사람이 만든 기하(SD3)라, 전체 재빌드는 그것을 OSM 자동 결과로 덮어쓴다.
 *
 * 규칙은 `facilities.mts` 가 소유한다(`isShelterCandidate` · `SHELTER_MAX_FROM_LINE_M`) —
 * `seed:build` 도 같은 함수를 부르므로 나중에 전체 재빌드를 해도 결과가 같다.
 *
 *   pnpm seed:shelters                       # 31개 전부, 캐시 재사용
 *   pnpm seed:shelters --valley gingorang
 *   pnpm seed:shelters --dry                 # 파일을 쓰지 않고 표만
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadValleyBundle } from '@modu-valley/core';
import { FACILITIES_DIR, loadKeys, todayKst, VALLEYS_DIR } from './env.mts';
import {
  type FacilityRecord,
  SHELTER_MAX_FROM_LINE_M,
  shelterFacilities,
  toFacilityFeature,
} from './facilities.mts';
import { dumpsFile } from './format.mts';
import { distanceM, type Position } from './geo.mts';
import { log, warn } from './log.mts';
import { fetchShelters, OSM_ATTRIBUTION, type OsmPoi } from './overpass.mts';

/** Overpass 조회 반경(중심선 버퍼) — 뒤의 250 m 필터보다 조금 넉넉하게. */
const FETCH_RADIUS_M = 400;
/** 같은 것으로 보는 거리 — 이미 있는 시설과 이만큼 가까우면 넣지 않는다. */
const DEDUPE_M = 30;
/** 계곡 사이 간격(ms) — Overpass 는 연속 질의에 429 를 준다(실측 2026-09-08). */
const BETWEEN_VALLEYS_MS = 4000;
/** 429·504 재시도 대기(ms). 공용 `http.mts` 의 1.5~6 s 로는 부족했다. */
const RETRY_WAITS_MS = [20_000, 45_000, 90_000];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Overpass 는 붐빌 때 429·504 를 준다 — 길게 쉬고 다시 묻는다. */
async function fetchSheltersWithRetry(
  valleyId: string,
  line: readonly Position[],
  keys: ReturnType<typeof loadKeys>,
): Promise<readonly OsmPoi[]> {
  let lastError: unknown;
  for (const wait of [0, ...RETRY_WAITS_MS]) {
    if (wait > 0) {
      warn(`${valleyId}: Overpass 재시도 전 ${Math.round(wait / 1000)} s 대기`);
      await sleep(wait);
    }
    try {
      return await fetchShelters(valleyId, line, FETCH_RADIUS_M, keys);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

type Json = Record<string, unknown>;
type Feature = { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> };

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry');
const only = new Set(
  argv.flatMap((value, index) => (argv[index - 1] === '--valley' ? [value] : [])),
);

function readJson(file: string): Json {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Json;
}

/** 구간 좌표열을 이어 하나의 중심선으로 — 계곡은 구간 1~3개다. */
function centerlineOf(collection: Json): Position[] {
  const features = (collection['features'] as Feature[] | undefined) ?? [];
  const line: Position[] = [];
  for (const feature of features) {
    const coords = feature.geometry?.coordinates;
    if (!Array.isArray(coords)) continue;
    for (const point of coords as unknown[]) {
      if (Array.isArray(point) && point.length >= 2)
        line.push([Number(point[0]), Number(point[1])]);
    }
  }
  return line;
}

function existingRecords(collection: Json): { positions: Position[]; ids: Set<string> } {
  const features = (collection['features'] as Feature[] | undefined) ?? [];
  const positions: Position[] = [];
  const ids = new Set<string>();
  for (const feature of features) {
    const coords = feature.geometry?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      positions.push([Number(coords[0]), Number(coords[1])]);
    }
    const id = feature.properties?.['id'];
    if (typeof id === 'string') ids.add(id);
  }
  return { positions, ids };
}

/** `YYYY-MM-DD.N` 규약(스키마 검사)을 지키며 판을 올린다 — 같은 날이면 N+1, 아니면 오늘.0. */
function nextVersion(current: unknown): string {
  const today = todayKst();
  const match = typeof current === 'string' ? /^(\d{4}-\d{2}-\d{2})\.(\d+)$/.exec(current) : null;
  if (match !== null && match[1] === today) return `${today}.${Number(match[2]) + 1}`;
  return `${today}.0`;
}

async function main(): Promise<void> {
  const keys = loadKeys();
  const valleyFiles = fs
    .readdirSync(VALLEYS_DIR)
    .filter((name) => name.endsWith('.geojson'))
    .sort();

  const rows: string[] = [];
  let added = 0;

  for (const file of valleyFiles) {
    const valleyId = file.replace(/\.geojson$/, '');
    if (only.size > 0 && !only.has(valleyId)) continue;

    const valleyCollection = readJson(path.join(VALLEYS_DIR, file));
    const line = centerlineOf(valleyCollection);
    if (line.length < 2) {
      warn(`${valleyId}: 구간 좌표를 읽지 못했다 — 건너뛴다`);
      continue;
    }
    const pois = await fetchSheltersWithRetry(valleyId, line, keys);
    const candidates = shelterFacilities(pois, line, valleyId);

    const facilityFile = path.join(FACILITIES_DIR, `${valleyId}.geojson`);
    if (!fs.existsSync(facilityFile)) {
      warn(`${valleyId}: 시설 파일이 없다 — 건너뛴다`);
      continue;
    }
    const collection = readJson(facilityFile);
    const { positions, ids } = existingRecords(collection);

    const fresh: FacilityRecord[] = [];
    for (const record of candidates) {
      if (ids.has(record.id)) continue;
      if (positions.some((p) => distanceM(p, record.position) <= DEDUPE_M)) continue;
      if (fresh.some((kept) => distanceM(kept.position, record.position) <= DEDUPE_M)) continue;
      fresh.push(record);
    }

    await sleep(BETWEEN_VALLEYS_MS);
    rows.push(
      `| ${valleyId} | ${pois.length} | ${candidates.length} | ${fresh.length} | ${fresh
        .map((record) => record.name)
        .join(', ')} |`,
    );
    added += fresh.length;
    if (fresh.length === 0 || dryRun) continue;

    const features = (collection['features'] as unknown[] | undefined) ?? [];
    const merged = [...features, ...fresh.map((record) => toFacilityFeature(record, 0.4))];
    const metadata = { ...((collection['metadata'] as Json | undefined) ?? {}) };
    metadata['datasetVersion'] = nextVersion(metadata['datasetVersion']);
    metadata['description'] =
      `${String(metadata['description'] ?? '')} 정자·쉼터 ${fresh.length}곳 추가(OSM shelter/pavilion, 중심선 ${SHELTER_MAX_FROM_LINE_M} m 안).`.trim();
    const sources = new Set([
      ...((metadata['sources'] as string[] | undefined) ?? []),
      OSM_ATTRIBUTION,
    ]);
    metadata['sources'] = [...sources];
    collection['metadata'] = metadata;
    collection['features'] = merged;
    fs.writeFileSync(facilityFile, dumpsFile(collection));
  }

  log('');
  log('| 계곡 | OSM 후보 | 규칙 통과 | 새로 추가 | 이름 |');
  log('| --- | --- | --- | --- | --- |');
  for (const row of rows) log(row);
  log('');
  log(`${dryRun ? '[dry] ' : ''}정자 ${added}곳`);

  if (!dryRun && added > 0) {
    // 검증 — 쓴 뒤 31세트를 core 로더로 한 번에(빌드와 같은 관문).
    const files = fs
      .readdirSync(VALLEYS_DIR)
      .filter((name) => name.endsWith('.geojson'))
      .sort();
    const collections = files.map((name) => readJson(path.join(VALLEYS_DIR, name)));
    const facilityCollections = files.map((name) => {
      const file = path.join(FACILITIES_DIR, name);
      return fs.existsSync(file)
        ? readJson(file)
        : ({ type: 'FeatureCollection', features: [] } as Json);
    });
    const head = collections[0] as Json;
    const bundle = { metadata: head['metadata'], collections };
    const facilityBundle = { metadata: head['metadata'], collections: facilityCollections };
    const validated = loadValleyBundle(bundle, facilityBundle);
    if (!validated.ok) {
      warn(`검증 실패: ${validated.error.message}`);
      process.exitCode = 1;
      return;
    }
    log(`검증 통과 — 계곡 ${validated.value.valleys.length}개`);
  }
}

await main();
