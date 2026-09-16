/**
 * 수기 항목 (결정 (d)) — `data/seed/manual.csv` 한 장에서 구간 속성을 병합한다.
 *
 * 열: valleyId, segmentId, field, value, sourceUrl, checkedAt, note
 *   field ∈ depth·bed·swimBanned·riskNote·freeAccess·campingAllowed·petAllowed(결정 (d) 7개)
 *           + accessDifficulty(선택 — 자동 산출이 없어 수기로 열어 둔다)
 *   value  enum 값(knee·waist·adult·mixed / gravel·rock·sand·mixed / easy·moderate·hard), true·false, 또는 문장(riskNote)
 *   segmentId 를 비우면 그 계곡의 모든 구간에 적용한다.
 *
 * 병합은 자동 채움 뒤에 적용되므로 재실행해도 수기 값이 덮이지 않는다(결정 (h)).
 * 출처 URL·확인일은 파일에 쓰지 않고 CSV 에만 남는다 — 검수 추적은 CSV 가 진실이다.
 */
import path from 'node:path';
import { type CsvRow, readCsv } from './csv.mts';
import { SEED_DIR } from './env.mts';

export const MANUAL_PATH = path.join(SEED_DIR, 'manual.csv');
export const MANUAL_HEADER = [
  'valleyId',
  'segmentId',
  'field',
  'value',
  'sourceUrl',
  'checkedAt',
  'note',
] as const;

const ENUM_FIELDS: Readonly<Record<string, readonly string[]>> = {
  depth: ['knee', 'waist', 'adult', 'mixed'],
  bed: ['gravel', 'rock', 'sand', 'mixed'],
  accessDifficulty: ['easy', 'moderate', 'hard'],
};
const BOOLEAN_FIELDS = ['swimBanned', 'freeAccess', 'campingAllowed', 'petAllowed'] as const;
const TEXT_FIELDS = ['riskNote'] as const;
export const MANUAL_FIELDS = [
  ...Object.keys(ENUM_FIELDS),
  ...BOOLEAN_FIELDS,
  ...TEXT_FIELDS,
] as const;

export interface ManualEntry {
  readonly valleyId: string;
  /** 비어 있으면 계곡의 모든 구간. */
  readonly segmentId: string | undefined;
  readonly field: string;
  readonly value: string | boolean;
}

function parseValue(field: string, raw: string): string | boolean | undefined {
  const options = ENUM_FIELDS[field];
  if (options !== undefined) return options.includes(raw) ? raw : undefined;
  if ((BOOLEAN_FIELDS as readonly string[]).includes(field)) {
    if (raw === 'true' || raw === 'TRUE' || raw === '1' || raw === 'yes') return true;
    if (raw === 'false' || raw === 'FALSE' || raw === '0' || raw === 'no') return false;
    return undefined;
  }
  if ((TEXT_FIELDS as readonly string[]).includes(field)) return raw;
  return undefined;
}

function parseRow(row: CsvRow): ManualEntry | string {
  const field = row['field'] ?? '';
  if (!(MANUAL_FIELDS as readonly string[]).includes(field)) {
    return `field '${field}' 는 ${MANUAL_FIELDS.join('|')} 중 하나`;
  }
  const value = parseValue(field, row['value'] ?? '');
  if (value === undefined || value === '')
    return `field '${field}' 의 value '${row['value']}' 를 해석할 수 없음`;
  if (!row['valleyId']) return 'valleyId 필수';
  return { valleyId: row['valleyId'], segmentId: row['segmentId'] || undefined, field, value };
}

/** CSV 전체 — 계곡별로 묶고, 잘못된 행은 메시지로 모은다(빈 값 행은 템플릿이므로 무시). */
export function loadManual(): {
  byValley: Map<string, ManualEntry[]>;
  errors: string[];
  filled: number;
} {
  const byValley = new Map<string, ManualEntry[]>();
  const errors: string[] = [];
  let filled = 0;
  const { rows } = readCsv(MANUAL_PATH);
  rows.forEach((row, index) => {
    if ((row['value'] ?? '') === '') return;
    const parsed = parseRow(row);
    if (typeof parsed === 'string') {
      errors.push(`manual.csv ${index + 2}행: ${parsed}`);
      return;
    }
    filled += 1;
    const bucket = byValley.get(parsed.valleyId) ?? [];
    bucket.push(parsed);
    byValley.set(parsed.valleyId, bucket);
  });
  return { byValley, errors, filled };
}

/** 구간 properties 에 수기 값을 덮어쓴다. 자동 채움 뒤에 부른다. */
export function applyManual(
  properties: Record<string, unknown>,
  entries: readonly ManualEntry[],
): number {
  let applied = 0;
  for (const entry of entries) {
    if (entry.segmentId !== undefined && entry.segmentId !== properties['id']) continue;
    properties[entry.field] = entry.value;
    applied += 1;
  }
  return applied;
}
