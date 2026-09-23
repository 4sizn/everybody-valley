/**
 * 행정안전부 전국어린이놀이시설정보서비스(data.go.kr 15124519, `pfc3/getPfctInfo3`) 전수 내려받기
 * → `data/seed/std/전국어린이놀이시설정보.csv` (gitignore). `facilities.mts` 가 `*놀이시설*.csv` 로 읽는다.
 *
 * 왜 API 인가: 도시공원 표준데이터의 유희시설 열은 공원 안 놀이터만 담고, 이 API 는 야영장·유원지·
 * 식당 등 설치장소유형까지 있어 계곡 옆 놀이터를 잡는다. 지역 필터 파라미터가 없고 `numOfRows` 가
 * 10 으로 막혀 있어(2026-09-23 실측) 전수 = 약 8,500 회 요청 — 개발계정 한도 10,000/일 이라 **하루 한 번**.
 * 동시 4 요청, 실패 페이지는 `http.mts` 재시도 뒤 건너뛰고 끝에 개수를 알린다.
 *
 *   pnpm seed:playgrounds
 *
 * 출처: 공공데이터포털 행정안전부_전국어린이놀이시설정보서비스(이용허락범위 제한 없음). 좌표 열 lotCrtsVl(경도)·latCrtsVl(위도).
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadKeys, STD_DIR } from './env.mts';
import { fetchJson } from './http.mts';
import { log, warn } from './log.mts';

const ENDPOINT = 'https://apis.data.go.kr/1741000/pfc3/getPfctInfo3';
const PER_PAGE = 10;
const CONCURRENCY = 4;
export const PLAYGROUNDS_FILE = path.join(STD_DIR, '전국어린이놀이시설정보.csv');

/** 쓰는 열(한글 이름 → 응답 키). `facilities.mts` 는 한글 이름으로 찾는다. */
const COLUMNS: readonly [string, string][] = [
  ['놀이시설명', 'pfctNm'],
  ['설치장소유형', 'instlPlaceCdNm'],
  ['운영여부', 'operYnCdNm'],
  ['실내외', 'idrodrCdNm'],
  ['소재지도로명주소', 'ronaAddr'],
  ['소재지지번주소', 'lotnoAddr'],
  ['위도', 'latCrtsVl'],
  ['경도', 'lotCrtsVl'],
  ['설치일', 'instlYmd'],
  ['시설번호', 'pfctSn'],
];

interface Body {
  response: {
    body: { totalCnt: number; totalPageCnt: number; items: Record<string, unknown>[] };
  };
}

function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? '' : String(value).trim();
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function main(): Promise<void> {
  const keys = loadKeys();
  if (!keys.dataGoKr) throw new Error('DATA_GO_KR_KEY_ENCODING 이 없다');
  const url = (page: number): string =>
    `${ENDPOINT}?serviceKey=${keys.dataGoKr}&type=json&numOfRows=${PER_PAGE}&pageNo=${page}`;
  const first = await fetchJson<Body>(url(1), keys, 0);
  const pages = first.response.body.totalPageCnt;
  log(`놀이시설 ${first.response.body.totalCnt}건 · ${pages}페이지`);
  const rows: Record<string, unknown>[][] = [first.response.body.items];
  const failed: number[] = [];
  let next = 2;
  const worker = async (): Promise<void> => {
    while (next <= pages) {
      const page = next++;
      try {
        rows[page - 1] = (await fetchJson<Body>(url(page), keys, 0)).response.body.items;
      } catch (error) {
        failed.push(page);
        warn(`${page}페이지 실패: ${(error as Error).message.slice(0, 120)}`);
      }
      if (page % 500 === 0) log(`  ${page}/${pages}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const lines = [COLUMNS.map(([kr]) => kr).join(',')];
  for (const items of rows)
    for (const item of items ?? [])
      lines.push(COLUMNS.map(([, key]) => csvCell(item[key])).join(','));
  fs.mkdirSync(STD_DIR, { recursive: true });
  fs.writeFileSync(PLAYGROUNDS_FILE, `﻿${lines.join('\n')}\n`, 'utf8');
  log(
    `${lines.length - 1}행 → ${PLAYGROUNDS_FILE}${failed.length ? ` (실패 ${failed.length}페이지: ${failed.slice(0, 10).join(',')})` : ''}`,
  );
}

main().catch((error) => {
  warn((error as Error).message);
  process.exitCode = 1;
});
