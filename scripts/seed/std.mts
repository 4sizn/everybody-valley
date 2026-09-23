/**
 * data.go.kr 표준데이터 내려받기 — 전국주차장정보 · 전국공중화장실 → `data/seed/std/*.csv` (gitignore).
 *
 * 표준데이터 페이지의 "CSV 다운로드" 버튼은 서버 파일을 주지 않는다. 페이지 스크립트
 * (`/js/biz/mvc/std/std-download-manager.js`)가 두 JSON 엔드포인트를 불러 브라우저에서 CSV 를 조립한다:
 *   GET /download/columList.json?pk=<pk>&ext=CSV                        → 열 목록(한글·영문)·totalCount·svcTableNm
 *   GET /download/standard.json?publicDataPk=<pk>&colNmList=…&perPage=10000&page=n → 행(영문 열 키)
 * 둘 다 로그인 없이 응답한다(2026-09-06 실측, Orca 브라우저에서 확인). 여기서는 같은 요청을 Node 로 하고
 * UTF-8(BOM) CSV 로 쓴다 — `facilities.mts` 가 한글 열 이름으로 읽는다.
 *
 *   pnpm seed:std            # 네 데이터셋 모두
 *   pnpm seed:std parking    # 하나만 (parking | restroom | bin | park) — bin 휴지통, park 도시공원(유희시설=놀이터)
 *
 * 출처: 공공데이터포털 표준데이터(공공누리 1유형 — 출처표시). 요청 간 1 s.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadKeys, STD_DIR } from './env.mts';
import { fetchJson, sleep } from './http.mts';
import { log } from './log.mts';

const ORIGIN = 'https://www.data.go.kr';
const PER_PAGE = 10_000;
const GAP_MS = 1000;

interface StdDataset {
  readonly key: 'parking' | 'restroom' | 'bin' | 'park';
  readonly pk: string;
  /** 파일명에 들어가는 단어 — `facilities.mts` 가 `*주차장*.csv`·`*화장실*.csv` 로 찾는다. */
  readonly fileName: string;
}

export const STD_DATASETS: readonly StdDataset[] = [
  { key: 'parking', pk: '15012896', fileName: '전국주차장정보표준데이터' },
  { key: 'restroom', pk: '15012892', fileName: '전국공중화장실표준데이터' },
  { key: 'bin', pk: '15129450', fileName: '전국휴지통표준데이터' },
  { key: 'park', pk: '15012890', fileName: '전국도시공원정보표준데이터' },
];

interface ColumnList {
  fileName: string;
  totalCount: number;
  columList: { columNm: string; columCode: string }[];
  tableVO: { colNmList: string[]; svcTableNm: string };
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function download(
  dataset: StdDataset,
): Promise<{ rows: number; withCoordinates: number; file: string }> {
  const keys = loadKeys();
  const referer = `${ORIGIN}/data/${dataset.pk}/standard.do`;
  const headers = {
    'user-agent': 'Mozilla/5.0 modu-valley-seed',
    referer,
    accept: 'application/json',
  };
  const header = await fetchJson<ColumnList>(
    `${ORIGIN}/download/columList.json?pk=${dataset.pk}&ext=CSV`,
    keys,
    GAP_MS,
    { headers },
  );
  const pages = Math.ceil(header.totalCount / PER_PAGE);
  const columnsKr = header.columList.map((column) => column.columNm);
  const columnsEn = header.columList.map((column) => column.columCode);
  const lines = [columnsKr.map(csvCell).join(',')];
  let withCoordinates = 0;
  const latIndex = columnsKr.indexOf('위도');
  for (let page = 1; page <= pages; page += 1) {
    const params = new URLSearchParams([
      ['publicDataPk', dataset.pk],
      ...header.tableVO.colNmList.map((column): [string, string] => ['colNmList', column]),
      ['totalCount', String(header.totalCount)],
      ['svcTableNm', header.tableVO.svcTableNm],
      ['perPage', String(PER_PAGE)],
      ['page', String(page)],
    ]);
    const rows = await fetchJson<Record<string, unknown>[]>(
      `${ORIGIN}/download/standard.json?${params.toString()}`,
      keys,
      GAP_MS,
      { headers },
    );
    for (const row of rows) {
      lines.push(columnsEn.map((column) => csvCell(row[column])).join(','));
      const lat = latIndex < 0 ? undefined : row[columnsEn[latIndex] as string];
      if (lat !== undefined && lat !== null && lat !== '' && lat !== '0') withCoordinates += 1;
    }
    log(`  ${dataset.fileName} ${page}/${pages} — ${rows.length}행`);
    await sleep(GAP_MS);
  }
  fs.mkdirSync(STD_DIR, { recursive: true });
  const file = path.join(STD_DIR, `${dataset.fileName}.csv`);
  fs.writeFileSync(file, `﻿${lines.join('\n')}\n`, 'utf8');
  return { rows: lines.length - 1, withCoordinates, file };
}

async function main(): Promise<void> {
  const only = process.argv.slice(2).filter((argument) => !argument.startsWith('--'));
  const targets = STD_DATASETS.filter((dataset) => only.length === 0 || only.includes(dataset.key));
  for (const dataset of targets) {
    const result = await download(dataset);
    log(
      `${dataset.fileName}: ${result.rows}행(좌표 있음 ${result.withCoordinates}) → ${result.file}`,
    );
  }
}

await main();
