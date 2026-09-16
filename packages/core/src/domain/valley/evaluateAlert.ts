/**
 * 상류 강우 경보 합성 규칙 — `docs/F3_ALERT_DESIGN.md` §1.2(경계값)·§3(합성 규칙).
 *
 * 신호별 측정 4단계(관심·주의·경계·심각)를 구하고 가장 높은 것을 취하되, 출처별 상한이
 * 있다 — 인접 우량계(S2)는 관심(watch)까지, 격자(S3)가 관심 이상이면 그 상한이 풀린다.
 * 수위·특보는 측정 4단계가 아니라 표시 3단계의 **최소값**(하한)을 만든다 — 수위는 지연
 * 신호라 단독으로 `watch` 를 만들지 않는다.
 *
 * 순수 함수다. 관측값을 어디서 가져오는지(HRFCO 폴러·격자·특보 피드)는 모른다 — 서버가
 * 신호를 만들어 넘긴다. 신선도(15분 초과 "자료 없음")는 여기서 다루지 않는다 —
 * `isAlertDataStale` 이 따로다: 이 함수는 "신호가 있다면 어떤 등급인가" 만 판정한다.
 */
import type { IsoDateTime } from './CrowdSnapshot';
import type { StationCode, ValleyId } from './ids';
import {
  type AlertConfidence,
  type AlertLevel,
  type AlertMeasureTier,
  type AlertSource,
  UpstreamAlert,
  type WaterLevelStage,
} from './UpstreamAlert';

/** 신선도 기본 상한(분) — §1.2 "신선도". */
export const ALERT_STALE_AFTER_MIN = 15;

/**
 * 해제 판정 재료(§1.2 해제 규칙). 서버가 최근 관측 이력에서 미리 재 넘긴다 — 순수 함수인
 * `evaluateAlert` 는 시계열을 스스로 훑지 않는다.
 */
export type AlertClearanceContext = {
  /** 유역 강우가 관심 미만으로 30분 연속. */
  readonly rainBelowAttentionFor30Min: boolean;
  /** 최근 3시간 강우 합(mm). */
  readonly rainfall3hSumMm: number;
  /** 수위가 60분 연속 하강. 수위 신호가 없는 계곡은 `false`(확인 불가 — 해제하지 않는다). */
  readonly waterLevelFallingFor60Min: boolean;
};

/** 강우 신호(S1 유역 안 우량계 · S2 인접 산지 우량계 · S3 유역 평균 격자). */
export type AlertRainfallSignal = {
  readonly source: 'gauge' | 'adjacent-gauge' | 'grid';
  readonly observedAt: IsoDateTime;
  readonly stationCode?: StationCode;
  readonly rainfall10mMm?: number;
  readonly rainfall1hMm?: number;
  readonly rainfall3hMm?: number;
  /** grid 전용 — 유역 평균 강수 강도(mm/h). `rainfall1hMm` 이 없으면 1시간 값 대신 쓴다. */
  readonly basinRainMmPerH?: number;
};

/** 수위 신호(S4 하류 수위). */
export type AlertWaterLevelSignal = {
  readonly source: 'waterlevel';
  readonly observedAt: IsoDateTime;
  readonly stationCode?: StationCode;
  readonly waterLevelStage?: WaterLevelStage;
  /** 10분 변화(m). 양수가 상승. */
  readonly waterLevelDeltaM?: number;
};

/** 특보 신호(S5 기상청 호우특보). `level` 은 주의보(watch) · 경보(warning). */
export type AlertAdvisorySignal = {
  readonly source: 'advisory';
  readonly observedAt: IsoDateTime;
  readonly level: 'watch' | 'warning';
};

export type AlertSignal = AlertRainfallSignal | AlertWaterLevelSignal | AlertAdvisorySignal;

export type EvaluateAlertInput = {
  readonly valleyId: ValleyId;
  readonly signals: readonly AlertSignal[];
  readonly now: IsoDateTime;
  /** 현재 유효한 경보(있으면). 해제·단계 하강 판정에 쓴다. */
  readonly previous?: UpstreamAlert | null;
  /** `previous` 가 있을 때만 본다 — 해제 여부(§1.2)를 서버가 미리 재 두고 넘긴다. */
  readonly clearance?: AlertClearanceContext;
  readonly leadTimeMin?: number;
};

const LEVEL_RANK: Readonly<Record<AlertLevel, number>> = { watch: 1, warning: 2, evacuate: 3 };
const CONFIDENCE_RANK: Readonly<Record<AlertConfidence, number>> = {
  observed: 3,
  estimated: 2,
  regional: 1,
};

/** 측정 4단계 → 표시 3단계(§3). 관심·주의 → watch, 경계 → warning, 심각 → evacuate. */
export function measureTierToLevel(tier: AlertMeasureTier): AlertLevel {
  if (tier === 'severe') return 'evacuate';
  if (tier === 'alert') return 'warning';
  return 'watch';
}

/**
 * 강우 신호(10분·1시간·3시간 mm)의 측정 4단계(§1.2 표). 어느 조건도 못 넘으면 `null`
 * (관심 미만 — 경보 후보가 아니다).
 *
 * 값이 큰 등급부터 검사한다 — 세 지표(10분·1시간·3시간)가 각 등급 안에서 단조증가라
 * 위에서부터 통과하는 첫 등급이 정답이다.
 */
export function rainfallMeasureTier(input: {
  readonly rainfall10mMm?: number;
  readonly rainfall1hMm?: number;
  readonly rainfall3hMm?: number;
}): AlertMeasureTier | null {
  const r10 = input.rainfall10mMm ?? 0;
  const r1h = input.rainfall1hMm ?? 0;
  const r3h = input.rainfall3hMm ?? 0;
  if (r1h >= 50 || r3h >= 90) return 'severe';
  if (r1h >= 30 || r3h >= 60) return 'alert';
  if (r10 >= 5 || r1h >= 20) return 'caution';
  if (r1h >= 10) return 'attention';
  return null;
}

/** 신호 하나가 표시 3단계에 내는 후보. 상한·하한을 다 적용한 뒤의 값이다. */
interface Contributor {
  readonly level: AlertLevel;
  readonly source: AlertSource;
  readonly confidence: AlertConfidence;
  readonly observedAt: IsoDateTime;
  readonly stationCode?: StationCode;
  readonly rainfall10mMm?: number;
  readonly rainfall1hMm?: number;
  readonly rainfall3hMm?: number;
  readonly basinRainMmPerH?: number;
  readonly waterLevelStage?: WaterLevelStage;
  readonly waterLevelDeltaM?: number;
}

function rainfallOf(signal: AlertRainfallSignal): {
  readonly rainfall10mMm?: number;
  readonly rainfall1hMm?: number;
  readonly rainfall3hMm?: number;
} {
  return {
    ...(signal.rainfall10mMm === undefined ? {} : { rainfall10mMm: signal.rainfall10mMm }),
    ...(signal.rainfall1hMm === undefined
      ? signal.basinRainMmPerH === undefined
        ? {}
        : { rainfall1hMm: signal.basinRainMmPerH }
      : { rainfall1hMm: signal.rainfall1hMm }),
    ...(signal.rainfall3hMm === undefined ? {} : { rainfall3hMm: signal.rainfall3hMm }),
  };
}

const RAINFALL_CONFIDENCE: Readonly<Record<AlertRainfallSignal['source'], AlertConfidence>> = {
  gauge: 'observed',
  'adjacent-gauge': 'estimated',
  grid: 'estimated',
};

function rainfallContributors(signals: readonly AlertSignal[]): Contributor[] {
  const rainSignals = signals.filter(
    (s): s is AlertRainfallSignal =>
      s.source === 'gauge' || s.source === 'adjacent-gauge' || s.source === 'grid',
  );
  // S2 상한 해제 조건: S3(격자) 가 관심 이상이면 인접 우량계도 자기 등급까지 승격한다.
  const gridUnlocksCap = rainSignals.some(
    (s) => s.source === 'grid' && rainfallMeasureTier(rainfallOf(s)) !== null,
  );
  const out: Contributor[] = [];
  for (const signal of rainSignals) {
    const tier = rainfallMeasureTier(rainfallOf(signal));
    if (tier === null) continue;
    let level = measureTierToLevel(tier);
    if (signal.source === 'adjacent-gauge' && !gridUnlocksCap) {
      level = LEVEL_RANK[level] > LEVEL_RANK.watch ? 'watch' : level; // S2 관심 상한
    }
    out.push({
      level,
      source: signal.source,
      confidence: RAINFALL_CONFIDENCE[signal.source],
      observedAt: signal.observedAt,
      ...(signal.stationCode === undefined ? {} : { stationCode: signal.stationCode }),
      ...rainfallOf(signal),
      ...(signal.source === 'grid' && signal.basinRainMmPerH !== undefined
        ? { basinRainMmPerH: signal.basinRainMmPerH }
        : {}),
    });
  }
  return out;
}

function waterLevelContributor(signals: readonly AlertSignal[]): Contributor | undefined {
  const signal = signals.find((s): s is AlertWaterLevelSignal => s.source === 'waterlevel');
  if (!signal) return undefined;
  // 수위는 지연 신호라 단독으로 watch 를 만들지 않는다 — warning(10분 +10cm) 또는
  // evacuate(심각 도달)만 낸다.
  let level: AlertLevel | undefined;
  if (signal.waterLevelStage === 'severe') level = 'evacuate';
  else if ((signal.waterLevelDeltaM ?? 0) >= 0.1) level = 'warning';
  if (level === undefined) return undefined;
  return {
    level,
    source: 'waterlevel',
    confidence: 'observed',
    observedAt: signal.observedAt,
    ...(signal.stationCode === undefined ? {} : { stationCode: signal.stationCode }),
    ...(signal.waterLevelStage === undefined ? {} : { waterLevelStage: signal.waterLevelStage }),
    ...(signal.waterLevelDeltaM === undefined ? {} : { waterLevelDeltaM: signal.waterLevelDeltaM }),
  };
}

function advisoryContributor(signals: readonly AlertSignal[]): Contributor | undefined {
  const signal = signals.find((s): s is AlertAdvisorySignal => s.source === 'advisory');
  if (!signal) return undefined;
  const gridAttentionOrAbove = signals.some(
    (s) => s.source === 'grid' && rainfallMeasureTier(rainfallOf(s)) !== null,
  );
  // 호우주의보 → 최소 watch. 호우경보 ∧ 격자가 관심 이상 → 최소 warning.
  const level: AlertLevel =
    signal.level === 'warning' && gridAttentionOrAbove ? 'warning' : 'watch';
  return { level, source: 'advisory', confidence: 'regional', observedAt: signal.observedAt };
}

/** 후보 중 표시 등급이 가장 높은 것. 동률이면 확신이 높은 쪽, 그래도 같으면 먼저 온 것. */
function pickWinner(contributors: readonly Contributor[]): Contributor | undefined {
  let winner: Contributor | undefined;
  for (const c of contributors) {
    if (!winner) {
      winner = c;
      continue;
    }
    if (LEVEL_RANK[c.level] > LEVEL_RANK[winner.level]) {
      winner = c;
    } else if (
      LEVEL_RANK[c.level] === LEVEL_RANK[winner.level] &&
      CONFIDENCE_RANK[c.confidence] > CONFIDENCE_RANK[winner.confidence]
    ) {
      winner = c;
    }
  }
  return winner;
}

function stepDown(level: AlertLevel): AlertLevel {
  return level === 'evacuate' ? 'warning' : 'watch';
}

function isFullyCleared(clearance: AlertClearanceContext | undefined): boolean {
  if (!clearance) return false;
  return (
    clearance.rainBelowAttentionFor30Min &&
    clearance.rainfall3hSumMm < 20 &&
    clearance.waterLevelFallingFor60Min
  );
}

function contributorOf(input: EvaluateAlertInput): Contributor | undefined {
  const contributors = [
    ...rainfallContributors(input.signals),
    waterLevelContributor(input.signals),
    advisoryContributor(input.signals),
  ].filter((c): c is Contributor => c !== undefined);
  return pickWinner(contributors);
}

function toAlert(
  input: EvaluateAlertInput,
  level: AlertLevel,
  winner: Contributor | undefined,
): UpstreamAlert {
  return new UpstreamAlert({
    valleyId: input.valleyId,
    level,
    source: winner?.source ?? 'advisory',
    confidence: winner?.confidence ?? 'regional',
    observedAt: winner?.observedAt ?? input.now,
    issuedAt: input.previous?.isActive ? input.previous.issuedAt : input.now,
    ...(winner?.stationCode === undefined ? {} : { stationCode: winner.stationCode }),
    ...(winner?.rainfall10mMm === undefined ? {} : { rainfall10mMm: winner.rainfall10mMm }),
    ...(winner?.rainfall1hMm === undefined ? {} : { rainfall1hMm: winner.rainfall1hMm }),
    ...(winner?.rainfall3hMm === undefined ? {} : { rainfall3hMm: winner.rainfall3hMm }),
    ...(winner?.basinRainMmPerH === undefined ? {} : { basinRainMmPerH: winner.basinRainMmPerH }),
    ...(winner?.waterLevelStage === undefined ? {} : { waterLevelStage: winner.waterLevelStage }),
    ...(winner?.waterLevelDeltaM === undefined
      ? {}
      : { waterLevelDeltaM: winner.waterLevelDeltaM }),
    ...(input.leadTimeMin === undefined ? {} : { leadTimeMin: input.leadTimeMin }),
  });
}

/**
 * 신호 → 경보. 활성 경보가 없으면 `null` (평시). 순수 함수 — 서버가 신호·해제 컨텍스트를
 * 채워 부른다.
 *
 * 1. 신호별 후보(§3 1~5)를 만들고 가장 높은 것을 취한다.
 * 2. 후보가 있으면 그 등급을 그대로 쓴다(활성 신호가 있는 한 단계 하강을 늦추지 않는다 —
 *    "재발령: 비가 다시 오면 관심부터 즉시").
 * 3. 후보가 없는데 이전 경보가 활성이면 §1.2 해제 조건을 본다. 조건을 다 채우면 해제
 *    (`null`), 아니면 한 칸만 내린다(`watch` 아래로는 내리지 않는다 — 해제는 조건으로만).
 */
export function evaluateAlert(input: EvaluateAlertInput): UpstreamAlert | null {
  const winner = contributorOf(input);
  if (winner) return toAlert(input, winner.level, winner);

  const previous = input.previous;
  if (!previous?.isActive) return null;
  if (isFullyCleared(input.clearance)) return null;
  return new UpstreamAlert({
    valleyId: input.valleyId,
    level: stepDown(previous.level),
    source: previous.source,
    confidence: previous.confidence,
    observedAt: previous.observedAt,
    issuedAt: previous.issuedAt,
    ...(previous.stationCode === undefined ? {} : { stationCode: previous.stationCode }),
  });
}

/** 마지막 관측이 `staleAfterMin`(기본 15분)을 넘었는가 — "자료 없음" 회색 타일의 재료. */
export function isAlertDataStale(
  lastObservedAt: IsoDateTime | null,
  now: IsoDateTime,
  staleAfterMin: number = ALERT_STALE_AFTER_MIN,
): boolean {
  if (lastObservedAt === null) return true;
  const ageMs = new Date(now).getTime() - new Date(lastObservedAt).getTime();
  return !Number.isFinite(ageMs) || ageMs > staleAfterMin * 60_000;
}
