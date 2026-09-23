/**
 * 행안부 생활안전지도 물놀이관리지역 → 안전 항목(swimBanned · riskNote · depth) 자동 채움 (SD1b, 공식 출처).
 *
 * 엔드포인트(2026-09-06 실측): `POST https://www.safemap.go.kr/wtrPlay/getSearchList.json`
 *   폼 필드 sidoNm·sggNm·pageIndex, 헤더 Referer 와 `charset=UTF-8` 필요 — 충전값 없이 보내면
 *   서버가 본문을 Latin-1 로 읽어 **오류 없이 0건**을 돌려준다(2026-09-24 실측). 응답 `result[]` 에
 *   PLC_NM(지점명) · MANAGEMENT(관리지역|위험구역, 2026-09-24 기준) · PLC_TYPE(계곡|하천|…) · ADRES ·
 *   WTRPLAY_SE(구간 m) · WATER_DEEP(최대 수심 m) · WATER_AVG(평균 수심 m) · X/Y(EPSG:3857), 10건씩 + totalCount.
 *   상세: `getPopupInfo.json?OBJTID=`. 화면: https://www.safemap.go.kr/wtrPlay/searchWtrplay.do
 *
 * 절차
 *   1. 30개 계곡의 관할 시군을 전수 조회(응답은 `.cache/safemap/<시도>-<시군>.json`, 재실행 시 재사용).
 *   2. 계곡 중심선(`data/valleys/<id>.geojson`)과 각 지점의 거리를 재서 매칭:
 *        · 1,500 m 안 → 채택
 *        · 2,500 m 안이고 주소의 읍면·리가 계곡 점 주소(`valleys.json` matched.address)와 같으면 → 채택
 *        · 지점명이 계곡 이름을 담고 있으면 거리 무관 채택(이름 일치 — 좌표 불일치는 note 에 남김)
 *      가장 가까운 채택 지점이 본 구역, 그 외 채택된 위험 구역은 riskNote 에 덧붙인다.
 *   3. `data/seed/manual.csv` 의 swimBanned·riskNote·depth 행을 **덮어쓴다**(출처 safemap, confidence high, note 에 OBJT_ID·구분·거리).
 *        swimBanned = MANAGEMENT 에 '위험' 이 들어가면 true
 *        riskNote   = 관리구분·최대/평균 수심을 사실 그대로(≤ 80자)
 *        depth      = 평균 수심 환산: ≤0.5 knee · ≤1 waist · >1 adult · (최대 ≥ 2×평균 이고 평균 ≤1) mixed
 *   4. `data/seed/safemap-matches.md` 에 계곡별 후보·채택·거리 표를 쓴다.
 *
 *   pnpm seed:safemap                    # 조회(캐시) + manual.csv 갱신 + 표
 *   pnpm seed:safemap --dry-run          # manual.csv 는 건드리지 않고 표만
 *   pnpm seed:safemap --valley gwanaksan # 그 계곡의 manual.csv 행만 갱신(표는 전체 그대로)
 *
 * 생활안전지도 자료는 재전송하지 않는다 — 속성을 인용하고 출처 URL 을 남긴다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { type CsvRow, readCsv } from './csv.mts';
import { loadKeys, SEED_DIR, todayKst, VALLEYS_DIR } from './env.mts';
import { distanceM, type Position } from './geo.mts';
import { cached, fetchJson } from './http.mts';
import { log, warn } from './log.mts';
import { MANUAL_PATH } from './manual.mts';
import { loadSeedValleys, type SeedValley, valleyFilterFromArgv } from './valleys.mts';

const ENDPOINT = 'https://www.safemap.go.kr/wtrPlay/getSearchList.json';
export const SAFEMAP_URL = 'https://www.safemap.go.kr/wtrPlay/searchWtrplay.do';
const REFERER = SAFEMAP_URL;
const GAP_MS = 1000;
const NEAR_M = 1500;
const SAME_ADDRESS_M = 2500;

/** `valleys.json` 의 region 표기 → 생활안전지도 폼 값. */
const SIDO_OF: Readonly<Record<string, string>> = {
  포천시: '경기도',
  동두천시: '경기도',
  가평군: '경기도',
  남양주시: '경기도',
  양주시: '경기도',
  의정부시: '경기도',
  연천군: '경기도',
  파주시: '경기도',
  양평군: '경기도',
  '서울 강북구': '서울특별시',
  '서울 관악구': '서울특별시',
  '서울 광진구': '서울특별시',
  '광주 북구': '광주광역시',
  '광주 동구': '광주광역시',
  '인천 강화군': '인천광역시',
  춘천시: '강원특별자치도',
  화천군: '강원특별자치도',
};

export interface SafemapPlace {
  readonly OBJT_ID: number;
  readonly PLC_NM: string;
  readonly MANAGEMENT: string;
  readonly PLC_TYPE: string;
  readonly ADRES: string;
  readonly WTRPLAY_SE: string;
  readonly WATER_DEEP: string;
  readonly WATER_AVG: string;
  readonly X: number;
  readonly Y: number;
}

interface SearchResponse {
  result: SafemapPlace[];
  totalCount: number;
  paginationInfo: { totalPageCount: number };
}

function regionOf(valley: SeedValley): { sido: string; sgg: string } {
  const sido = SIDO_OF[valley.region];
  if (sido === undefined) throw new Error(`시도를 모르는 region: ${valley.region} (${valley.id})`);
  const sgg = valley.region.split(' ').pop() ?? valley.region;
  return { sido, sgg };
}

async function fetchRegion(sido: string, sgg: string): Promise<SafemapPlace[]> {
  const keys = loadKeys();
  return cached(`safemap/${sido}-${sgg}.json`, async () => {
    const out: SafemapPlace[] = [];
    let page = 1;
    for (;;) {
      const body = new URLSearchParams({ sidoNm: sido, sggNm: sgg, pageIndex: String(page) });
      const response = await fetchJson<SearchResponse>(ENDPOINT, keys, GAP_MS, {
        method: 'POST',
        body,
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          referer: REFERER,
          'user-agent': 'Mozilla/5.0 modu-valley-seed',
        },
      });
      out.push(...response.result);
      if (page >= response.paginationInfo.totalPageCount || response.result.length === 0) break;
      page += 1;
    }
    log(`  ${sido} ${sgg}: ${out.length}건`);
    return out;
  });
}

/** EPSG:3857 → [lng, lat]. */
export function mercatorToLngLat(x: number, y: number): Position {
  const lng = (x / 20037508.34) * 180;
  const latMerc = (y / 20037508.34) * 180;
  const lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((latMerc * Math.PI) / 180)) - Math.PI / 2);
  return [lng, lat];
}

export interface Candidate {
  readonly place: SafemapPlace;
  readonly position: Position;
  /** 중심선까지 최단 거리(m). */
  readonly distanceM: number;
  readonly accepted: 'near' | 'address' | 'name' | null;
}

function stem(name: string): string {
  // '산정호수 비선폭포 계곡' → '비선폭포', '현등사계곡(운악산)' → '현등사'
  return (
    name
      .replace(/\(.*?\)/g, '')
      .replace(/계곡|골$/g, '')
      .trim()
      .split(' ')
      .pop() ?? name
  );
}

/** 계곡 점 주소의 "읍면 리" — `valleys.json` matched.address(예 '경기도 포천시 이동면 도평리 산 1-2임'). */
function townOf(valley: SeedValley): string | undefined {
  const address = valley.matched?.address;
  if (address === undefined) return undefined;
  const parts = address.split(' ');
  const town = parts.find((part) => /[읍면동]$/.test(part));
  const village = parts.find((part) => /리$/.test(part));
  return town !== undefined && village !== undefined ? `${town} ${village}` : undefined;
}

export function matchValley(
  valley: SeedValley,
  line: readonly Position[],
  places: readonly SafemapPlace[],
): Candidate[] {
  const town = townOf(valley);
  const nameStem = stem(valley.name);
  return places
    .map((place) => {
      const position = mercatorToLngLat(place.X, place.Y);
      const distance = Math.round(Math.min(...line.map((point) => distanceM(point, position))));
      let accepted: Candidate['accepted'] = null;
      if (distance <= NEAR_M) accepted = 'near';
      else if (distance <= SAME_ADDRESS_M && town !== undefined && place.ADRES.includes(town))
        accepted = 'address';
      else if (nameStem.length >= 2 && place.PLC_NM.replace(/\s+/g, '').includes(nameStem))
        accepted = 'name';
      return { place, position, distanceM: distance, accepted };
    })
    .filter((candidate) => candidate.accepted !== null || candidate.distanceM <= 5000)
    .sort((a, b) => a.distanceM - b.distanceM);
}

export function depthOf(place: SafemapPlace): string | undefined {
  const avg = Number(place.WATER_AVG);
  const max = Number(place.WATER_DEEP);
  if (!Number.isFinite(avg) || !Number.isFinite(max) || avg <= 0) return undefined;
  if (max >= 2 * avg && avg <= 1) return 'mixed';
  if (avg <= 0.5) return 'knee';
  if (avg <= 1) return 'waist';
  return 'adult';
}

interface SafetyRows {
  readonly swimBanned: string;
  readonly riskNote: string;
  readonly depth: string | undefined;
  readonly note: string;
}

/**
 * 위험 구역인가. 출처의 어휘가 바뀌어도 견디게 **'위험' 포함 여부**로 읽는다 — 2026-09-06 에는
 * `일반지역|중점관리지역|위험지역` 이었고 2026-09-24 실측은 `관리지역|위험구역` 이다. 정확한
 * 문자열로 비교하면 어휘가 바뀐 날부터 모든 위험 구간이 조용히 `swimBanned: false` 가 된다.
 */
export const isHazardPlace = (place: SafemapPlace): boolean => place.MANAGEMENT.includes('위험');
/** 표·문장에 쓰는 짧은 이름 — 꼬리의 '지역'·'구역' 을 뗀다. */
const shortManagement = (management: string): string => management.replace(/(지역|구역)$/, '');

/** riskNote 한 칸의 글자 수 — 시트의 한 줄 경고라 길면 화면에서 잘린다. */
const RISK_NOTE_MAX = 80;
/**
 * 한도 안에서 뒤 조각을 **통째로만** 붙인다. 이어 붙인 뒤 자르면 지점 이름이 긴 날
 * (`k27 아카시아숲(다사51213975)`, 2026-09-24) 문장이 열린 괄호로 끝난다.
 */
function joinWithin(max: number, head: string, ...tails: readonly string[]): string {
  let out = head.length <= max ? head : `${head.slice(0, max - 1)}…`;
  for (const tail of tails) if (tail && out.length + tail.length <= max) out += tail;
  return out;
}

export function safetyRowsOf(main: Candidate, hazards: readonly Candidate[]): SafetyRows {
  const place = main.place;
  const banned = isHazardPlace(place);
  const hazard = hazards[0];
  const riskNote = joinWithin(
    RISK_NOTE_MAX,
    `물놀이관리지역(${shortManagement(place.MANAGEMENT)}) ${place.PLC_NM} — 최대 수심 ${place.WATER_DEEP} m·평균 ${place.WATER_AVG} m`,
    banned ? ', 입수 금지' : '',
    !banned && hazard !== undefined
      ? `. 인근 ${hazard.distanceM} m 에 위험 구역(수심 ${hazard.place.WATER_DEEP} m)`
      : '',
  );
  const how =
    main.accepted === 'near' ? '거리' : main.accepted === 'address' ? '읍면리 일치' : '이름 일치';
  const note =
    `생활안전지도 OBJT_ID ${place.OBJT_ID} '${place.PLC_NM}' ${place.MANAGEMENT}·${place.PLC_TYPE} (${place.ADRES}) ` +
    `중심선에서 ${main.distanceM} m [${how}]` +
    (hazard === undefined
      ? ''
      : `; 위험 구역 OBJT_ID ${hazard.place.OBJT_ID} ${hazard.distanceM} m`);
  return {
    swimBanned: banned ? 'true' : 'false',
    riskNote,
    depth: depthOf(place),
    note,
  };
}

const MANUAL_HEADER = [
  'valleyId',
  'segmentId',
  'field',
  'value',
  'sourceUrl',
  'checkedAt',
  'note',
  'confidence',
] as const;

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** manual.csv 의 (계곡, 항목) 행을 덮어쓴다. 없는 행은 추가. */
function upsertManual(
  rows: Record<string, string>[],
  valleyId: string,
  field: string,
  value: string,
  note: string,
): void {
  const row = rows.find(
    (candidate) => candidate['valleyId'] === valleyId && candidate['field'] === field,
  );
  const next = {
    valleyId,
    segmentId: `${valleyId}-whole`,
    field,
    value,
    sourceUrl: SAFEMAP_URL,
    checkedAt: todayKst(),
    note,
    confidence: 'high',
  };
  if (row === undefined) rows.push(next);
  else Object.assign(row, next);
}

function report(
  entries: readonly { valley: SeedValley; candidates: Candidate[]; main: Candidate | undefined }[],
  totals: readonly [string, number][],
): string {
  const lines = [
    `# 생활안전지도 물놀이관리지역 매칭 — SD1b (${todayKst()})`,
    '',
    '`pnpm seed:safemap` 산출. 채택 규칙: 중심선 1,500 m 안 → `near`, 2,500 m 안 + 계곡 점 주소의 읍면·리 일치 → `address`, 지점명에 계곡 이름 → `name`(거리 무관, 좌표 불일치 확인 대상). 가장 가까운 채택 지점이 본 구역.',
    '',
    `시군별 건수: ${totals.map(([region, count]) => `${region} ${count}`).join(' · ')}`,
    '',
    '| # | 계곡 | 채택 | 지점 | 구분 | 유형 | 최대/평균 수심 m | 중심선 거리 m | 근거 | 다음 후보(거리) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  entries.forEach(({ valley, candidates, main }, index) => {
    const others = candidates
      .filter((candidate) => candidate !== main)
      .slice(0, 2)
      .map(
        (candidate) =>
          `${candidate.place.PLC_NM}(${shortManagement(candidate.place.MANAGEMENT)}, ${candidate.distanceM})`,
      )
      .join(' · ');
    if (main === undefined) {
      lines.push(
        `| ${index + 1} | ${valley.name} | — | — | — | — | — | — | 채택 없음 | ${others || '—'} |`,
      );
      return;
    }
    const p = main.place;
    lines.push(
      `| ${index + 1} | ${valley.name} | ✓ | ${p.PLC_NM} (id ${p.OBJT_ID}) | ${p.MANAGEMENT} | ${p.PLC_TYPE} | ${p.WATER_DEEP} / ${p.WATER_AVG} | ${main.distanceM} | ${main.accepted} | ${others || '—'} |`,
    );
  });
  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  /**
   * 비어 있으면 전부. 출처가 해마다 지점을 갈아엎기 때문에(2026-09-24: 지점 id·이름·관리구분이
   * 통째로 바뀌었다) 전체 갱신은 기존 안전 값을 한꺼번에 뒤집는다 — 표는 언제나 전체로 쓰고
   * **쓰기만** 이 집합으로 좁힌다.
   */
  const only = new Set(valleyFilterFromArgv(process.argv.slice(2)));
  const valleys = loadSeedValleys();
  const byRegion = new Map<string, SafemapPlace[]>();
  const totals: [string, number][] = [];
  for (const valley of valleys) {
    const { sido, sgg } = regionOf(valley);
    const key = `${sido} ${sgg}`;
    if (byRegion.has(key)) continue;
    const places = await fetchRegion(sido, sgg);
    byRegion.set(key, places);
    totals.push([sgg, places.length]);
  }

  const { header, rows } = readCsv(MANUAL_PATH);
  const manualRows: Record<string, string>[] = rows.map((row: CsvRow) => ({ ...row }));
  const entries: { valley: SeedValley; candidates: Candidate[]; main: Candidate | undefined }[] =
    [];
  let matched = 0;
  for (const valley of valleys) {
    const { sido, sgg } = regionOf(valley);
    const places = byRegion.get(`${sido} ${sgg}`) ?? [];
    const file = path.join(VALLEYS_DIR, `${valley.id}.geojson`);
    if (!fs.existsSync(file)) {
      warn(`${valley.id}: ${file} 없음 — 먼저 pnpm seed:build`);
      continue;
    }
    const collection = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      features: { geometry: { coordinates: [number, number][] } }[];
    };
    const line: Position[] = collection.features.flatMap((feature) =>
      feature.geometry.coordinates.map((point): Position => [point[0], point[1]]),
    );
    const candidates = matchValley(valley, line, places);
    const accepted = candidates.filter((candidate) => candidate.accepted !== null);
    const main = accepted[0];
    entries.push({ valley, candidates, main });
    if (main === undefined) {
      log(
        `${valley.id.padEnd(18)} 채택 없음 (가장 가까운 ${candidates[0]?.place.PLC_NM ?? '—'} ${candidates[0]?.distanceM ?? '—'} m)`,
      );
      continue;
    }
    matched += 1;
    const hazards = accepted.filter(
      (candidate) => candidate !== main && isHazardPlace(candidate.place),
    );
    const safety = safetyRowsOf(main, hazards);
    log(
      `${valley.id.padEnd(18)} ${main.place.PLC_NM} ${main.place.MANAGEMENT} ${main.distanceM} m [${main.accepted}] → swimBanned ${safety.swimBanned}${safety.depth ? `, depth ${safety.depth}` : ''}`,
    );
    if (dryRun || (only.size > 0 && !only.has(valley.id))) continue;
    upsertManual(manualRows, valley.id, 'swimBanned', safety.swimBanned, safety.note);
    upsertManual(
      manualRows,
      valley.id,
      'riskNote',
      safety.riskNote,
      `${safety.note}; MANAGEMENT·WATER_DEEP·WATER_AVG 그대로`,
    );
    if (safety.depth !== undefined) {
      upsertManual(
        manualRows,
        valley.id,
        'depth',
        safety.depth,
        `${safety.note}; 평균 ${main.place.WATER_AVG} m·최대 ${main.place.WATER_DEEP} m 환산(≤0.5 knee·≤1 waist·>1 adult·최대≥2×평균 mixed)`,
      );
    }
  }

  fs.writeFileSync(path.join(SEED_DIR, 'safemap-matches.md'), report(entries, totals));
  if (!dryRun) {
    const columns =
      header.length === 0 ? [...MANUAL_HEADER] : [...new Set([...header, 'confidence'])];
    const text = [
      columns.join(','),
      ...manualRows.map((row) => columns.map((column) => csvCell(row[column] ?? '')).join(',')),
    ].join('\n');
    fs.writeFileSync(MANUAL_PATH, `${text}\n`);
  }
  log('');
  log(
    `계곡 ${valleys.length} · 관리지역 ${[...byRegion.values()].reduce((sum, places) => sum + places.length, 0)}건 · 매칭 ${matched}${dryRun ? ' (dry-run, manual.csv 미변경)' : ' → manual.csv 갱신'}`,
  );
  log(`→ ${path.join(SEED_DIR, 'safemap-matches.md')}`);
}

await main();
