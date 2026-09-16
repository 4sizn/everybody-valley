/**
 * 시각 변환. 정부 API 는 KST `YYYYMMDDHHmm` 로 말하고, DB·응답은 ISO 8601 UTC 로 통일한다.
 * 프로세스 타임존에 의존하지 않도록 직접 계산한다(KST = UTC+9, DST 없음).
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const YMDHM = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/;

/** `202609061310`(KST) → `2026-09-06T04:10:00.000Z`. 형식이 아니면 undefined. */
export function kstYmdhmToIso(ymdhm: string): string | undefined {
  const m = YMDHM.exec(ymdhm.trim());
  if (!m) return undefined;
  const [, y, mo, d, h, mi] = m;
  const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)) - KST_OFFSET_MS;
  if (!Number.isFinite(utc)) return undefined;
  return new Date(utc).toISOString();
}

/** epoch ms → KST `YYYYMMDDHHmm`. API 요청 파라미터용. */
export function toKstYmdhm(epochMs: number): string {
  const d = new Date(epochMs + KST_OFFSET_MS);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}

/** ISO 시각이 10분 격자 위에 있는가(분이 10 의 배수, 초 0). */
export function isTenMinuteMark(iso: string): boolean {
  const d = new Date(iso);
  return d.getUTCMinutes() % 10 === 0 && d.getUTCSeconds() === 0;
}
