/**
 * 계곡 30개의 정본 — `data/seed/valleys.json` (SD1 (a): R1 `valleys.json` 그대로).
 * id·name·region·lng·lat·source 를 유지한다. 순서가 앱 목록의 순서다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SEED_DIR } from './env.mts';

export interface SeedValley {
  readonly id: string;
  readonly name: string;
  readonly region: string;
  readonly lng: number;
  readonly lat: number;
  readonly source: 'vworld-search' | 'manual';
  readonly note?: string;
  /** VWorld 검색 결과(있을 때) — 주소는 생활안전지도 매칭의 읍면·리 비교에 쓴다. */
  readonly matched?: {
    readonly title?: string;
    readonly category?: string;
    readonly address?: string;
  };
}

export const VALLEY_LIST_PATH = path.join(SEED_DIR, 'valleys.json');

export function loadSeedValleys(only?: readonly string[]): readonly SeedValley[] {
  const raw = JSON.parse(fs.readFileSync(VALLEY_LIST_PATH, 'utf8')) as { valleys: SeedValley[] };
  const valleys = raw.valleys;
  if (only === undefined || only.length === 0) return valleys;
  const wanted = new Set(only);
  return valleys.filter((valley) => wanted.has(valley.id));
}

/** `--valley a --valley b` 를 모은다. */
export function valleyFilterFromArgv(argv: readonly string[]): string[] {
  const out: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--valley') {
      const value = argv[index + 1];
      if (value !== undefined) out.push(value);
    }
  }
  return out;
}
