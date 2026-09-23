/**
 * 기상청 API허브 계절관측 파서 — `sfc_ssn.php`(관측) · `sfc_ssn_norm.php`(평년).
 *
 * 문서(apihub K 계절관측): 요청 `stn`(관서지점, 0 = 전체) · `tm1`/`tm2`(YYYYMMDD) · `ssn`(계절관측 코드).
 * 응답(실측 2026-09-23, 쉼표 구분·행 끝 `,`): 관측 `YY, STN, TM(YYYY-MM-DD), SSN_ID, SSN_MD,` ·
 * 평년 `ST, STN, MM, DD, SSN_ID, SSN_MD,=`(ST = 평년 기준기간 시작연도, 2021 = 1991~2020).
 * 유명산(501)도 관서 지점번호로 적힌다(90 속초=설악산, 108 서울=북한산, 156 광주=무등산 …).
 * 코드표(SSN_ID.pdf · SSN_MD.pdf):
 *   SSN_ID 302 단풍나무 · 501 유명산 단풍  /  SSN_MD 301 단풍 시작 · 302 단풍 절정 · 303 단풍 끝 ·
 *   304 낙엽 시작 · 305 낙엽 끝 · (유명산) 501 단풍시작 · 503 단풍절정.
 * `#` 주석 행은 건너뛰고 공백·쉼표를 모두 구분자로 본다. 결측·형식 오류 행은 버린다.
 */
import { KMA_APIHUB_ORIGIN } from './kmaAws';

export const SSN_MAPLE = 302;
export const SSN_FAMOUS_MOUNTAIN = 501;
export const SSN_IDS = [SSN_MAPLE, SSN_FAMOUS_MOUNTAIN] as const;

export interface SeasonObsRecord {
  readonly stn: string;
  /** KST `YYYY-MM-DD`. */
  readonly tm: string;
  readonly ssnId: number;
  readonly ssnMd: number;
}

export interface SeasonNormRecord {
  readonly stn: string;
  readonly ssnId: number;
  readonly ssnMd: number;
  /** `MM-DD`. */
  readonly mmdd: string;
}

export function seasonObsUrl(key: string, tm1: string, tm2: string, ssn: number): string {
  return `${KMA_APIHUB_ORIGIN}/api/typ01/url/sfc_ssn.php?stn=0&tm1=${tm1}&tm2=${tm2}&ssn=${ssn}&help=0&authKey=${key}`;
}

export function seasonNormUrl(key: string, ssn: number): string {
  return `${KMA_APIHUB_ORIGIN}/api/typ01/url/sfc_ssn_norm.php?stn=0&MM1=1&DD1=1&MM2=12&DD2=31&ssn=${ssn}&help=0&authKey=${key}`;
}

function tokens(line: string): string[] {
  return line
    .replace(/,?=\s*$/, '')
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

const ymd = (t: string): string | null => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return /^\d{8}$/.test(t) ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}` : null;
};

/** `YY STN TM SSN_ID SSN_MD` 행. */
export function parseSeasonObs(text: string): SeasonObsRecord[] {
  const out: SeasonObsRecord[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const t = tokens(line);
    if (t.length < 5) continue;
    const tm = ymd(t[2] ?? '');
    const ssnId = Number(t[3]);
    const ssnMd = Number(t[4]);
    if (!tm || !/^\d+$/.test(t[1] ?? '') || !Number.isInteger(ssnId) || !Number.isInteger(ssnMd))
      continue;
    out.push({ stn: t[1] as string, tm, ssnId, ssnMd });
  }
  return out;
}

/** 평년 행 `ST STN MM DD SSN_ID SSN_MD`. 월일은 `MM-DD` 두 자리로 맞춘다. */
export function parseSeasonNorm(text: string): SeasonNormRecord[] {
  const out: SeasonNormRecord[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const t = tokens(line);
    if (t.length < 6) continue;
    const [, stn, mm, dd, id, md] = t as [string, string, string, string, string, string];
    const ssnId = Number(id);
    const ssnMd = Number(md);
    if (!/^\d+$/.test(stn) || !/^\d{1,2}$/.test(mm) || !/^\d{1,2}$/.test(dd)) continue;
    if (!Number.isInteger(ssnId) || !Number.isInteger(ssnMd)) continue;
    out.push({ stn, ssnId, ssnMd, mmdd: `${mm.padStart(2, '0')}-${dd.padStart(2, '0')}` });
  }
  return out;
}
