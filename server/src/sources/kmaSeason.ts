/**
 * 기상청 API허브 계절관측 파서 — `sfc_ssn.php`(관측) · `sfc_ssn_norm.php`(평년).
 *
 * 문서(apihub K 계절관측): 요청 `stn`(관서지점, 0 = 전체) · `tm1`/`tm2`(YYYYMMDD) · `ssn`(계절관측 코드).
 * 응답 컬럼: `YY STN TM SSN_ID SSN_MD`. 코드표(SSN_ID.pdf · SSN_MD.pdf):
 *   SSN_ID 302 단풍나무 · 501 유명산 단풍  /  SSN_MD 301 단풍 시작 · 302 단풍 절정 · 303 단풍 끝 ·
 *   304 낙엽 시작 · 305 낙엽 끝 · (유명산) 501 단풍시작 · 503 단풍절정.
 * typ01 계열은 `#` 주석 + 공백(또는 쉼표) 구분이라 둘 다 받는다. 결측·형식 오류 행은 버린다.
 *
 * 실측 전(활용신청 대기)이라 컬럼 순서는 문서 기준이다 — 첫 실호출 때 `help=1` 응답으로 확인한다.
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

const ymd = (t: string): string | null =>
  /^\d{8}$/.test(t) ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}` : null;

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

/**
 * 평년 행 — 문서에 컬럼이 없어 두 모양을 받는다: `STN SSN_ID SSN_MD MMDD` 또는 관측과 같은
 * `YY STN TM(YYYYMMDD 또는 MMDD) SSN_ID SSN_MD`. 날짜는 월일만 남긴다.
 */
export function parseSeasonNorm(text: string): SeasonNormRecord[] {
  const out: SeasonNormRecord[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const t = tokens(line);
    let stn: string | undefined;
    let date: string | undefined;
    let ssnId: number;
    let ssnMd: number;
    if (t.length >= 5) {
      [, stn, date] = t;
      ssnId = Number(t[3]);
      ssnMd = Number(t[4]);
    } else if (t.length === 4) {
      [stn, , , date] = t;
      ssnId = Number(t[1]);
      ssnMd = Number(t[2]);
    } else continue;
    const digits = (date ?? '').replace(/\D/g, '');
    const md =
      digits.length === 8
        ? `${digits.slice(4, 6)}-${digits.slice(6, 8)}`
        : digits.length === 4
          ? `${digits.slice(0, 2)}-${digits.slice(2, 4)}`
          : null;
    if (!stn || !/^\d+$/.test(stn) || !md || !Number.isInteger(ssnId) || !Number.isInteger(ssnMd))
      continue;
    out.push({ stn, ssnId, ssnMd, mmdd: md });
  }
  return out;
}
