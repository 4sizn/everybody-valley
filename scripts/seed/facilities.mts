/**
 * 시설 (결정 (e)) — 주차장 · 화장실 · 식당/카페/매점 · 진입로.
 *
 *   ① 표준데이터 CSV(사용자 다운로드, `data/seed/std/`): 전국주차장정보표준데이터(좌표·유무료·구획수),
 *      전국공중화장실표준데이터(2025-02 이후 좌표 제공 중단 — 좌표 열이 있는 옛 파일만 쓸 수 있다).
 *      계곡 점 반경 1.5 km 로 매칭. data.go.kr 다운로드는 로그인 세션이 필요해 스크립트가 받지 못한다(README).
 *   ② OSM `amenity`(parking·toilets·restaurant·cafe·fast_food) · `shop`(convenience·supermarket·kiosk) 보강 —
 *      표준데이터 주차장과 50 m 안이면 중복으로 보고 표준데이터를 남긴다.
 *   ③ 수기 `data/seed/facilities-manual.csv`(진입로 등).
 *
 * 시설 id: `<valleyId>-std-p-<관리번호>` · `<valleyId>-osm-<type>-<osmId>` · 수기는 CSV 의 id.
 */
import fs from 'node:fs';
import path from 'node:path';
import { type CsvRow, findColumn, readCsv } from './csv.mts';
import { SEED_DIR, STD_DIR } from './env.mts';
import { distanceM, type Position, projectOnLine, round6 } from './geo.mts';
import type { OsmPoi } from './overpass.mts';

export const FACILITY_RADIUS_M = 3000;
/** 표준데이터 주차장과 OSM 주차장을 같은 것으로 보는 거리(m). */
const DEDUPE_M = 50;

export type FacilityType =
  | 'parking'
  | 'restroom'
  | 'food'
  | 'cafe'
  | 'store'
  | 'shelter'
  | 'bin'
  | 'playground'
  | 'station'
  | 'access'
  | 'safety'
  | 'etc';

export interface FacilityRecord {
  readonly id: string;
  readonly valleyId: string;
  readonly name: string;
  readonly facilityType: FacilityType;
  readonly position: Position;
  readonly capacity?: number;
  readonly feeNote?: string;
  readonly operatingHours?: string;
  /** 어디서 왔나 — metadata.sources 와 매칭 결과표의 재료. */
  readonly origin:
    | 'std-parking'
    | 'std-restroom'
    | 'std-bin'
    | 'std-park'
    | 'std-playground'
    | 'osm'
    | 'manual';
}

const TYPE_DEFAULT_NAME: Readonly<Record<FacilityType, string>> = {
  parking: '주차장',
  restroom: '화장실',
  food: '식당',
  cafe: '카페',
  store: '매점',
  shelter: '정자',
  bin: '쓰레기통',
  playground: '놀이터',
  station: '역·정류장',
  access: '진입로',
  safety: '안전시설',
  etc: '기타',
};

// ── 표준데이터 ─────────────────────────────────────────────────────────

export interface StdParkingRow {
  readonly key: string;
  readonly name: string;
  readonly position: Position;
  readonly capacity: number | undefined;
  readonly feeNote: string | undefined;
  readonly operatingHours: string | undefined;
}

function csvFilesIn(dir: string, needle: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.csv') && name.includes(needle))
    .map((name) => path.join(dir, name));
}

function number(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** 전국주차장정보표준데이터 전체 행(좌표 있는 것만). 파일이 없으면 빈 배열. */
export function loadStdParking(): readonly StdParkingRow[] {
  const out: StdParkingRow[] = [];
  for (const file of csvFilesIn(STD_DIR, '주차장')) {
    const { header, rows } = readCsv(file);
    const nameColumn = findColumn(header, '주차장명');
    const latColumn = findColumn(header, '위도');
    const lngColumn = findColumn(header, '경도');
    const keyColumn = findColumn(header, '주차장관리번호');
    const capacityColumn = findColumn(header, '주차구획수');
    const feeColumn = findColumn(header, '요금정보');
    const openColumn = findColumn(header, '평일운영시작시각');
    const closeColumn = findColumn(header, '평일운영종료시각');
    if (nameColumn === undefined || latColumn === undefined || lngColumn === undefined) continue;
    rows.forEach((row, index) => {
      const lat = number(row[latColumn]);
      const lng = number(row[lngColumn]);
      if (lat === undefined || lng === undefined || lat === 0 || lng === 0) return;
      const open = openColumn === undefined ? '' : (row[openColumn] ?? '');
      const close = closeColumn === undefined ? '' : (row[closeColumn] ?? '');
      out.push({
        key: (keyColumn === undefined ? '' : row[keyColumn]) || String(index),
        name: row[nameColumn] ?? '',
        position: [lng, lat],
        capacity: capacityColumn === undefined ? undefined : number(row[capacityColumn]),
        feeNote: feeColumn === undefined ? undefined : row[feeColumn] || undefined,
        operatingHours: open && close ? `${open}~${close}` : undefined,
      });
    });
  }
  return out;
}

/** 전국공중화장실표준데이터 — 위도·경도 열이 있는 파일만(2025-02 이후 배포본에는 없다). */
export function loadStdRestrooms(): readonly StdParkingRow[] {
  const out: StdParkingRow[] = [];
  for (const file of csvFilesIn(STD_DIR, '화장실')) {
    const { header, rows } = readCsv(file);
    const nameColumn = findColumn(header, '화장실명');
    const latColumn = findColumn(header, '위도');
    const lngColumn = findColumn(header, '경도');
    const openColumn = findColumn(header, '개방시간');
    if (nameColumn === undefined || latColumn === undefined || lngColumn === undefined) continue;
    rows.forEach((row, index) => {
      const lat = number(row[latColumn]);
      const lng = number(row[lngColumn]);
      if (lat === undefined || lng === undefined || lat === 0 || lng === 0) return;
      out.push({
        key: String(index),
        name: row[nameColumn] ?? '',
        position: [lng, lat],
        capacity: undefined,
        feeNote: undefined,
        operatingHours: openColumn === undefined ? undefined : row[openColumn] || undefined,
      });
    });
  }
  return out;
}

/**
 * 쓰레기통·놀이터 표준데이터(2026-09-23). 셋 다 `StdParkingRow` 모양으로 읽어 `stdNearLine` 에 넘긴다.
 *
 *   전국휴지통표준데이터(15129450)        설치장소명·위도·경도·휴지통종류 — 35개 지자체만 제공
 *   전국도시공원정보표준데이터(15012890)  공원보유시설(유희시설) 이 비어 있지 않은 공원 = 놀이터 있는 공원
 *   전국어린이놀이시설정보(API 15124519)  `pnpm seed:playgrounds` 가 CSV 로 내려놓은 것 — 운영 중·실외만
 */
export function loadStdBins(): readonly StdParkingRow[] {
  return loadStdPoints('휴지통', '설치장소명', (row, header) => {
    const kind = findColumn(header, '휴지통종류');
    const recycling = kind !== undefined && /재활용/.test(row[kind] ?? '');
    return { suffix: recycling ? ' (재활용)' : '' };
  });
}

export function loadStdParkPlaygrounds(): readonly StdParkingRow[] {
  return loadStdPoints('도시공원', '공원명', (row, header) => {
    const play = findColumn(header, '공원보유시설(유희시설)');
    const equipment = play === undefined ? '' : (row[play] ?? '').trim();
    return equipment === '' ? undefined : { suffix: ' 놀이터' };
  });
}

export function loadStdPlaygrounds(): readonly StdParkingRow[] {
  return loadStdPoints('놀이시설', '놀이시설명', (row, header) => {
    const operating = findColumn(header, '운영여부');
    const indoor = findColumn(header, '실내외');
    const place = findColumn(header, '설치장소유형');
    if (operating !== undefined && row[operating] !== '운영') return undefined;
    if (indoor !== undefined && row[indoor] === '실내') return undefined;
    // 주택단지 놀이터는 단지 주민용이라 계곡 이용자 시설이 아니다 — 공원·야영장·유원지 등만.
    if (place !== undefined && row[place] === '주택단지') return undefined;
    return { suffix: '' };
  });
}

/**
 * 위도·경도 열이 있는 `*needle*.csv` 를 점으로 읽는다. `pick` 이 `undefined` 를 주면 그 행은 버리고,
 * `suffix` 는 이름 뒤에 붙인다(요금·운영시간 칸은 비운다 — 쓰레기통 종류를 요금 칸에 넣으면 화면에 "이용 요금" 으로 뜬다).
 */
function loadStdPoints(
  needle: string,
  nameHeader: string,
  pick: (row: CsvRow, header: string[]) => { suffix: string } | undefined,
): readonly StdParkingRow[] {
  const out: StdParkingRow[] = [];
  for (const file of csvFilesIn(STD_DIR, needle)) {
    const { header, rows } = readCsv(file);
    const nameColumn = findColumn(header, nameHeader);
    const latColumn = findColumn(header, '위도');
    const lngColumn = findColumn(header, '경도');
    if (nameColumn === undefined || latColumn === undefined || lngColumn === undefined) continue;
    rows.forEach((row, index) => {
      const lat = number(row[latColumn]);
      const lng = number(row[lngColumn]);
      if (lat === undefined || lng === undefined || lat === 0 || lng === 0) return;
      const picked = pick(row, header);
      if (picked === undefined) return;
      const name = (row[nameColumn] ?? '').trim();
      out.push({
        key: String(index),
        name: name === '' ? '' : `${name}${picked.suffix}`,
        position: [lng, lat],
        capacity: undefined,
        feeNote: undefined,
        operatingHours: undefined,
      });
    });
  }
  return out;
}

/**
 * 쓰레기통·놀이터가 "이 계곡의 것"인 최대 거리 — **구간 중심선**에서(m). 주차장처럼 멀리 대고 걸어오는
 * 시설이 아니라 곁에 있어야 뜻이 있는데, 물가 300 m 안엔 거의 없어(2026-09-23 실측: 33곳 중 0곳)
 * 걸어갈 만한 거리까지는 "가는 길에" 로 보여 준다. 긴고랑 하류 주택가 가로쓰레기통 156개(1.4 km~)는
 * 이 값에서 걸러진다.
 */
export const EXTRA_MAX_FROM_LINE_M = 1200;

/** 표준데이터 점 → 쓰레기통·놀이터 시설. 중심선에서 `EXTRA_MAX_FROM_LINE_M` 안만. */
export function stdNearLine(
  rows: readonly StdParkingRow[],
  line: readonly Position[],
  valleyId: string,
  type: 'bin' | 'playground',
  origin: 'std-bin' | 'std-park' | 'std-playground',
): FacilityRecord[] {
  const prefix = origin === 'std-playground' ? 'std-pg' : origin;
  return rows
    .filter((row) => projectOnLine(line, row.position).distance <= EXTRA_MAX_FROM_LINE_M)
    .map((row) => ({
      id: `${valleyId}-${prefix}-${row.key.replace(/[^A-Za-z0-9_-]/g, '')}`,
      valleyId,
      name: row.name || TYPE_DEFAULT_NAME[type],
      facilityType: type,
      position: [round6(row.position[0]), round6(row.position[1])],
      origin,
    }));
}

export function stdWithin(
  rows: readonly StdParkingRow[],
  center: Position,
  valleyId: string,
  type: 'parking' | 'restroom',
): FacilityRecord[] {
  const prefix = type === 'parking' ? 'std-p' : 'std-r';
  return rows
    .filter((row) => distanceM(row.position, center) <= FACILITY_RADIUS_M)
    .map((row) => ({
      id: `${valleyId}-${prefix}-${row.key.replace(/[^A-Za-z0-9_-]/g, '')}`,
      valleyId,
      name: row.name || TYPE_DEFAULT_NAME[type],
      facilityType: type,
      position: [round6(row.position[0]), round6(row.position[1])],
      ...(row.capacity === undefined ? {} : { capacity: Math.round(row.capacity) }),
      ...(row.feeNote === undefined ? {} : { feeNote: row.feeNote }),
      ...(row.operatingHours === undefined ? {} : { operatingHours: row.operatingHours }),
      origin: type === 'parking' ? 'std-parking' : 'std-restroom',
    }));
}

// ── OSM ─────────────────────────────────────────────────────────────

function osmType(tags: Readonly<Record<string, string>>): FacilityType | undefined {
  switch (tags['amenity']) {
    case 'parking':
      return 'parking';
    case 'toilets':
      return 'restroom';
    case 'restaurant':
    case 'fast_food':
    case 'food_court':
      return 'food';
    case 'cafe':
      return 'cafe';
    default:
      break;
  }
  switch (tags['shop']) {
    case 'convenience':
    case 'supermarket':
    case 'kiosk':
    case 'general':
      return 'store';
    default:
      return undefined;
  }
}

function osmFee(tags: Readonly<Record<string, string>>): string | undefined {
  const fee = tags['fee'];
  if (fee === 'no') return '무료';
  if (fee === 'yes') return tags['charge'] === undefined ? '유료' : `유료 ${tags['charge']}`;
  return undefined;
}

export function osmFacilities(
  pois: readonly OsmPoi[],
  center: Position,
  valleyId: string,
): FacilityRecord[] {
  const out: FacilityRecord[] = [];
  for (const poi of pois) {
    const type = osmType(poi.tags);
    if (type === undefined) continue;
    if (distanceM(poi.position, center) > FACILITY_RADIUS_M) continue;
    const capacity = number(poi.tags['capacity']);
    const fee = osmFee(poi.tags);
    const hours = poi.tags['opening_hours'];
    out.push({
      id: `${valleyId}-osm-${type}-${poi.id}`,
      valleyId,
      name: poi.tags['name'] ?? TYPE_DEFAULT_NAME[type],
      facilityType: type,
      position: [round6(poi.position[0]), round6(poi.position[1])],
      ...(capacity === undefined ? {} : { capacity: Math.round(capacity) }),
      ...(fee === undefined ? {} : { feeNote: fee }),
      ...(hours === undefined ? {} : { operatingHours: hours }),
      origin: 'osm',
    });
  }
  return out;
}

// ── 쓰레기통·놀이터 OSM (2026-09-23) ──────────────────────────────────

function extraType(tags: Readonly<Record<string, string>>): 'bin' | 'playground' | undefined {
  if (tags['leisure'] === 'playground') return 'playground';
  switch (tags['amenity']) {
    case 'waste_basket':
    case 'waste_disposal':
    case 'recycling':
      return 'bin';
    default:
      return undefined;
  }
}

/** OSM `leisure=playground`·`amenity=waste_*|recycling` → 시설. 중심선에서 `EXTRA_MAX_FROM_LINE_M` 안만. */
export function extraFacilities(
  pois: readonly OsmPoi[],
  line: readonly Position[],
  valleyId: string,
): FacilityRecord[] {
  const out: FacilityRecord[] = [];
  for (const poi of pois) {
    const type = extraType(poi.tags);
    if (type === undefined) continue;
    if (projectOnLine(line, poi.position).distance > EXTRA_MAX_FROM_LINE_M) continue;
    const fallback =
      poi.tags['amenity'] === 'recycling' ? '재활용 수거함' : TYPE_DEFAULT_NAME[type];
    out.push({
      id: `${valleyId}-osm-${type}-${poi.id}`,
      valleyId,
      name: poi.tags['name'] ?? fallback,
      facilityType: type,
      position: [round6(poi.position[0]), round6(poi.position[1])],
      origin: 'osm',
    });
  }
  return out;
}

// ── 정자·쉼터 (2026-09-08) ───────────────────────────────────────────

/**
 * 계곡에서 **얼마나 가까워야 "이 계곡의 정자"인가** — 구간 중심선까지의 거리(m).
 *
 * 다른 시설(주차장·화장실)은 계곡 점 반경 1.5 km 인데, 정자는 그렇게 넓히면 안 된다. 주차장은
 * 멀어도 "거기 대고 걸어 들어온다" 가 성립하지만 정자는 **물가에 앉는 자리**라 계곡을 벗어나면
 * 남의 동네 공원 정자다(사용자 결정 2026-09-08 "계곡 주변값만"). 중심선 기준 250 m 는 실측에서
 * 능선·주택가 정자를 걸러내면서 계곡 길가 정자는 남기는 값이었다.
 */
export const SHELTER_MAX_FROM_LINE_M = 250;

/** 정자로 인정하는 `shelter_type`. gazebo 가 한국의 정자, picnic_shelter 는 원두막·평상 지붕. */
const SHELTER_TYPES_OK = new Set(['gazebo', 'picnic_shelter', 'pavilion']);
/** 정자가 아닌 것 — 캠핑장 그늘막·텐트, 산악 대피소, 버스 승강장, 바위 밑. */
const SHELTER_TYPES_REJECT = new Set([
  'tent',
  'basic_hut',
  'public_transport',
  'rock_shelter',
  'lean_to',
  'field_shelter',
  'weather_shelter',
]);
/** 유형 태그가 없을 때 이름으로 건지는 규칙 — 정자 계열 한글 이름. */
const SHELTER_NAME_OK = /정자|팔각정|육각정|원두막|쉼터|[가-힣]{1,4}정$/u;

/**
 * 후보를 정자로 받을지 판정한다.
 *
 * 태그가 명확하면 태그로, 유형 태그가 없으면 **이름**으로만 받는다 — 유형 없는 후보(실측 82/344)
 * 에는 캠핑장 구조물이 섞여 있어 이름이 없으면 무엇인지 알 수 없다(사용자 결정 "거르는 게 맞음").
 */
export function isShelterCandidate(tags: Readonly<Record<string, string>>): boolean {
  const type = tags['shelter_type'];
  if (type !== undefined && SHELTER_TYPES_REJECT.has(type)) return false;
  if (type !== undefined && SHELTER_TYPES_OK.has(type)) return true;
  if (tags['building'] === 'pavilion') return true;
  const name = tags['name'];
  return name !== undefined && SHELTER_NAME_OK.test(name);
}

/**
 * OSM 후보 → 정자 시설. 중심선에서 `SHELTER_MAX_FROM_LINE_M` 안만 남긴다.
 * 이름이 없으면 `정자` 로 적는다(유형 기본 이름) — 목록에서 "정자 · 120m" 로 읽힌다.
 */
export function shelterFacilities(
  pois: readonly OsmPoi[],
  line: readonly Position[],
  valleyId: string,
): FacilityRecord[] {
  const out: FacilityRecord[] = [];
  for (const poi of pois) {
    if (!isShelterCandidate(poi.tags)) continue;
    if (projectOnLine(line, poi.position).distance > SHELTER_MAX_FROM_LINE_M) continue;
    out.push({
      id: `${valleyId}-osm-shelter-${poi.id}`,
      valleyId,
      name: poi.tags['name'] ?? TYPE_DEFAULT_NAME.shelter,
      facilityType: 'shelter',
      position: [round6(poi.position[0]), round6(poi.position[1])],
      ...(poi.tags['opening_hours'] === undefined
        ? {}
        : { operatingHours: poi.tags['opening_hours'] }),
      origin: 'osm',
    });
  }
  return out;
}

// ── 수기 ─────────────────────────────────────────────────────────────

export const FACILITIES_MANUAL_PATH = path.join(SEED_DIR, 'facilities-manual.csv');
export const FACILITIES_MANUAL_HEADER = [
  'id',
  'valleyId',
  'name',
  'facilityType',
  'lng',
  'lat',
  'capacity',
  'feeNote',
  'operatingHours',
  'sourceUrl',
  'checkedAt',
  'note',
] as const;

const FACILITY_TYPES: readonly FacilityType[] = [
  'parking',
  'restroom',
  'food',
  'cafe',
  'store',
  'station',
  'access',
  'safety',
  'etc',
];

function manualFacility(row: CsvRow): FacilityRecord | string {
  const type = row['facilityType'] as FacilityType;
  if (!FACILITY_TYPES.includes(type))
    return `facilityType '${row['facilityType']}' 는 ${FACILITY_TYPES.join('|')} 중 하나`;
  const lng = number(row['lng']);
  const lat = number(row['lat']);
  if (lng === undefined || lat === undefined) return 'lng·lat 가 숫자여야 함';
  if (!row['id'] || !row['valleyId']) return 'id·valleyId 필수';
  const capacity = number(row['capacity']);
  return {
    id: row['id'],
    valleyId: row['valleyId'],
    name: row['name'] || TYPE_DEFAULT_NAME[type],
    facilityType: type,
    position: [round6(lng), round6(lat)],
    ...(capacity === undefined ? {} : { capacity: Math.round(capacity) }),
    ...(row['feeNote'] ? { feeNote: row['feeNote'] } : {}),
    ...(row['operatingHours'] ? { operatingHours: row['operatingHours'] } : {}),
    origin: 'manual',
  };
}

/** 수기 시설 전체 — `valleyId` 로 묶어 돌려준다. 잘못된 행은 메시지로. */
export function loadManualFacilities(): {
  byValley: Map<string, FacilityRecord[]>;
  errors: string[];
} {
  const byValley = new Map<string, FacilityRecord[]>();
  const errors: string[] = [];
  const { rows } = readCsv(FACILITIES_MANUAL_PATH);
  rows.forEach((row, index) => {
    const parsed = manualFacility(row);
    if (typeof parsed === 'string') {
      errors.push(`facilities-manual.csv ${index + 2}행: ${parsed}`);
      return;
    }
    const bucket = byValley.get(parsed.valleyId) ?? [];
    bucket.push(parsed);
    byValley.set(parsed.valleyId, bucket);
  });
  return { byValley, errors };
}

// ── 멀리 있는 것 자르기 (2026-09-23) ──────────────────────────────────

/** 이 거리(중심선 기준, m) 안은 전부 남긴다 — core 의 "주변"(300 m)·주차장·정류장(800 m) 상한과 같다. */
export const FAR_KEEP_M = 800;
/** 그 밖("가는 길에")은 종류별로 가까운 순 이 개수까지만. */
export const FAR_MAX_PER_TYPE = 20;

/**
 * 계곡 점 반경 3 km 로 긁으면 도심 계곡(긴고랑·안골)은 식당 900개가 들어와 파일이 600 KB 를 넘고
 * "가는 길에" 목록이 끝없이 길어진다. 물가 800 m 안은 전부, 그 밖은 종류별 가까운 20개만 남긴다 —
 * 회귀 기준(칩 개수)은 800 m 안만 보므로 이 자르기에 영향받지 않는다.
 */
export function trimFarFacilities(
  facilities: readonly FacilityRecord[],
  line: readonly Position[],
): FacilityRecord[] {
  const withDistance = facilities.map((facility) => ({
    facility,
    distance: projectOnLine(line, facility.position).distance,
  }));
  const near = withDistance.filter(({ distance }) => distance <= FAR_KEEP_M);
  const far = withDistance
    .filter(({ distance }) => distance > FAR_KEEP_M)
    .sort((a, b) => a.distance - b.distance);
  const perType = new Map<FacilityType, number>();
  const kept = far.filter(({ facility }) => {
    const seen = perType.get(facility.facilityType) ?? 0;
    perType.set(facility.facilityType, seen + 1);
    return seen < FAR_MAX_PER_TYPE;
  });
  return [...near, ...kept].map(({ facility }) => facility);
}

// ── 합치기 ────────────────────────────────────────────────────────────

/**
 * 표준데이터 → OSM → 수기 순으로 합친다. 같은 종류가 50 m 안에 이미 있으면 중복으로 버린다(표준데이터
 * 사이에서도 — 놀이시설 API 와 도시공원 유희시설이 같은 공원을 가리킨다). 같은 id 는 뒤가 이긴다(수기가 최종).
 */
export function mergeFacilities(
  std: readonly FacilityRecord[],
  osm: readonly FacilityRecord[],
  manual: readonly FacilityRecord[],
): FacilityRecord[] {
  const out: FacilityRecord[] = [];
  for (const record of [...std, ...osm]) {
    const duplicate = out.some(
      (existing) =>
        existing.facilityType === record.facilityType &&
        distanceM(existing.position, record.position) <= DEDUPE_M,
    );
    if (!duplicate) out.push(record);
  }
  const byId = new Map(out.map((record) => [record.id, record]));
  for (const record of manual) byId.set(record.id, record);
  return [...byId.values()];
}

/** 시설 컬렉션 피처(스키마 `facilityFeature`). `origin` 은 파일에 쓰지 않는다. */
export function toFacilityFeature(record: FacilityRecord, importance: number): unknown {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [record.position[0], record.position[1]] },
    properties: {
      id: record.id,
      valleyId: record.valleyId,
      name: record.name,
      facilityType: record.facilityType,
      ...(record.capacity === undefined ? {} : { capacity: record.capacity }),
      ...(record.feeNote === undefined ? {} : { feeNote: record.feeNote }),
      ...(record.operatingHours === undefined ? {} : { operatingHours: record.operatingHours }),
      mapIconTier: record.facilityType === 'parking' ? 0 : 1,
      mapImportance: importance,
    },
  };
}
