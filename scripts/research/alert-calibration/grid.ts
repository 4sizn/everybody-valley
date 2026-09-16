/**
 * 10분 격자 시각. 모든 시각은 KST 문자열 `YYYYMMDDHHmm` 을 UTC 로 간주해 "분 단위 정수" 로 다룬다
 * (시간대 변환 없음 — 두 기관 자료 모두 KST 라 상대 계산만 필요하다).
 */

export const STEP_MIN = 10;

export function parseYmdhm(s: string): number {
  const y = Number(s.slice(0, 4));
  const mo = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  const h = Number(s.slice(8, 10));
  const mi = Number(s.slice(10, 12));
  return Date.UTC(y, mo - 1, d, h, mi) / 60_000;
}

export function formatYmdhm(minute: number): string {
  const d = new Date(minute * 60_000);
  const p = (n: number, w = 2): string => String(n).padStart(w, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}

/** 사람이 읽는 `07-14 03:20` 꼴. */
export function formatShort(minute: number): string {
  const s = formatYmdhm(minute);
  return `${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}`;
}

export function formatDate(minute: number): string {
  const s = formatYmdhm(minute);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** `YYYYMMDD` 하루 목록(양끝 포함). */
export function dayList(fromYmd: string, toYmd: string): string[] {
  const out: string[] = [];
  let m = parseYmdhm(`${fromYmd}0000`);
  const end = parseYmdhm(`${toYmd}0000`);
  for (; m <= end; m += 1440) out.push(formatYmdhm(m).slice(0, 8));
  return out;
}

/** 분석 구간의 10분 격자. index i ↔ 시각 start + 10·i. */
export interface Grid {
  start: number;
  n: number;
}

export function makeGrid(fromYmd: string, toYmdExclusive: string): Grid {
  const start = parseYmdhm(`${fromYmd}0000`);
  const end = parseYmdhm(`${toYmdExclusive}0000`);
  return { start, n: Math.floor((end - start) / STEP_MIN) + 1 };
}

export const gridIndex = (g: Grid, minute: number): number => Math.round((minute - g.start) / STEP_MIN);
export const gridMinute = (g: Grid, i: number): number => g.start + i * STEP_MIN;

/** 분 단위 시계열(Map)을 10분 격자 배열로. 격자에 없는 시각은 null. */
export function toGridArray(g: Grid, byMinute: Map<number, number | null>): (number | null)[] {
  const out: (number | null)[] = new Array<number | null>(g.n).fill(null);
  for (const [m, v] of byMinute) {
    const i = gridIndex(g, m);
    if (i >= 0 && i < g.n && (m - g.start) % STEP_MIN === 0) out[i] = v;
  }
  return out;
}
