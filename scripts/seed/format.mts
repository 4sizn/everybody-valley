/**
 * Prettier/Biome 식 JSON 출력 — `scripts/shade/jsonfmt.py` 와 같은 규칙.
 *
 * 그늘 파이프라인이 구간 파일에 `shadeByHour` 를 역기입할 때 원본 포맷을 그대로 재현하는지
 * 검사하므로, 시딩 스크립트도 같은 규칙으로 써야 두 도구가 서로의 출력을 뒤집지 않는다.
 * 규칙: 들여쓰기 2, 객체는 항상 여러 줄, 원시값 배열은 폭 100 안이면 한 줄, 좌표열처럼
 * 배열의 배열은 원소마다 줄바꿈.
 */
const WIDTH = 100;
const INDENT = 2;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function isScalar(value: Json): boolean {
  return value === null || typeof value !== 'object';
}

function fitsInline(value: Json): boolean {
  if (Array.isArray(value)) {
    if (value.every(isScalar)) return true;
    if (value.length === 1) return fitsInline(value[0] as Json);
    return false;
  }
  return isScalar(value);
}

function scalar(value: Json): string {
  // JSON.stringify 는 파이썬 repr 과 같은 최단 표기를 낸다(1e21 미만).
  return JSON.stringify(value);
}

function inline(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`;
  return scalar(value);
}

export function dumps(value: Json, level = 0): string {
  const pad = ' '.repeat(INDENT * level);
  const padIn = ' '.repeat(INDENT * (level + 1));
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (fitsInline(value)) {
      const one = inline(value);
      if (one.length + INDENT * level <= WIDTH) return one;
    }
    return `[\n${value.map((item) => `${padIn}${dumps(item, level + 1)}`).join(',\n')}\n${pad}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    const items = entries.map(
      ([key, item]) => `${padIn}${JSON.stringify(key)}: ${dumps(item, level + 1)}`,
    );
    return `{\n${items.join(',\n')}\n${pad}}`;
  }
  return scalar(value);
}

export function dumpsFile(value: unknown): string {
  return `${dumps(value as Json)}\n`;
}
