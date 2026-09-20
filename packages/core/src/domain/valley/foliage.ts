/**
 * 단풍 진행 판정 — 일 최저기온 실측으로 계곡 하나의 단풍 단계와 예상 시기를 낸다.
 *
 * 근거(기상청 계절관측 정의·국립수목원 예측 원리): 잎은 **일 최저기온이 5℃ 아래로 내려가는
 * 날이 이어질 때** 엽록소 분해가 빨라져 물들기 시작하고(첫 단풍 = 산의 20% 물듦), 그로부터
 * 보통 2주 안에 절정(80%)에 이른다. 서리(0℃ 이하)가 내리면 낙엽이 빨라진다.
 *
 * 순수 함수다. 기온을 어디서 가져오는지(기상청 AWS·인접 관측소 몇 개를 어떻게 합치는지)는
 * 모른다 — 서버가 계곡별 하루 1값(°C)으로 합쳐 넘긴다. 날짜는 KST `YYYY-MM-DD` 문자열이고
 * 정렬돼 있어야 한다. 빠진 날은 그냥 없는 것으로 본다(보간하지 않는다).
 *
 * `evaluateAlert`(강우 경보)와 같은 자리다 — 임계값은 이 파일에만 있다(중복 금지).
 */

export const FOLIAGE_STAGES = ['green', 'turning', 'peak', 'falling', 'dormant'] as const;
export type FoliageStage = (typeof FOLIAGE_STAGES)[number];

const STAGE_LABELS: Readonly<Record<FoliageStage, string>> = {
  green: '아직 초록',
  turning: '물들기 시작',
  peak: '절정',
  falling: '낙엽',
  dormant: '시즌 종료',
};

export function foliageStageLabel(stage: FoliageStage): string {
  return STAGE_LABELS[stage];
}

/** 일 최저기온이 이 값 이하인 날을 "찬 날"로 센다(°C). */
export const FOLIAGE_COLD_TMIN_C = 5;
/** 첫 단풍 판정: 7일 창 안에 찬 날이 이 수 이상. 하루짜리 한파로 오판하지 않기 위한 문턱. */
export const FOLIAGE_TURNING_COLD_DAYS = 3;
export const FOLIAGE_TURNING_WINDOW_DAYS = 7;
/** 첫 단풍 → 절정: 찬 날 누적이 이 수에 닿거나, 늦어도 이 일수가 지나면. */
export const FOLIAGE_PEAK_COLD_DAYS = 10;
export const FOLIAGE_PEAK_AFTER_DAYS = 14;
/** 절정 → 낙엽: 서리(이하 °C)가 오거나, 늦어도 이 일수 뒤. */
export const FOLIAGE_FROST_TMIN_C = 0;
export const FOLIAGE_FALLING_AFTER_DAYS = 12;
/** 낙엽 → 시즌 종료. */
export const FOLIAGE_DORMANT_AFTER_DAYS = 14;
/** 예측 회귀에 쓰는 최근 일수와 예측 상한(일). */
export const FOLIAGE_FORECAST_LOOKBACK_DAYS = 14;
export const FOLIAGE_FORECAST_MAX_DAYS = 45;
/** 관측이 이 일수 미만이면 `estimated`(얇은 자료). */
export const FOLIAGE_OBSERVED_MIN_DAYS = 14;

/** 하루 1값. `day` 는 KST `YYYY-MM-DD`. */
export type FoliageDay = {
  readonly day: string;
  readonly tminC: number;
};

export type FoliageConfidence = 'observed' | 'estimated' | 'none';

export type FoliageState = {
  readonly stage: FoliageStage;
  /** 판정에 쓴 마지막 관측일. 자료가 없으면 `null`. */
  readonly lastDay: string | null;
  /** 지금까지 센 찬 날 수. */
  readonly coldDays: number;
  /** 실측으로 확정된 전환일들. 아직 오지 않은 단계는 `null`. */
  readonly turningStart: string | null;
  readonly peakStart: string | null;
  readonly fallingStart: string | null;
  /**
   * 아직 오지 않은 단계의 예상일. `turning` 은 최근 최저기온 추세를 직선으로 늘려 5℃ 에 닿는
   * 날, `peak` 는 첫 단풍 + 14일. 추세가 내려가지 않으면 `null`(예측 불가 — 지역 예측을 보라).
   */
  readonly forecast: {
    readonly turning: string | null;
    readonly peak: string | null;
  };
  readonly confidence: FoliageConfidence;
};

export type EvaluateFoliageInput = {
  /** 오래된 → 최신, 같은 날 중복 없음. */
  readonly days: readonly FoliageDay[];
  /** KST `YYYY-MM-DD`. */
  readonly today: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

export function addDays(day: string, n: number): string {
  return new Date(toMs(day) + n * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((toMs(to) - toMs(from)) / DAY_MS);
}

/** 7일 창 안에 찬 날 3개가 처음 모이는 창의 첫 찬 날. */
function findTurningStart(days: readonly FoliageDay[]): string | null {
  const cold = days.filter((d) => d.tminC <= FOLIAGE_COLD_TMIN_C).map((d) => d.day);
  for (let i = 0; i + FOLIAGE_TURNING_COLD_DAYS - 1 < cold.length; i += 1) {
    const first = cold[i] as string;
    const last = cold[i + FOLIAGE_TURNING_COLD_DAYS - 1] as string;
    if (daysBetween(first, last) < FOLIAGE_TURNING_WINDOW_DAYS) return first;
  }
  return null;
}

/** 첫 단풍 뒤 찬 날 누적이 10에 닿는 날. 못 채우면 호출자가 14일 뒤로 확정한다. */
function findPeakStart(days: readonly FoliageDay[], turningStart: string): string | null {
  let cold = 0;
  for (const d of days) {
    if (d.day < turningStart) continue;
    if (d.tminC <= FOLIAGE_COLD_TMIN_C) cold += 1;
    if (cold >= FOLIAGE_PEAK_COLD_DAYS) return d.day;
  }
  return null;
}

/**
 * 최근 14일(달력 기준) 최저기온의 최소제곱 직선. 기울기(°C/일)와 마지막 날 예측값.
 * x 는 인덱스가 아니라 **날짜 차이**다 — 백필이 덜 된 시계열은 날이 빠져 있고, 인덱스로
 * 재면 3주 간격의 하락을 하루 간격으로 착각해 첫 단풍을 며칠 뒤로 예측한다(2026-09-21 실측).
 * 창 안에 5일 미만이면 예측하지 않는다.
 */
function trend(days: readonly FoliageDay[]): { slope: number; last: number } | null {
  const lastDay = days.at(-1)?.day;
  if (lastDay === undefined) return null;
  const since = addDays(lastDay, -(FOLIAGE_FORECAST_LOOKBACK_DAYS - 1));
  const recent = days.filter((d) => d.day >= since);
  if (recent.length < 5) return null;
  const n = recent.length;
  const first = recent[0] as FoliageDay;
  const xs = recent.map((d) => daysBetween(first.day, d.day));
  const ys = recent.map((d) => d.tminC);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += ((xs[i] as number) - mx) * ((ys[i] as number) - my);
    sxx += ((xs[i] as number) - mx) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, last: my + slope * ((xs[n - 1] as number) - mx) };
}

export function evaluateFoliage(input: EvaluateFoliageInput): FoliageState {
  const { days, today } = input;
  const last = days.at(-1) ?? null;
  const coldDays = days.filter((d) => d.tminC <= FOLIAGE_COLD_TMIN_C).length;
  const none: FoliageState = {
    stage: 'green',
    lastDay: last?.day ?? null,
    coldDays,
    turningStart: null,
    peakStart: null,
    fallingStart: null,
    forecast: { turning: null, peak: null },
    confidence: last
      ? days.length >= FOLIAGE_OBSERVED_MIN_DAYS
        ? 'observed'
        : 'estimated'
      : 'none',
  };
  if (!last) return none;

  const turningStart = findTurningStart(days);
  if (turningStart === null) {
    const t = trend(days);
    let turning: string | null = null;
    if (t && t.slope < 0 && t.last > FOLIAGE_COLD_TMIN_C) {
      const eta = Math.ceil((t.last - FOLIAGE_COLD_TMIN_C) / -t.slope);
      if (eta <= FOLIAGE_FORECAST_MAX_DAYS) turning = addDays(last.day, Math.max(1, eta));
    }
    return {
      ...none,
      forecast: { turning, peak: turning ? addDays(turning, FOLIAGE_PEAK_AFTER_DAYS) : null },
    };
  }

  // 첫 단풍이 왔다. 절정은 찬 날 누적 10일 또는 14일 뒤, 먼저 오는 쪽.
  const peakDeadline = addDays(turningStart, FOLIAGE_PEAK_AFTER_DAYS);
  const peakByCold = findPeakStart(days, turningStart);
  const peakStart =
    peakByCold !== null && peakByCold <= peakDeadline
      ? peakByCold
      : today >= peakDeadline
        ? peakDeadline
        : null;
  if (peakStart === null || today < peakStart) {
    return {
      ...none,
      stage: 'turning',
      turningStart,
      forecast: { turning: null, peak: peakStart ?? peakDeadline },
    };
  }

  // 절정. 낙엽은 절정 뒤 첫 서리 또는 12일 뒤.
  const fallingDeadline = addDays(peakStart, FOLIAGE_FALLING_AFTER_DAYS);
  const frost = days.find((d) => d.day > peakStart && d.tminC <= FOLIAGE_FROST_TMIN_C)?.day ?? null;
  const fallingStart =
    frost !== null && frost <= fallingDeadline
      ? frost
      : today >= fallingDeadline
        ? fallingDeadline
        : null;
  if (fallingStart === null || today < fallingStart) {
    return {
      ...none,
      stage: 'peak',
      turningStart,
      peakStart,
      forecast: { turning: null, peak: null },
    };
  }

  const dormant = addDays(fallingStart, FOLIAGE_DORMANT_AFTER_DAYS);
  return {
    ...none,
    stage: today >= dormant ? 'dormant' : 'falling',
    turningStart,
    peakStart,
    fallingStart,
    forecast: { turning: null, peak: null },
  };
}
