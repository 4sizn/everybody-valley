/**
 * SD1a 첫 산출물 — 계곡 30개 × 좌표열 출처 비교표 (결정 (b)).
 *
 * 계곡 점 반경 2 km 에서
 *   · 브이월드 하천망 WFS `lt_c_wkmstrm`: 피처 수, 폴리곤/선, 정점 수·밀도, 계곡 점까지 거리, 하천 이름
 *   · OSM 하천 중심선(Overpass `waterway~stream|river`): way 수, 정점 수·밀도, 길이, name 유무
 * 를 실측해 `data/seed/source-comparison.{json,md}` 로 쓴다. 브이월드 응답은 통계만 남기고
 * 기하는 버린다(약관 §19 — 비교·조회 전용). 우선순위 ① R5 1:5,000(아직 없음) > ② 하천망(계곡을 덮을 때)
 * > ③ OSM 이지만, **저장용은 답신 전까지 OSM**(또는 국토부 파일이 있으면 그것) — 표의 `recommended` 는
 * 정밀도 판정, `stored` 는 이번에 실제로 쓴 출처다.
 *
 *   pnpm seed:compare              # 캐시 재사용
 *   pnpm seed:compare --valley baegun-pocheon
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadKeys, SEED_DIR, todayKst } from './env.mts';
import { distanceM, lineLengthM, type Position, projectOnLine } from './geo.mts';
import { log, warn } from './log.mts';
import { fetchWaterways } from './overpass.mts';
import { loadSeedValleys, valleyFilterFromArgv } from './valleys.mts';
import { type StreamNetworkStats, streamNetworkStats } from './vworld.mts';

/** 계곡 점 기준 비교 반경(m) — 결정 (b) "2 km 안을 덮는가". */
export const COMPARE_RADIUS_M = 2000;
/** 하천망이 "계곡을 덮는다"고 보는 계곡 점 ↔ 하천망 최근접 거리(m). 골짜기 폭을 넘으면 다른 물줄기다. */
export const COVER_MAX_M = 500;

export type SourceChoice = 'r5' | 'vworld-stream-network' | 'osm' | 'none';

export interface OsmStats {
  readonly ways: number;
  readonly namedWays: number;
  readonly names: readonly string[];
  readonly vertices: number;
  readonly lengthKm: number;
  readonly verticesPerKm: number;
  /** 계곡 점에서 가장 가까운 way 까지 거리(m). */
  readonly nearestM: number;
}

export interface ComparisonRow {
  readonly id: string;
  readonly name: string;
  readonly region: string;
  readonly vworld: StreamNetworkStats | null;
  readonly vworldCovers: boolean;
  readonly osm: OsmStats;
  /** 정밀도 판정 — 하천망이 계곡을 덮고 정점 밀도가 OSM 이상이면 하천망, 아니면 OSM. */
  readonly recommended: SourceChoice;
  /** 이번에 저장한 출처 — 브이월드 저장 금지(답신 전)·국토부 파일 없음 → OSM. */
  readonly stored: SourceChoice;
  readonly note: string;
}

export function osmStatsOf(
  center: Position,
  ways: readonly { geometry: readonly Position[]; tags: Readonly<Record<string, string>> }[],
): OsmStats {
  let vertices = 0;
  let lengthM = 0;
  let nearestM = Number.POSITIVE_INFINITY;
  const names = new Set<string>();
  let namedWays = 0;
  for (const way of ways) {
    vertices += way.geometry.length;
    lengthM += lineLengthM(way.geometry);
    if (way.geometry.length >= 2) {
      nearestM = Math.min(nearestM, projectOnLine(way.geometry, center).distance);
    } else if (way.geometry[0] !== undefined) {
      nearestM = Math.min(nearestM, distanceM(center, way.geometry[0]));
    }
    const name = way.tags['name'];
    if (name !== undefined) {
      names.add(name);
      namedWays += 1;
    }
  }
  const lengthKm = lengthM / 1000;
  return {
    ways: ways.length,
    namedWays,
    names: [...names],
    vertices,
    lengthKm: Math.round(lengthKm * 100) / 100,
    verticesPerKm: lengthKm > 0 ? Math.round(vertices / lengthKm) : 0,
    nearestM: Number.isFinite(nearestM) ? Math.round(nearestM) : -1,
  };
}

export function decide(
  vworld: StreamNetworkStats | null,
  osm: OsmStats,
): { recommended: SourceChoice; stored: SourceChoice; covers: boolean; note: string } {
  const covers =
    vworld !== null &&
    vworld.features > 0 &&
    vworld.nearestM >= 0 &&
    vworld.nearestM <= COVER_MAX_M;
  const hasOsm = osm.ways > 0;
  if (!hasOsm && !covers) {
    return {
      recommended: 'none',
      stored: 'none',
      covers,
      note: 'OSM·하천망 모두 없음 — 수기 좌표 필요',
    };
  }
  if (covers && vworld !== null && (!hasOsm || vworld.verticesPerKm >= osm.verticesPerKm)) {
    return {
      recommended: 'vworld-stream-network',
      stored: hasOsm ? 'osm' : 'none',
      covers,
      note: hasOsm
        ? `하천망(${vworld.verticesPerKm}/km)이 OSM(${osm.verticesPerKm}/km) 이상 — 저장은 답신 전 OSM`
        : '하천망만 있음 — 저장 금지(답신 전)라 좌표열 보류',
    };
  }
  if (covers && vworld !== null) {
    return {
      recommended: 'osm',
      stored: 'osm',
      covers,
      note: `OSM(${osm.verticesPerKm}/km)이 하천망(${vworld.verticesPerKm}/km)보다 촘촘`,
    };
  }
  return {
    recommended: 'osm',
    stored: 'osm',
    covers,
    note: vworld === null ? '하천망 미조회(키 없음)' : '하천망이 계곡을 덮지 않음(국가·지방하천만)',
  };
}

function markdownTable(rows: readonly ComparisonRow[]): string {
  const head =
    '| # | 계곡 | 시군 | 하천망 피처 | 기하 | 하천망 정점/km | 하천망 최근접 m | 하천망 이름 | OSM way | OSM name | OSM 정점/km | OSM 길이 km | OSM 최근접 m | 판정 | 저장 |\n' +
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |';
  const lines = rows.map((row, index) => {
    const v = row.vworld;
    const geometry =
      v === null
        ? '—'
        : Object.entries(v.geometryTypes)
            .map(([type, count]) => `${type} ${count}`)
            .join(' ') || '—';
    const names = row.osm.names.length === 0 ? '—' : row.osm.names.join('·');
    return `| ${index + 1} | ${row.name} | ${row.region} | ${v === null ? '—' : v.features} | ${geometry} | ${v === null ? '—' : v.verticesPerKm} | ${v === null || v.nearestM < 0 ? '—' : v.nearestM} | ${v === null || v.rivers.length === 0 ? '—' : v.rivers.join('·')} | ${row.osm.ways} | ${row.osm.namedWays}/${row.osm.ways} ${names} | ${row.osm.verticesPerKm} | ${row.osm.lengthKm} | ${row.osm.nearestM < 0 ? '—' : row.osm.nearestM} | ${row.recommended} | ${row.stored} |`;
  });
  return `${head}\n${lines.join('\n')}`;
}

function summarize(rows: readonly ComparisonRow[]): string {
  const count = (predicate: (row: ComparisonRow) => boolean): number =>
    rows.filter(predicate).length;
  return [
    `계곡 ${rows.length}개 · 비교 반경 ${COMPARE_RADIUS_M / 1000} km · 덮음 판정 ≤ ${COVER_MAX_M} m`,
    `하천망이 계곡을 덮음: ${count((row) => row.vworldCovers)} · 상자 안 피처 있음: ${count((row) => (row.vworld?.features ?? 0) > 0)}`,
    `OSM way 있음: ${count((row) => row.osm.ways > 0)} · name 있는 way 가 하나 이상: ${count((row) => row.osm.namedWays > 0)}`,
    `판정 — 하천망 권고: ${count((row) => row.recommended === 'vworld-stream-network')} · OSM: ${count((row) => row.recommended === 'osm')} · 없음: ${count((row) => row.recommended === 'none')}`,
    `저장 — OSM: ${count((row) => row.stored === 'osm')} · 보류: ${count((row) => row.stored === 'none')}`,
  ].join('\n');
}

async function main(): Promise<void> {
  const keys = loadKeys();
  if (keys.vworld === undefined)
    warn('.env.local 에 VWORLD_API_KEY 가 없어 하천망 비교를 건너뛴다');
  const valleys = loadSeedValleys(valleyFilterFromArgv(process.argv.slice(2)));
  const rows: ComparisonRow[] = [];
  for (const valley of valleys) {
    const center: Position = [valley.lng, valley.lat];
    const ways = await fetchWaterways(valley.id, center, COMPARE_RADIUS_M, keys);
    const osm = osmStatsOf(center, ways);
    const vworld = (await streamNetworkStats(valley.id, center, COMPARE_RADIUS_M, keys)) ?? null;
    const verdict = decide(vworld, osm);
    rows.push({
      id: valley.id,
      name: valley.name,
      region: valley.region,
      vworld,
      vworldCovers: verdict.covers,
      osm,
      recommended: verdict.recommended,
      stored: verdict.stored,
      note: verdict.note,
    });
    log(
      `${valley.id.padEnd(18)} 하천망 ${vworld === null ? '—' : `${vworld.features}f ${vworld.verticesPerKm}/km ${vworld.nearestM}m`}` +
        ` | OSM ${osm.ways}w ${osm.namedWays}n ${osm.verticesPerKm}/km ${osm.lengthKm}km ${osm.nearestM}m → ${verdict.recommended}/${verdict.stored}`,
    );
  }
  const generatedAt = todayKst();
  fs.mkdirSync(SEED_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(SEED_DIR, 'source-comparison.json'),
    `${JSON.stringify({ generatedAt, radiusM: COMPARE_RADIUS_M, coverMaxM: COVER_MAX_M, rows }, null, 2)}\n`,
  );
  const markdown = [
    `# 좌표열 출처 비교표 — SD1a (${generatedAt})`,
    '',
    '`pnpm seed:compare` 산출. 브이월드 하천망(`lt_c_wkmstrm`)은 **통계만** 남겼다(약관 §19, 기하 저장 없음). OSM 은 © OpenStreetMap contributors, ODbL.',
    '',
    summarize(rows),
    '',
    markdownTable(rows),
    '',
    '판정 규칙: 하천망이 계곡 점 500 m 안을 지나고(`nearestM ≤ 500`) 정점 밀도(정점/km)가 OSM 이상이면 `vworld-stream-network`, 아니면 `osm`. 저장(`stored`)은 브이월드 답신 전이라 전부 OSM(국토부 국가공간정보포털 하천망 파일은 아직 없음).',
    '',
    ...rows.filter((row) => row.note).map((row) => `- ${row.name}: ${row.note}`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(SEED_DIR, 'source-comparison.md'), markdown);
  log('');
  log(summarize(rows));
  log(`→ ${path.join(SEED_DIR, 'source-comparison.{json,md}')}`);
}

await main();
