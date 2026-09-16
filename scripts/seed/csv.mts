/**
 * 작은 CSV 파서 — RFC 4180 따옴표·줄바꿈 처리, BOM 제거, EUC-KR 감지.
 * `data/seed/*.csv`(수기 입력)과 data.go.kr 표준데이터 CSV 를 읽는다.
 */
import fs from 'node:fs';

export type CsvRow = Readonly<Record<string, string>>;

function decode(bytes: Buffer): string {
  // UTF-8 BOM 이면 UTF-8. 아니면 UTF-8 로 시도해 대체 문자(U+FFFD)가 나오면 EUC-KR(표준데이터는 대개 CP949).
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    return bytes.subarray(3).toString('utf8');
  const utf8 = bytes.toString('utf8');
  if (!utf8.includes('�')) return utf8;
  return new TextDecoder('euc-kr').decode(bytes);
}

export function parseCsv(text: string): { header: string[]; rows: CsvRow[] } {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] as string;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      record.push(field);
      field = '';
      records.push(record);
      record = [];
    } else field += char;
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  const header = (records.shift() ?? []).map((name) => name.trim());
  const rows = records
    .filter((cells) => cells.some((cell) => cell.trim().length > 0))
    .map((cells) => {
      const row: Record<string, string> = {};
      header.forEach((name, index) => {
        row[name] = (cells[index] ?? '').trim();
      });
      return row;
    });
  return { header, rows };
}

export function readCsv(file: string): { header: string[]; rows: CsvRow[] } {
  if (!fs.existsSync(file)) return { header: [], rows: [] };
  return parseCsv(decode(fs.readFileSync(file)));
}

/** 헤더 이름에 `needle` 이 포함된 첫 열. 표준데이터의 열 이름 변형(공백·괄호)에 견디게. */
export function findColumn(
  header: readonly string[],
  ...needles: readonly string[]
): string | undefined {
  for (const needle of needles) {
    const hit = header.find((name) => name.replace(/\s+/g, '').includes(needle));
    if (hit !== undefined) return hit;
  }
  return undefined;
}
