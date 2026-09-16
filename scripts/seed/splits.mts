/**
 * 구간 분할 (결정 (c)) — 실데이터 근거가 있을 때만 상·중·하로 나눈다. `data/seed/splits.csv`.
 *
 * 열: valleyId, segment(upper|mid|lower), fromM, toM, splitBasis(toponym|safemap|facility), sourceUrl, checkedAt, note
 *   fromM·toM 은 중심선 **상류 끝에서 잰 거리(m)**. 계곡에 행이 하나도 없으면 1구간(`whole`, splitBasis none).
 *   행이 있으면 그 계곡은 행대로만 자른다 — 빈 곳(행 사이 틈)은 구간이 아니다.
 *
 * SD1a 에서는 비어 있다: 지명·물놀이관리지역·시설로 상·중·하를 가를 근거를 계곡별로 확인한 뒤 채운다.
 */
import path from 'node:path';
import { type CsvRow, readCsv } from './csv.mts';
import { SEED_DIR } from './env.mts';

export const SPLITS_PATH = path.join(SEED_DIR, 'splits.csv');
export const SPLITS_HEADER = [
  'valleyId',
  'segment',
  'fromM',
  'toM',
  'splitBasis',
  'sourceUrl',
  'checkedAt',
  'note',
] as const;

export type SplitPosition = 'upper' | 'mid' | 'lower';
export type SplitBasis = 'toponym' | 'safemap' | 'facility';

export interface SplitRow {
  readonly valleyId: string;
  readonly segment: SplitPosition;
  readonly fromM: number;
  readonly toM: number;
  readonly splitBasis: SplitBasis;
}

const POSITIONS: readonly SplitPosition[] = ['upper', 'mid', 'lower'];
const BASES: readonly SplitBasis[] = ['toponym', 'safemap', 'facility'];

function parseRow(row: CsvRow): SplitRow | string {
  const segment = row['segment'] as SplitPosition;
  const splitBasis = row['splitBasis'] as SplitBasis;
  if (!POSITIONS.includes(segment)) return `segment '${row['segment']}' 는 upper|mid|lower`;
  if (!BASES.includes(splitBasis))
    return `splitBasis '${row['splitBasis']}' 는 toponym|safemap|facility`;
  const fromM = Number(row['fromM']);
  const toM = Number(row['toM']);
  if (!Number.isFinite(fromM) || !Number.isFinite(toM) || toM <= fromM)
    return 'fromM < toM 인 숫자여야 함';
  if (!row['valleyId']) return 'valleyId 필수';
  return { valleyId: row['valleyId'], segment, fromM, toM, splitBasis };
}

export function loadSplits(): { byValley: Map<string, SplitRow[]>; errors: string[] } {
  const byValley = new Map<string, SplitRow[]>();
  const errors: string[] = [];
  const { rows } = readCsv(SPLITS_PATH);
  rows.forEach((row, index) => {
    const parsed = parseRow(row);
    if (typeof parsed === 'string') {
      errors.push(`splits.csv ${index + 2}행: ${parsed}`);
      return;
    }
    const bucket = byValley.get(parsed.valleyId) ?? [];
    bucket.push(parsed);
    byValley.set(parsed.valleyId, bucket);
  });
  for (const bucket of byValley.values()) bucket.sort((a, b) => a.fromM - b.fromM);
  return { byValley, errors };
}
