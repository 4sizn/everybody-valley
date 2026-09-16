/**
 * 강우 이벤트 추출 · 경계값 도달 · 하류 수위 반응 · 리드타임 · 혼동행렬 · 해제 규칙 시뮬레이션.
 * 입력은 전부 10분 격자 배열(`grid.ts`). 시각은 격자 index 로만 다루고 출력 직전에 문자열로 바꾼다.
 */

export type StageId = 'attention' | 'caution' | 'alert' | 'severe';

/** OR 조건: 나열된 창 중 하나라도 넘으면 도달. F3_ALERT_DESIGN §1.2 강우 4단계. */
export interface RainThreshold {
  r10?: number;
  r60?: number;
  r180?: number;
}

export const STAGES: Record<StageId, RainThreshold> = {
  attention: { r10: 3, r60: 10 },
  caution: { r10: 5, r60: 20 },
  alert: { r60: 30, r180: 60 },
  severe: { r60: 50, r180: 90 },
};

export const STAGE_LABEL: Record<StageId, string> = { attention: '관심', caution: '주의', alert: '경계', severe: '심각' };

/** 혼동행렬용 임계값 변형 — 단계 원안 + 창 하나씩 떼어 본 것. */
export interface Variant {
  id: string;
  label: string;
  th: RainThreshold;
}

export const VARIANTS: Variant[] = [
  { id: 'attention', label: '관심 (10분 3 ∨ 1h 10)', th: STAGES.attention },
  { id: 'attention-10m', label: '관심 · 10분 3 만', th: { r10: 3 } },
  { id: 'attention-1h', label: '관심 · 1h 10 만', th: { r60: 10 } },
  { id: 'caution', label: '주의 (10분 5 ∨ 1h 20)', th: STAGES.caution },
  { id: 'caution-10m', label: '주의 · 10분 5 만', th: { r10: 5 } },
  { id: 'caution-1h', label: '주의 · 1h 20 만', th: { r60: 20 } },
  { id: 'alert', label: '경계 (1h 30 ∨ 3h 60)', th: STAGES.alert },
  { id: 'alert-1h', label: '경계 · 1h 30 만', th: { r60: 30 } },
  { id: 'alert-3h', label: '경계 · 3h 60 만', th: { r180: 60 } },
  { id: 'severe', label: '심각 (1h 50 ∨ 3h 90)', th: STAGES.severe },
];

export type Series = (number | null)[];

/** 뒤쪽 k칸 합. 창 안이 전부 null 이면 null, 일부 결측은 있는 값만 더한다(결측 = 0 취급). */
export function rollingSum(a: Series, k: number): Series {
  const out: Series = new Array<number | null>(a.length).fill(null);
  let sum = 0;
  let cnt = 0;
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    if (v !== null && v !== undefined) {
      sum += v;
      cnt++;
    }
    const j = i - k;
    if (j >= 0) {
      const w = a[j];
      if (w !== null && w !== undefined) {
        sum -= w;
        cnt--;
      }
    }
    out[i] = cnt > 0 ? Math.round(sum * 10) / 10 : null;
  }
  return out;
}

export interface RainSeries {
  r10: Series;
  r60: Series;
  r180: Series;
}

export const deriveRain = (r10: Series): RainSeries => ({ r10, r60: rollingSum(r10, 6), r180: rollingSum(r10, 18) });

const meets = (rs: RainSeries, i: number, th: RainThreshold): boolean =>
  (th.r10 !== undefined && (rs.r10[i] ?? 0) >= th.r10) ||
  (th.r60 !== undefined && (rs.r60[i] ?? 0) >= th.r60) ||
  (th.r180 !== undefined && (rs.r180[i] ?? 0) >= th.r180);

/** [from, to] 안에서 처음 도달한 index. */
function firstMeet(rs: RainSeries, th: RainThreshold, from: number, to: number): number | null {
  for (let i = Math.max(0, from); i <= Math.min(to, rs.r10.length - 1); i++) if (meets(rs, i, th)) return i;
  return null;
}

export interface RainEvent {
  /** 첫 10분 ≥ 1 mm(없으면 첫 강우) */
  startIdx: number;
  firstWetIdx: number;
  /** 마지막 강우 칸 */
  endIdx: number;
  totalMm: number;
  maxR10: number;
  maxR60: number;
  maxR180: number;
  /** 단계·변형별 첫 도달 index(이벤트 시작 ~ 끝+3h) */
  stageIdx: Record<StageId, number | null>;
  variantIdx: Record<string, number | null>;
}

const DRY_GAP = 36; // 6시간 = 36칸
const WET = 0.05;

/**
 * 강우 이벤트: 강우 칸을 6시간 무강우로 끊어 묶고, 총량 ≥ minTotal 인 것만. 결측은 무강우로 본다.
 * "사례" (1h 합 ≥ 10 mm) 는 stageIdx.attention !== null 로 구분한다.
 */
export function extractEvents(rs: RainSeries, minTotalMm = 3): RainEvent[] {
  const r10 = rs.r10;
  const events: RainEvent[] = [];
  let i = 0;
  while (i < r10.length) {
    if ((r10[i] ?? 0) < WET) {
      i++;
      continue;
    }
    const firstWet = i;
    let lastWet = i;
    let j = i + 1;
    while (j < r10.length && j - lastWet <= DRY_GAP) {
      if ((r10[j] ?? 0) >= WET) lastWet = j;
      j++;
    }
    let total = 0;
    let maxR10 = 0;
    let maxR60 = 0;
    let maxR180 = 0;
    let start = -1;
    for (let k = firstWet; k <= lastWet; k++) {
      const v = r10[k] ?? 0;
      total += v;
      if (v > maxR10) maxR10 = v;
      if (start < 0 && v >= 1) start = k;
    }
    const tail = Math.min(r10.length - 1, lastWet + 18);
    for (let k = firstWet; k <= tail; k++) {
      maxR60 = Math.max(maxR60, rs.r60[k] ?? 0);
      maxR180 = Math.max(maxR180, rs.r180[k] ?? 0);
    }
    if (total >= minTotalMm) {
      const stageIdx = Object.fromEntries(
        (Object.keys(STAGES) as StageId[]).map((s) => [s, firstMeet(rs, STAGES[s], firstWet, tail)]),
      ) as Record<StageId, number | null>;
      const variantIdx = Object.fromEntries(VARIANTS.map((v) => [v.id, firstMeet(rs, v.th, firstWet, tail)]));
      events.push({
        startIdx: start >= 0 ? start : firstWet,
        firstWetIdx: firstWet,
        endIdx: lastWet,
        totalMm: Math.round(total * 10) / 10,
        maxR10,
        maxR60,
        maxR180,
        stageIdx,
        variantIdx,
      });
    }
    i = lastWet + 1;
  }
  return events;
}

export interface WaterStagesM {
  attwl: number | null;
  wrnwl: number | null;
  almwl: number | null;
  srswl: number | null;
}

export interface WaterResponse {
  /** 이벤트 시작 전 1시간 최저 수위(m) */
  baselineWl: number | null;
  /** 첫 10분 Δ ≥ +5 cm (이벤트 시작 1시간 전 ~ 끝 + 6시간) */
  reactIdx: number | null;
  /** 기저 대비 누적 +10 cm 첫 시각 — 느리게 오르는 큰 하천용 보조 반응 정의 */
  reactCumIdx: number | null;
  peakIdx: number | null;
  peakWl: number | null;
  riseM: number | null;
  maxDelta10M: number | null;
  /** 관측소 4단계 중 도달한 최고 단계와 관심(attwl) 첫 도달 index */
  stageReached: 'none' | StageId;
  attwlIdx: number | null;
  /** 이벤트 창 어디서든 2시간 안 +10 cm 상승이 있었는가(미경보 판정용 정답) */
  rise2hAny: boolean;
  /** 창 안 수위 결측 비율 */
  missingRatio: number;
}

const AFTER = 36; // 이벤트 끝 + 6시간
const BEFORE = 6; // 시작 1시간 전

export function windowOf(ev: RainEvent, n: number): [number, number] {
  return [Math.max(0, ev.startIdx - BEFORE), Math.min(n - 1, ev.endIdx + AFTER)];
}

function lastKnown(wl: Series, i: number, back = 3): number | null {
  for (let k = 0; k <= back && i - k >= 0; k++) {
    const v = wl[i - k];
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

export function waterResponse(ev: RainEvent, wl: Series, stages: WaterStagesM): WaterResponse {
  const [w0, w1] = windowOf(ev, wl.length);
  let baseline: number | null = null;
  for (let i = w0; i <= ev.startIdx; i++) {
    const v = wl[i];
    if (v !== null && v !== undefined && (baseline === null || v < baseline)) baseline = v;
  }
  let reactIdx: number | null = null;
  let reactCumIdx: number | null = null;
  let peakIdx: number | null = null;
  let peakWl: number | null = null;
  let maxDelta: number | null = null;
  let missing = 0;
  let attwlIdx: number | null = null;
  let rise2hAny = false;
  for (let i = w0; i <= w1; i++) {
    const v = wl[i];
    if (v === null || v === undefined) {
      missing++;
      continue;
    }
    const prev = lastKnown(wl, i - 1, 0);
    if (prev !== null) {
      const d = v - prev;
      if (maxDelta === null || d > maxDelta) maxDelta = d;
      if (reactIdx === null && d >= 0.05 - 1e-9) reactIdx = i;
    }
    if (reactCumIdx === null && baseline !== null && v - baseline >= 0.1 - 1e-9) reactCumIdx = i;
    if (peakWl === null || v > peakWl) {
      peakWl = v;
      peakIdx = i;
    }
    if (attwlIdx === null && stages.attwl !== null && v >= stages.attwl) attwlIdx = i;
    // 2시간 창 최저 대비 +10 cm
    let lo = v;
    for (let k = Math.max(w0, i - 12); k < i; k++) {
      const u = wl[k];
      if (u !== null && u !== undefined && u < lo) lo = u;
    }
    if (v - lo >= 0.1 - 1e-9) rise2hAny = true;
  }
  let stageReached: WaterResponse['stageReached'] = 'none';
  if (peakWl !== null) {
    for (const s of ['attention', 'caution', 'alert', 'severe'] as StageId[]) {
      const th = stages[s === 'attention' ? 'attwl' : s === 'caution' ? 'wrnwl' : s === 'alert' ? 'almwl' : 'srswl'];
      if (th !== null && peakWl >= th) stageReached = s;
    }
  }
  return {
    baselineWl: baseline,
    reactIdx,
    reactCumIdx,
    peakIdx,
    peakWl,
    riseM: baseline !== null && peakWl !== null ? Math.round((peakWl - baseline) * 100) / 100 : null,
    maxDelta10M: maxDelta === null ? null : Math.round(maxDelta * 100) / 100,
    stageReached,
    attwlIdx,
    rise2hAny,
    missingRatio: Math.round((missing / (w1 - w0 + 1)) * 100) / 100,
  };
}

/** 경보 시각 a 뒤 2시간 안에 +10 cm 이상 올랐는가(정답). */
export function roseAfter(wl: Series, a: number, hours = 2, cm = 10): boolean | null {
  const base = lastKnown(wl, a);
  if (base === null) return null;
  const to = Math.min(wl.length - 1, a + hours * 6);
  for (let i = a + 1; i <= to; i++) {
    const v = wl[i];
    if (v !== null && v !== undefined && v - base >= cm / 100 - 1e-9) return true;
  }
  return false;
}

export type Outcome = 'TP' | 'FP' | 'LATE' | 'FN' | 'TN';

export function classify(fired: number | null, wl: Series, resp: WaterResponse): Outcome {
  if (fired === null) return resp.rise2hAny ? 'FN' : 'TN';
  const rose = roseAfter(wl, fired);
  if (rose) return 'TP';
  return resp.rise2hAny ? 'LATE' : 'FP';
}

/** 보조 정답 = 이벤트 창 안 총 상승(피크 − 기저) ≥ 10 cm. 2시간 창 조건이 없어 느린 상승도 정답으로 센다. */
export function classifyTotal(fired: number | null, resp: WaterResponse): Outcome {
  const rose = (resp.riseM ?? 0) >= 0.1 - 1e-9;
  if (fired === null) return rose ? 'FN' : 'TN';
  return rose ? 'TP' : 'FP';
}

export interface Confusion {
  TP: number;
  FP: number;
  LATE: number;
  FN: number;
  TN: number;
}

export const emptyConfusion = (): Confusion => ({ TP: 0, FP: 0, LATE: 0, FN: 0, TN: 0 });

export interface ReleaseSim {
  /** 해제 규칙이 처음 성립한 index(경보 뒤 12시간 안). null 이면 창 안에 해제 없음 */
  releaseIdx: number | null;
  /** 해제 뒤 최고 수위 − 해제 시 수위 (m). ≥ 0.10 이면 "피크 전 해제" */
  reRiseM: number | null;
  beforePeak: boolean;
}

export type ReleaseMode = 'rule' | 'rainOnly' | 'strict';

/**
 * 해제 규칙(§1.2): 강우 < 관심 30분 연속 ∧ 수위 하강 60분 연속(`rule`). `rainOnly` 는 강우 조건만(비교용),
 * `strict` 는 여기에 3h 합 < 20 mm 를 더한 강화안(긴 다중 강우 사례의 조기 해제 대책 후보).
 */
export function simulateRelease(
  ev: RainEvent,
  alertIdx: number,
  rs: RainSeries,
  wl: Series,
  resp: WaterResponse,
  mode: ReleaseMode,
): ReleaseSim {
  const needWaterFall = mode !== 'rainOnly';
  const [, w1] = windowOf(ev, wl.length);
  const limit = Math.min(wl.length - 1, ev.endIdx + 72);
  const calm = (i: number): boolean => {
    for (let k = i - 2; k <= i; k++) {
      if (k < 0 || meets(rs, k, STAGES.attention)) return false;
      if (mode === 'strict' && (rs.r180[k] ?? 0) >= 20) return false;
    }
    return true;
  };
  const falling = (i: number): boolean => {
    for (let k = i - 5; k <= i; k++) {
      const a = wl[k];
      const b = wl[k - 1];
      if (k - 1 < 0 || a === null || a === undefined || b === null || b === undefined || a > b) return false;
    }
    const first = wl[i - 6];
    const last = wl[i];
    return first !== null && first !== undefined && last !== null && last !== undefined && last < first;
  };
  let releaseIdx: number | null = null;
  for (let i = alertIdx + 1; i <= limit; i++) {
    if (calm(i) && (!needWaterFall || falling(i))) {
      releaseIdx = i;
      break;
    }
  }
  if (releaseIdx === null) return { releaseIdx: null, reRiseM: null, beforePeak: false };
  const base = lastKnown(wl, releaseIdx);
  let max: number | null = null;
  for (let i = releaseIdx; i <= w1; i++) {
    const v = wl[i];
    if (v !== null && v !== undefined && (max === null || v > max)) max = v;
  }
  const reRise = base !== null && max !== null ? Math.round((max - base) * 100) / 100 : null;
  return { releaseIdx, reRiseM: reRise, beforePeak: resp.peakIdx !== null && releaseIdx < resp.peakIdx };
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? null) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
}
