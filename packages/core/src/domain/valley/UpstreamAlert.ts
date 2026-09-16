/**
 * 상류 강우 경보 이벤트.
 *
 * 계곡 상류 신호(관측소·격자·수위)가 §1.2 경계값을 넘으면 발령한다. 서버가
 * `evaluateAlert`(같은 폴더 `evaluateAlert.ts`)로 판정해 SSE·`/api/alerts` 로
 * 내려주는 payload 가 이 모양이다. 여기서는 값만 들고 있다.
 *
 * F3 재설계(`docs/F3_ALERT_DESIGN.md` §5)로 관측소 1개 전제(`stationCode` required)를
 * 걷어냈다 — 격자(S3)·인접 우량계(S2)·특보(S5)처럼 관측소가 없는 신호도 담아야 한다.
 * `AlertLevel` 3단계(watch/warning/evacuate)는 유지한다 — 사람이 취할 행동이 셋뿐이다.
 *
 * 필드 출처: `docs/F3_ALERT_DESIGN.md` §5 스키마 변경 제안.
 */
import type { IsoDateTime } from './CrowdSnapshot';
import type { StationCode, ValleyId } from './ids';

/** 주의 / 경보 / 대피. 사용자에게 보이는 3단계. */
export const ALERT_LEVELS = ['watch', 'warning', 'evacuate'] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

const ALERT_LEVEL_LABELS: Readonly<Record<AlertLevel, string>> = {
  watch: '주의',
  warning: '경보',
  evacuate: '대피',
};

export function alertLevelLabel(level: AlertLevel): string {
  return ALERT_LEVEL_LABELS[level];
}

/**
 * 측정 4단계(관심·주의·경계·심각). 강우 임계값 표(§1.2)와 한강홍수통제소 수위 제원
 * (attwl/wrnwl/almwl/srswl)이 공유하는 이름이다 — `rainfallMeasureTier`·`waterLevelStage`
 * 양쪽에 쓴다.
 */
export const ALERT_MEASURE_TIERS = ['attention', 'caution', 'alert', 'severe'] as const;
export type AlertMeasureTier = (typeof ALERT_MEASURE_TIERS)[number];

const ALERT_MEASURE_TIER_LABELS: Readonly<Record<AlertMeasureTier, string>> = {
  attention: '관심',
  caution: '주의',
  alert: '경계',
  severe: '심각',
};

export function alertMeasureTierLabel(tier: AlertMeasureTier): string {
  return ALERT_MEASURE_TIER_LABELS[tier];
}

/** 수위 4단계 — `waterLevelStage` 의 값. 관측소 제원(attwl/wrnwl/almwl/srswl)과 이름이 같다. */
export type WaterLevelStage = AlertMeasureTier;

/**
 * 단계를 결정한 신호의 종류. S1 유역 안 우량계(`gauge`) · S2 인접 산지 우량계
 * (`adjacent-gauge`) · S3 격자 강수(`grid`) · S4 하류 수위(`waterlevel`) · S5 특보
 * (`advisory`).
 */
export const ALERT_SOURCES = ['gauge', 'adjacent-gauge', 'grid', 'waterlevel', 'advisory'] as const;
export type AlertSource = (typeof ALERT_SOURCES)[number];

/**
 * 사용자에게 항상 보이는 확신 등급. 관측(유역 안 우량계) / 추정(격자·인접 우량계) /
 * 특보만. 계곡마다 있는 자료가 달라 없는 확신을 꾸며내지 않는다(결정 (b)).
 */
export const ALERT_CONFIDENCES = ['observed', 'estimated', 'regional'] as const;
export type AlertConfidence = (typeof ALERT_CONFIDENCES)[number];

const ALERT_CONFIDENCE_LABELS: Readonly<Record<AlertConfidence, string>> = {
  observed: '관측',
  estimated: '추정',
  regional: '특보',
};

export function alertConfidenceLabel(confidence: AlertConfidence): string {
  return ALERT_CONFIDENCE_LABELS[confidence];
}

export type UpstreamAlertProps = {
  readonly valleyId: ValleyId;
  readonly level: AlertLevel;
  /** 단계를 결정한 신호. */
  readonly source: AlertSource;
  readonly confidence: AlertConfidence;
  /** 신호 관측 시각 — `issuedAt`(경보 발령 시각)과 분리한다. 지연 표시("N분 전")의 재료. */
  readonly observedAt: IsoDateTime;
  readonly issuedAt: IsoDateTime;
  /** gauge/adjacent-gauge/waterlevel 일 때. */
  readonly stationCode?: StationCode;
  /** 최근 10분 강우량(mm). */
  readonly rainfall10mMm?: number;
  /** 최근 1시간 강우량(mm). */
  readonly rainfall1hMm?: number;
  /** 최근 3시간 강우량(mm). */
  readonly rainfall3hMm?: number;
  /** grid: 유역 평균 강수 강도(mm/h). */
  readonly basinRainMmPerH?: number;
  /** S4 수위 4단계. */
  readonly waterLevelStage?: WaterLevelStage;
  /** 수위 10분 변화(m). 양수가 상승. */
  readonly waterLevelDeltaM?: number;
  /** 집수역 도달시간 추정(있을 때). */
  readonly leadTimeMin?: number;
  /** 해제 시각. `null` 이면 아직 유효한 경보다. */
  readonly clearedAt?: IsoDateTime | null;
  /** 사후 검증 — 실제로 수위가 올랐는가. `null` 은 아직 검증 전. 임계값 튜닝용. */
  readonly verified?: boolean | null;
};

export class UpstreamAlert {
  readonly valleyId: ValleyId;
  readonly level: AlertLevel;
  readonly source: AlertSource;
  readonly confidence: AlertConfidence;
  readonly observedAt: IsoDateTime;
  readonly issuedAt: IsoDateTime;
  readonly stationCode: StationCode | undefined;
  readonly rainfall10mMm: number | undefined;
  readonly rainfall1hMm: number | undefined;
  readonly rainfall3hMm: number | undefined;
  readonly basinRainMmPerH: number | undefined;
  readonly waterLevelStage: WaterLevelStage | undefined;
  readonly waterLevelDeltaM: number | undefined;
  readonly leadTimeMin: number | undefined;
  readonly clearedAt: IsoDateTime | null;
  readonly verified: boolean | null;

  constructor(props: UpstreamAlertProps) {
    this.valleyId = props.valleyId;
    this.level = props.level;
    this.source = props.source;
    this.confidence = props.confidence;
    this.observedAt = props.observedAt;
    this.issuedAt = props.issuedAt;
    this.stationCode = props.stationCode;
    this.rainfall10mMm = props.rainfall10mMm;
    this.rainfall1hMm = props.rainfall1hMm;
    this.rainfall3hMm = props.rainfall3hMm;
    this.basinRainMmPerH = props.basinRainMmPerH;
    this.waterLevelStage = props.waterLevelStage;
    this.waterLevelDeltaM = props.waterLevelDeltaM;
    this.leadTimeMin = props.leadTimeMin;
    this.clearedAt = props.clearedAt ?? null;
    this.verified = props.verified ?? null;
  }

  /** 아직 해제되지 않았는가. */
  get isActive(): boolean {
    return this.clearedAt === null;
  }
}
