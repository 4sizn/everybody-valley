/**
 * 계곡 중심선 표고 역기입 — `data/valleys/<id>.geojson` 모든 구간 feature 에 `elevationM`(계곡 전체
 * 중심선 정점 표고의 중앙값, m)을 쓴다. 단풍 판정이 관측소 기온을 계곡 표고로 보정할 때 쓴다
 * (−0.65 ℃/100 m). Terrarium(AWS 지형 타일, z12 ≈ 38 m/px) 이라 수십 m 오차는 있다 — 보정
 * 목적엔 충분하다.
 *
 *   pnpm seed:elevation                 # 전부, 타일 캐시 재사용
 *   pnpm seed:elevation --valley yongchu-gapyeong --dry
 *
 * 값이 같으면 파일을 다시 쓰지 않는다(재실행 안전). 정자 역기입(`seed:shelters`)과 같은 패턴.
 */
import fs from 'node:fs';
import path from 'node:path';
import { elevationAt } from './elevation.mts';
import { loadKeys, VALLEYS_DIR } from './env.mts';
import { dumpsFile } from './format.mts';
import type { Position } from './geo.mts';
import { log } from './log.mts';

type Feature = {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: Position[] };
};
type ValleyFile = { features: Feature[]; [k: string]: unknown };

function argAll(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1] as string);
  });
  return out;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

async function main(): Promise<void> {
  const only = argAll('valley');
  const dry = process.argv.includes('--dry');
  const keys = loadKeys();
  const files = fs
    .readdirSync(VALLEYS_DIR)
    .filter((n) => n.endsWith('.geojson'))
    .filter((n) => only.length === 0 || only.includes(n.replace('.geojson', '')))
    .sort();
  let written = 0;
  for (const name of files) {
    const file = path.join(VALLEYS_DIR, name);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as ValleyFile;
    const points = parsed.features.flatMap((f) => f.geometry.coordinates);
    const elevations: number[] = [];
    for (const p of points) elevations.push(await elevationAt(p, keys));
    const elevationM = Math.round(median(elevations));
    const lo = Math.round(Math.min(...elevations));
    const hi = Math.round(Math.max(...elevations));
    const before = parsed.features[0]?.properties['elevationM'];
    const changed = parsed.features.some((f) => f.properties['elevationM'] !== elevationM);
    log(
      `${name.replace('.geojson', '').padEnd(18)} 표고 중앙 ${elevationM} m (${lo}~${hi}, 정점 ${points.length})${before === undefined ? ' 신규' : changed ? ` ← ${String(before)}` : ' 같음'}`,
    );
    if (!changed || dry) continue;
    for (const f of parsed.features) f.properties['elevationM'] = elevationM;
    fs.writeFileSync(file, dumpsFile(parsed));
    written += 1;
  }
  log(`계곡 ${files.length} · 파일 갱신 ${written}${dry ? ' (--dry, 쓰지 않음)' : ''}`);
}

await main();
