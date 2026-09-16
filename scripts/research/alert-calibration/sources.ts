/**
 * 시계열 소스 3종을 10분 격자 배열로 맞춘다. 원본 응답은 하루 단위로 `.cache/` 에만 저장한다.
 *
 * - 한강홍수통제소 10분 수위  `waterlevel/list/10M/{code}/{from}/{to}.json` → content[{ymdhm, wl(m), fw}] 내림차순
 * - 한강홍수통제소 10분 강우  `rainfall/list/10M/{code}/{from}/{to}.json`   → content[{ymdhm, rf(mm/10분)}]
 * - 기상청 API허브 AWS 매분   `nph-aws2_min?tm1&tm2&stn&disp=1`           → CSV (RN-DAY 누적을 10분 차분)
 */
import { cached } from './cache.ts';
import type { Keys } from './env.ts';
import { type Grid, formatYmdhm, parseYmdhm, toGridArray } from './grid.ts';
import { fetchJson, fetchText } from '../station-coverage/http.ts';
import { warn } from '../station-coverage/log.ts';

const HRFCO_GAP_MS = 80; // 분당 1,000건 제한의 1/10 수준
const KMA_GAP_MS = 150;

export type RainSourceKind = 'rain-hrfco' | 'rain-kma';

export interface RainGauge {
  kind: RainSourceKind;
  code: string;
  name: string;
  /** 계곡 기준 거리·표고차(R1 결과에서 옮겨 적음, 표 표시용) */
  note: string;
}

export interface WaterGauge {
  code: string;
  name: string;
  note: string;
}

interface HrfcoWlRow {
  ymdhm: string;
  wl: string;
}
interface HrfcoRfRow {
  ymdhm: string;
  rf: string;
}

const num = (s: string | undefined): number | null => {
  if (s === undefined) return null;
  const v = Number.parseFloat(s);
  return Number.isFinite(v) ? v : null;
};

async function hrfcoDay<T>(keys: Keys, kind: 'waterlevel' | 'rainfall', code: string, ymd: string): Promise<T[]> {
  return cached<T[]>(`hrfco/${kind}/${code}/${ymd}.json`, async () => {
    const from = `${ymd}0000`;
    const to = formatYmdhm(parseYmdhm(from) + 1440);
    const url = `https://api.hrfco.go.kr/${keys.hrfco}/${kind}/list/10M/${code}/${from}/${to}.json`;
    const j = await fetchJson<{ content?: T[] }>(url, keys, HRFCO_GAP_MS);
    return j.content ?? [];
  });
}

/** 한강홍수통제소 10분 수위(m). */
export async function loadHrfcoWaterlevel(keys: Keys, code: string, days: string[], grid: Grid): Promise<(number | null)[]> {
  const by = new Map<number, number | null>();
  for (const d of days) {
    for (const r of await hrfcoDay<HrfcoWlRow>(keys, 'waterlevel', code, d)) by.set(parseYmdhm(r.ymdhm), num(r.wl));
  }
  return toGridArray(grid, by);
}

/** 한강홍수통제소 10분 강우(mm/10분). */
export async function loadHrfcoRain(keys: Keys, code: string, days: string[], grid: Grid): Promise<(number | null)[]> {
  const by = new Map<number, number | null>();
  for (const d of days) {
    for (const r of await hrfcoDay<HrfcoRfRow>(keys, 'rainfall', code, d)) by.set(parseYmdhm(r.ymdhm), num(r.rf));
  }
  return toGridArray(grid, by);
}

/**
 * 기상청 AWS 매분자료. disp=1 CSV 컬럼(help=1 로 확인):
 * YYMMDDHHMI, STN, WD1, WS1, WDS, WSS, WD10, WS10, TA, RE, RN-15m, RN-60m, RN-12H, RN-DAY, HM, PA, PS, TD
 * 1분 강수 컬럼이 없어 RN-DAY(일 누적, mm — 00:00 행까지 전날 값, 00:01 에 0 으로 리셋) 를 누적 곡선으로 이어 붙인 뒤 10분 차분한다.
 * -50 이하는 결측.
 *
 * 함정: 하루치(1,440행) 요청은 ~25 s 걸리다가 서버가 **200 인 채로 중간에 끊는다**(610~1,440행, 종료 표식 `#7777END` 없음).
 * 6시간 조각은 2~3 s 에 완결되므로 6시간씩 받고 `#7777END` 가 없으면 다시 받는다. 요청 1건 = 한도 1건(20,000건/일).
 */
const AWS_CHUNK_HOURS = 6;

async function awsChunk(keys: Keys, stn: string, ymd: string, hh: number): Promise<string> {
  const h0 = String(hh).padStart(2, '0');
  const h1 = String(hh + AWS_CHUNK_HOURS - 1).padStart(2, '0');
  return cached<string>(`kma/aws/${stn}/${ymd}-${h0}.txt.json`, async () => {
    const url = `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min?tm1=${ymd}${h0}00&tm2=${ymd}${h1}59&stn=${stn}&disp=1&help=0&authKey=${keys.kma}`;
    let last = '';
    for (let attempt = 0; attempt < 4; attempt++) {
      last = await fetchText(url, keys, 'utf8', KMA_GAP_MS);
      if (last.includes('#7777END')) return last;
      warn(`AWS ${stn} ${ymd} ${h0}시 조각이 잘려 옴(${last.length} B) — 재시도 ${attempt + 1}`);
    }
    throw new Error(`AWS ${stn} ${ymd} ${h0}시 조각을 완결로 받지 못했다`);
  });
}

export async function loadAwsRain(keys: Keys, stn: string, days: string[], grid: Grid): Promise<(number | null)[]> {
  // 분 단위 RN-DAY
  const rnDay = new Map<number, number>();
  for (const d of days) {
    for (let hh = 0; hh < 24; hh += AWS_CHUNK_HOURS) {
      const text = await awsChunk(keys, stn, d, hh);
      for (const line of text.split('\n')) {
        if (!line || line.startsWith('#')) continue;
        const t = line.split(',');
        if (t.length < 14 || !/^\d{12}$/.test(t[0] ?? '')) continue;
        const v = Number(t[13]);
        if (!Number.isFinite(v) || v <= -50) continue;
        rnDay.set(parseYmdhm(t[0] ?? ''), v);
      }
    }
  }
  // 누적 곡선: 값이 뚝 떨어지면(일 경계 리셋) 직전 값을 오프셋에 더한다.
  const minutes = [...rnDay.keys()].sort((a, b) => a - b);
  const cum = new Map<number, number>();
  let offset = 0;
  let prev: number | undefined;
  for (const m of minutes) {
    const v = rnDay.get(m) ?? 0;
    if (prev !== undefined && v < prev - 0.05) offset += prev;
    cum.set(m, offset + v);
    prev = v;
  }
  // 10분 차분: 격자 시각 t 의 값 = cum(t) − cum(t−10). 각 끝점은 그 시각 이전 5분 안의 마지막 값으로 대신한다.
  const at = (m: number): number | undefined => {
    for (let k = 0; k < 5; k++) {
      const v = cum.get(m - k);
      if (v !== undefined) return v;
    }
    return undefined;
  };
  const by = new Map<number, number | null>();
  for (let i = 0; i < grid.n; i++) {
    const m = grid.start + i * 10;
    const a = at(m);
    const b = at(m - 10);
    by.set(m, a !== undefined && b !== undefined ? Math.max(0, Math.round((a - b) * 10) / 10) : null);
  }
  const missing = [...by.values()].filter((v) => v === null).length;
  if (missing) warn(`AWS ${stn}: 10분 격자 ${grid.n} 중 결측 ${missing}`);
  return toGridArray(grid, by);
}

export async function loadRain(keys: Keys, g: RainGauge, days: string[], grid: Grid): Promise<(number | null)[]> {
  return g.kind === 'rain-kma' ? loadAwsRain(keys, g.code, days, grid) : loadHrfcoRain(keys, g.code, days, grid);
}

/** 수위 관측소 제원의 4단계(m). R1 캐시 `hrfco-waterlevel-info.json` 을 그대로 쓴다(없으면 다시 받는다). */
export interface WaterStages {
  attwl: number | null;
  wrnwl: number | null;
  almwl: number | null;
  srswl: number | null;
  gdt: number | null;
}

interface WlInfoRow {
  wlobscd: string;
  obsnm: string;
  attwl?: string;
  wrnwl?: string;
  almwl?: string;
  srswl?: string;
  gdt?: string;
}

export async function loadWaterStages(keys: Keys, code: string): Promise<WaterStages & { name: string }> {
  const rows = await cached<WlInfoRow[]>('hrfco-waterlevel-info.json', async () => {
    const j = await fetchJson<{ content: WlInfoRow[] }>(`https://api.hrfco.go.kr/${keys.hrfco}/waterlevel/info.json`, keys);
    return j.content;
  });
  const r = rows.find((x) => x.wlobscd === code);
  if (!r) throw new Error(`수위 관측소 제원에 ${code} 가 없다`);
  return { name: r.obsnm.trim(), attwl: num(r.attwl), wrnwl: num(r.wrnwl), almwl: num(r.almwl), srswl: num(r.srswl), gdt: num(r.gdt) };
}
