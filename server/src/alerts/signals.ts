/**
 * 로스터(`alertSources.ts`) + 저장된 관측값(`observations`·`latest`) → core `evaluateAlert` 입력.
 *
 * 임계값 판정은 여기 없다 — core 를 그대로 부른다(F3b 규칙: 로직 중복 금지). 이 파일이
 * 하는 일은 "이 계곡이 볼 수 있는 신호가 뭔가" 를 관측소 로스터로 좁히고, 10분 격자에서
 * 1시간·3시간 합을 만드는 것뿐이다.
 *
 * 한계(문서화, 후속 제안): AWS 지점의 `value` 는 이미 RN-60m(1시간 롤링 합)이라 10분 증분을
 * 복원할 수 없다 — `rainfall10mMm` 은 AWS 신호에서 비워 둔다. 3시간 합도 AWS 만으로는
 * 만들 수 없어 1시간 값을 그대로 상한으로 쓴다(경계·심각 판정은 1h 조건으로도 닿는다).
 */
import {
  type AlertClearanceContext,
  type AlertSignal,
  rainfallMeasureTier,
  toStationCode,
  type WaterLevelStage,
} from '@modu-valley/core';
import type { AlertSourceRoster, AlertSourceStation } from '../alertSources';
import type { Repos } from '../db/repos';

const HOUR_MS = 60 * 60_000;
const TEN_MIN_MS = 10 * 60_000;

function isoMinus(nowIso: string, ms: number): string {
  return new Date(new Date(nowIso).getTime() - ms).toISOString();
}

function latestOf(a: string | null, b: string): string {
  return a !== null && a > b ? a : b;
}

interface RainfallPoint {
  readonly observedAt: string;
  readonly rainfall10mMm?: number;
  readonly rainfall1hMm: number;
  readonly rainfall3hMm: number;
}

/**
 * 강우 station 하나의 시계열(오래된 → 최신), 3시간 창. HRFCO 는 10분 증분을 굴려 1h·3h 합을
 * 만들고, AWS 는 지점 값(RN-60m)을 그대로 1h·3h 값으로 쓴다(위 한계 참고).
 */
function rainfallSeries(
  repos: Repos,
  station: AlertSourceStation,
  nowIso: string,
): RainfallPoint[] {
  const since = isoMinus(nowIso, 3 * HOUR_MS + TEN_MIN_MS);
  const rows = [...repos.observations.recent(station.kind, station.code, since)].reverse();
  if (station.kind === 'aws') {
    return rows
      .filter((r) => r.value !== null)
      .map((r) => ({
        observedAt: r.observedAt,
        rainfall1hMm: r.value as number,
        rainfall3hMm: r.value as number,
      }));
  }
  const sum = (w: typeof rows): number => w.reduce((acc, x) => acc + (x.value ?? 0), 0);
  return rows.map((r, i) => ({
    observedAt: r.observedAt,
    rainfall10mMm: r.value ?? 0,
    rainfall1hMm: sum(rows.slice(Math.max(0, i - 5), i + 1)),
    rainfall3hMm: sum(rows.slice(Math.max(0, i - 17), i + 1)),
  }));
}

/** `point` 가 관심 이상 강우 신호인가 — 해제 판정의 "최근 30분 강우" 재료. */
function isAtLeastAttention(point: RainfallPoint): boolean {
  return (
    rainfallMeasureTier({
      rainfall1hMm: point.rainfall1hMm,
      ...(point.rainfall10mMm === undefined ? {} : { rainfall10mMm: point.rainfall10mMm }),
    }) !== null
  );
}

interface RainfallResult {
  readonly signals: AlertSignal[];
  readonly latestObservedAt: string | null;
  /** 최근 30분 안에 관심 이상인 지점이 하나라도 있었는가. */
  readonly recentlyAboveAttention: boolean;
  /** 로스터 강우 station 들의 3시간 합 중 최댓값 — 해제 판정의 "3h < 20mm" 재료. */
  readonly rainfall3hMax: number;
}

const RAIN_KIND_OF: Readonly<Record<'s1' | 's2', 'gauge' | 'adjacent-gauge'>> = {
  s1: 'gauge',
  s2: 'adjacent-gauge',
};

function buildRainfallSignals(
  repos: Repos,
  roster: AlertSourceRoster,
  nowIso: string,
  cutoff30: string,
): RainfallResult {
  const signals: AlertSignal[] = [];
  let latestObservedAt: string | null = null;
  let recentlyAboveAttention = false;
  let rainfall3hMax = 0;

  for (const key of ['s1', 's2'] as const) {
    for (const station of roster[key]) {
      const series = rainfallSeries(repos, station, nowIso);
      if (series.length === 0) continue;
      const current = series[series.length - 1] as RainfallPoint;
      latestObservedAt = latestOf(latestObservedAt, current.observedAt);
      rainfall3hMax = Math.max(rainfall3hMax, current.rainfall3hMm);
      signals.push({
        source: RAIN_KIND_OF[key],
        observedAt: current.observedAt,
        stationCode: toStationCode(station.code),
        ...(current.rainfall10mMm === undefined ? {} : { rainfall10mMm: current.rainfall10mMm }),
        rainfall1hMm: current.rainfall1hMm,
        rainfall3hMm: current.rainfall3hMm,
      });
      if (series.some((point) => point.observedAt >= cutoff30 && isAtLeastAttention(point))) {
        recentlyAboveAttention = true;
      }
    }
  }
  return { signals, latestObservedAt, recentlyAboveAttention, rainfall3hMax };
}

interface WaterLevelPoint {
  readonly observedAt: string;
  readonly value: number;
}

function waterLevelSeries(repos: Repos, code: string, nowIso: string): WaterLevelPoint[] {
  const since = isoMinus(nowIso, HOUR_MS + TEN_MIN_MS);
  return [...repos.observations.recent('hrfco-waterlevel', code, since)]
    .reverse()
    .filter((r): r is typeof r & { value: number } => r.value !== null);
}

/** 최근 7 포인트(60분)가 비증가(하강 또는 유지)면 "하강 중". 모자라면 확인 불가. */
function isFalling60Min(series: readonly WaterLevelPoint[]): boolean {
  if (series.length < 7) return false;
  const last7 = series.slice(series.length - 7);
  return last7.every((p, i) => i === 0 || (last7[i - 1] as WaterLevelPoint).value >= p.value);
}

function numAttr(attrs: Readonly<Record<string, unknown>> | null, key: string): number | undefined {
  const v = attrs?.[key];
  return typeof v === 'number' ? v : undefined;
}

/** 수위 값 → 4단계. 관측소 제원(attwl/wrnwl/almwl/srswl)이 없으면 `undefined`. */
export function waterLevelStageOf(
  value: number,
  attrs: Readonly<Record<string, unknown>> | null,
): WaterLevelStage | undefined {
  const srswl = numAttr(attrs, 'srswl');
  if (srswl !== undefined && value >= srswl) return 'severe';
  const almwl = numAttr(attrs, 'almwl');
  if (almwl !== undefined && value >= almwl) return 'alert';
  const wrnwl = numAttr(attrs, 'wrnwl');
  if (wrnwl !== undefined && value >= wrnwl) return 'caution';
  const attwl = numAttr(attrs, 'attwl');
  if (attwl !== undefined && value >= attwl) return 'attention';
  return undefined;
}

interface WaterLevelResult {
  readonly signals: AlertSignal[];
  readonly latestObservedAt: string | null;
  /** 수위 신호가 하나도 없으면 "하강 확인 불가" — 해제하지 않는다. */
  readonly falling60Min: boolean;
}

function buildWaterLevelSignals(
  repos: Repos,
  roster: AlertSourceRoster,
  nowIso: string,
): WaterLevelResult {
  const signals: AlertSignal[] = [];
  let latestObservedAt: string | null = null;
  let sawWaterLevel = false;
  let falling = false;
  const stationsByCode = new Map(
    repos.stations.list(['hrfco-waterlevel']).map((s) => [s.code, s.attrs] as const),
  );

  for (const station of roster.waterlevel) {
    const series = waterLevelSeries(repos, station.code, nowIso);
    if (series.length === 0) continue;
    sawWaterLevel = true;
    const current = series[series.length - 1] as WaterLevelPoint;
    latestObservedAt = latestOf(latestObservedAt, current.observedAt);
    const previousPoint =
      series.length >= 2 ? (series[series.length - 2] as WaterLevelPoint) : undefined;
    const waterLevelDeltaM =
      previousPoint === undefined ? undefined : round3(current.value - previousPoint.value);
    const stage = waterLevelStageOf(current.value, stationsByCode.get(station.code) ?? null);
    signals.push({
      source: 'waterlevel',
      observedAt: current.observedAt,
      stationCode: toStationCode(station.code),
      ...(stage === undefined ? {} : { waterLevelStage: stage }),
      ...(waterLevelDeltaM === undefined ? {} : { waterLevelDeltaM }),
    });
    if (isFalling60Min(series)) falling = true;
  }
  return { signals, latestObservedAt, falling60Min: sawWaterLevel && falling };
}

export interface ValleySignalBundle {
  readonly signals: readonly AlertSignal[];
  readonly clearance: AlertClearanceContext;
  /** 로스터 신호 중 가장 최근 관측 시각. 신선도("자료 없음") 판정 재료. `null` 이면 신호가 하나도 없다. */
  readonly latestObservedAt: string | null;
}

/** 로스터 + 저장된 관측값 → `evaluateAlert` 입력 신호와 해제 판정 재료. */
export function buildValleySignals(
  repos: Repos,
  roster: AlertSourceRoster,
  nowIso: string,
): ValleySignalBundle {
  const cutoff30 = isoMinus(nowIso, 30 * 60_000);
  const rain = buildRainfallSignals(repos, roster, nowIso, cutoff30);
  const waterLevel = buildWaterLevelSignals(repos, roster, nowIso);
  return {
    signals: [...rain.signals, ...waterLevel.signals],
    latestObservedAt:
      rain.latestObservedAt === null
        ? waterLevel.latestObservedAt
        : latestOf(waterLevel.latestObservedAt, rain.latestObservedAt),
    clearance: {
      rainBelowAttentionFor30Min: !rain.recentlyAboveAttention,
      rainfall3hSumMm: rain.rainfall3hMax,
      waterLevelFallingFor60Min: waterLevel.falling60Min,
    },
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
