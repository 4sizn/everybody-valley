/**
 * 저장소 루트 `data/valleys/*.geojson`·`data/facilities/*.geojson` 을 합본 두 장(+ `data/peaks/` 봉우리 합본)
 * `assets/valley/valleys-bundle.json`·`facilities-bundle.json` 으로 만들고,
 * `data/shade/**` 를 `shade-bundle.json` 한 장으로 합친다 (SD1 (f) · F4).
 *
 * 왜 필요한가
 *   계곡 데이터의 진실은 루트 `data/`(스키마 `data/.schema/valleys.schema.json`)다.
 *   앱이 그 파일을 import 하려면 Metro 가 읽어야 하는데, Metro 는 `.geojson`
 *   확장자를 모른다. `sourceExts` 에 넣으면 JS 로 파싱하려 들고(JSON 특수 처리는
 *   `.json` 에만 걸린다), `assetExts` 에 넣으면 URI 로만 온다. 또 Metro 는 정적
 *   `import` 만 받으므로 계곡 30개를 파일마다 import 할 수 없다 — 합본 한 장으로 옮긴다.
 *
 * 합본 모양 (core `loadValleyBundle` 이 읽는다)
 *   { metadata: <데이터셋 머리말>, collections: [ <계곡별 FeatureCollection> … ] }
 *   컬렉션 순서 = `data/seed/valleys.json` 의 계곡 순서(없는 것은 뒤에 id 순).
 *   머리말은 컬렉션들의 metadata 에서 합성한다(설명·출처 합집합·최신 datasetVersion).
 *
 * 시딩 전 체크아웃(`data/valleys/` 가 비어 있음)에서는 `data/examples/` 의 샘플을 대신
 * 합본한다 — 앱이 항상 뜨고, 샘플은 테스트 픽스처로만 남는다.
 *
 * 왜 커밋하지 않는가
 *   두 사본이 어긋나면 "지도는 새 데이터, 카드는 옛 데이터"가 된다. 실행 전마다
 *   만들어 진실을 하나로 유지한다(`assets/valley/` 는 gitignore).
 *   `sync-maplibre-worker.mjs` 와 같은 규칙이다.
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

const SOURCE_DIR = join(import.meta.dirname, '..', '..', '..', 'data');
const TARGET_DIR = join(import.meta.dirname, '..', 'assets', 'valley');
const VALLEYS_DIR = join(SOURCE_DIR, 'valleys');
const FACILITIES_DIR = join(SOURCE_DIR, 'facilities');
const EXAMPLES_DIR = join(SOURCE_DIR, 'examples');
/** 계곡 30개의 정본 목록(SD1 (a)) — 합본의 계곡 순서. */
const VALLEY_LIST = join(SOURCE_DIR, 'seed', 'valleys.json');
const VALLEYS_BUNDLE = join(TARGET_DIR, 'valleys-bundle.json');
const FACILITIES_BUNDLE = join(TARGET_DIR, 'facilities-bundle.json');
/** 봉우리(OSM natural=peak, `pnpm seed:peaks`) — `data/peaks/<valleyId>.geojson`. 없으면 빈 합본. */
const PEAKS_DIR = join(SOURCE_DIR, 'peaks');
const PEAKS_BUNDLE = join(TARGET_DIR, 'peaks-bundle.json');
/** 그늘 레이어(scripts/shade 산출) — `data/shade/<valleyId>/*.geojson` + `index.json`. F4 지도 레이어 입력. */
const SHADE_SOURCE_DIR = join(SOURCE_DIR, 'shade');
/** 합본 한 파일. 개별 사본(`assets/valley/shade/**`)은 두지 않는다 — 사본이 둘이면 어긋난다. */
const SHADE_BUNDLE = join(TARGET_DIR, 'shade-bundle.json');
/** 이전 방식(개별 복사·개별 사본)의 잔재. 남아 있으면 지운다. */
const LEGACY_SHADE_TARGET_DIR = join(TARGET_DIR, 'shade');
const LEGACY_FILES = ['example-valley.json', 'example-facilities.json'];
/** `shadow-<HH>.geojson` 의 시각 — `scripts/shade/settings.py` `HOURS`, core `SHADE_HOURS` 와 같은 축. */
const SHADE_HOURS = ['10', '11', '12', '13', '14', '15', '16', '17', '18'];

async function geojsonFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && extname(entry.name) === '.geojson')
    .map((entry) => entry.name)
    .sort();
}

async function readCollection(path) {
  // 깨진 JSON 은 여기서 멈춘다 — 번들 시점의 알 수 없는 파싱 오류보다 낫다.
  return JSON.parse(await readFile(path, 'utf8'));
}

/** `data/seed/valleys.json` 의 id 순서. 없으면 빈 배열(파일명 순으로 간다). */
async function valleyOrder() {
  try {
    const list = JSON.parse(await readFile(VALLEY_LIST, 'utf8'));
    return (list.valleys ?? []).map((valley) => valley.id);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

function sortByOrder(files, order) {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...files].sort((a, b) => {
    const ra = rank.get(basename(a, '.geojson')) ?? Number.POSITIVE_INFINITY;
    const rb = rank.get(basename(b, '.geojson')) ?? Number.POSITIVE_INFINITY;
    return ra === rb ? a.localeCompare(b) : ra - rb;
  });
}

/**
 * 컬렉션들의 머리말 → 데이터셋 머리말. 스키마 `$defs.metadata` 의 required 를 채운다.
 * 설명은 계곡 수·검수 수준 집계, 출처는 합집합, 버전·수집일은 가장 최근 것.
 */
function synthesizeMetadata(collections, kind) {
  const metas = collections.map((collection) => collection.metadata ?? {});
  const uniq = (values) => [...new Set(values.filter(Boolean))];
  const valleyIds = uniq(
    collections.flatMap((collection) =>
      (collection.features ?? []).map((feature) => feature.properties?.valleyId),
    ),
  );
  const features = collections.reduce(
    (sum, collection) => sum + (collection.features ?? []).length,
    0,
  );
  const desk = metas.filter((meta) => meta.verified === 'desk').length;
  const field = metas.filter((meta) => meta.verified === 'field').length;
  const verification = desk + field === 0 ? '' : ` · 현장 미확인 ${desk} · 현장 확인 ${field}`;
  const unit = kind === 'valleys' ? '구간' : '시설';
  const latest = (key) =>
    metas
      .map((meta) => meta[key])
      .filter(Boolean)
      .sort()
      .at(-1);
  return {
    description: `계곡 ${valleyIds.length}개 · ${unit} ${features}개${verification}`,
    source: uniq(metas.map((meta) => meta.source)).join(' · ') || '출처 없음',
    sourceFile: `data/${kind}/*.geojson (sync-valley-data.mjs 합본)`,
    datasetVersion: latest('datasetVersion') ?? '1970-01-01.0',
    collectedAt: latest('collectedAt') ?? '1970-01-01',
    coordinateOrder: '[longitude, latitude]',
    crs: 'EPSG:4326',
    filter: `data/${kind}/ 의 계곡별 파일 ${collections.length}장`,
    sources: uniq(metas.flatMap((meta) => meta.sources ?? [])),
  };
}

async function bundleCollections(dir, kind, order) {
  const files = sortByOrder(await geojsonFiles(dir), order);
  const collections = [];
  for (const file of files) collections.push(await readCollection(join(dir, file)));
  return { files, bundle: { metadata: synthesizeMetadata(collections, kind), collections } };
}

/** 시딩 전 체크아웃 — 샘플을 대신 합본한다. */
async function bundleExamples() {
  const files = await geojsonFiles(EXAMPLES_DIR);
  const valleyFiles = files.filter((file) => file.includes('valley'));
  const facilityFiles = files.filter((file) => file.includes('facilities'));
  const read = (names) =>
    Promise.all(names.map((name) => readCollection(join(EXAMPLES_DIR, name))));
  const valleys = await read(valleyFiles);
  const facilities = await read(facilityFiles);
  return {
    files: files.map((file) => `examples/${file}`),
    valleys: { metadata: synthesizeMetadata(valleys, 'valleys'), collections: valleys },
    facilities: { metadata: synthesizeMetadata(facilities, 'facilities'), collections: facilities },
  };
}

/**
 * `data/shade/**` 를 **한 파일**로 합친다 (F4).
 *
 *   assets/valley/shade-bundle.json =
 *     { index, valleys: { <valleyId>: { canopy, shadow: { "10": …, "18": … } } } }
 *
 * 그늘 산출물이 없는 체크아웃(`data/shade/index.json` 없음)에서도 앱은 살아야 하고 import 는
 * 항상 성립해야 하므로, 그때는 빈 합본 `{ index: null, valleys: {} }` 을 쓴다 — 로더는 빈 맵을
 * 만들고 그늘 토글은 지도에 아무것도 얹지 않는다.
 */
async function bundleShade() {
  await rm(LEGACY_SHADE_TARGET_DIR, { recursive: true, force: true });

  let index;
  try {
    index = JSON.parse(await readFile(join(SHADE_SOURCE_DIR, 'index.json'), 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    await writeFile(SHADE_BUNDLE, JSON.stringify({ index: null, valleys: {} }), 'utf8');
    return { valleys: [], bytes: 0 };
  }

  const valleys = {};
  for (const valleyId of Object.keys(index.valleys ?? {}).sort()) {
    const dir = join(SHADE_SOURCE_DIR, valleyId);
    const shadow = {};
    for (const hour of SHADE_HOURS) {
      // 비어 있어도 파일은 있어야 한다(scripts/shade 출력 규약). 없으면 여기서 멈춘다.
      shadow[hour] = JSON.parse(await readFile(join(dir, `shadow-${hour}.geojson`), 'utf8'));
    }
    valleys[valleyId] = {
      canopy: JSON.parse(await readFile(join(dir, 'canopy.geojson'), 'utf8')),
      shadow,
    };
  }
  const bundle = JSON.stringify({ index, valleys });
  await writeFile(SHADE_BUNDLE, bundle, 'utf8');
  return { valleys: Object.keys(valleys), bytes: Buffer.byteLength(bundle, 'utf8') };
}

await mkdir(TARGET_DIR, { recursive: true });
for (const legacy of LEGACY_FILES) await rm(join(TARGET_DIR, legacy), { force: true });

const order = await valleyOrder();
let valleys = await bundleCollections(VALLEYS_DIR, 'valleys', order);
let facilities = await bundleCollections(FACILITIES_DIR, 'facilities', order);
let sourceFiles = [
  ...valleys.files.map((file) => `valleys/${file}`),
  ...facilities.files.map((file) => `facilities/${file}`),
];
let mode = 'seed';
if (valleys.files.length === 0) {
  const examples = await bundleExamples();
  if (examples.valleys.collections.length === 0) {
    throw new Error(`${VALLEYS_DIR} 도 ${EXAMPLES_DIR} 도 .geojson 파일이 없습니다.`);
  }
  valleys = { files: examples.files, bundle: examples.valleys };
  facilities = { files: [], bundle: examples.facilities };
  sourceFiles = examples.files;
  mode = 'examples';
}

const valleysJson = JSON.stringify(valleys.bundle);
const facilitiesJson = JSON.stringify(facilities.bundle);
await writeFile(VALLEYS_BUNDLE, valleysJson, 'utf8');
await writeFile(FACILITIES_BUNDLE, facilitiesJson, 'utf8');

const peakFiles = sortByOrder(await geojsonFiles(PEAKS_DIR), order);
const peakCollections = [];
for (const file of peakFiles) peakCollections.push(await readCollection(join(PEAKS_DIR, file)));
const peaksJson = JSON.stringify({ collections: peakCollections });
await writeFile(PEAKS_BUNDLE, peaksJson, 'utf8');
const peaksLine = `peaks-bundle.json (컬렉션 ${peakCollections.length}장 · ${Buffer.byteLength(peaksJson, 'utf8')} bytes)`;

const shade = await bundleShade();
const shadeLine = `shade-bundle.json (계곡 ${shade.valleys.length}개: ${shade.valleys.join(', ') || '없음'} · ${shade.bytes} bytes)`;
const valleysLine = `valleys-bundle.json (컬렉션 ${valleys.bundle.collections.length}장 · ${Buffer.byteLength(valleysJson, 'utf8')} bytes · ${mode})`;
const facilitiesLine = `facilities-bundle.json (컬렉션 ${facilities.bundle.collections.length}장 · ${Buffer.byteLength(facilitiesJson, 'utf8')} bytes)`;

await writeFile(
  join(TARGET_DIR, 'SOURCE'),
  `data/valleys·facilities 합본 · data/shade/** 합본 (scripts/sync-valley-data.mjs) — 직접 고치지 말 것\n${[...sourceFiles, ...peakFiles.map((file) => `peaks/${file}`), valleysLine, facilitiesLine, peaksLine, shadeLine].join('\n')}\n`,
  'utf8',
);

process.stdout.write(
  `계곡 합본을 assets/valley 로 썼습니다: ${valleysLine} · ${facilitiesLine} · ${peaksLine}\n`,
);
if (mode === 'examples') {
  process.stdout.write(
    'data/valleys 가 비어 있어 data/examples 샘플을 합본했습니다 (pnpm seed:build 로 시딩).\n',
  );
}
process.stdout.write(
  shade.valleys.length > 0
    ? `그늘 합본 ${shadeLine} 을 썼습니다.\n`
    : 'data/shade 가 없어 빈 그늘 합본을 썼습니다 (pnpm shade:build 로 산출).\n',
);
