/**
 * 상류 강우 경보 합성 규칙 테스트 — `docs/F3_ALERT_DESIGN.md` §1.2·§3 의 경계값·상한·해제·매핑을 고정한다.
 */
import { describe, expect, it } from 'vitest';
import {
  type AlertClearanceContext,
  type AlertSignal,
  evaluateAlert,
  isAlertDataStale,
  measureTierToLevel,
  rainfallMeasureTier,
} from '../src/domain/valley/evaluateAlert';
import { toValleyId } from '../src/domain/valley/ids';
import { UpstreamAlert } from '../src/domain/valley/UpstreamAlert';

const VALLEY = toValleyId('sample');
const T0 = '2026-08-01T03:00:00.000Z';

function gauge(rain: {
  rainfall10mMm?: number;
  rainfall1hMm?: number;
  rainfall3hMm?: number;
}): AlertSignal {
  return { source: 'gauge', observedAt: T0, ...rain };
}

describe('rainfallMeasureTier — §1.2 강우 경계값', () => {
  it('아무 조건도 못 넘으면 null(관심 미만)', () => {
    expect(rainfallMeasureTier({ rainfall1hMm: 9.9 })).toBeNull();
    expect(rainfallMeasureTier({})).toBeNull();
  });

  it('관심: 1h 10 mm', () => {
    expect(rainfallMeasureTier({ rainfall1hMm: 10 })).toBe('attention');
    expect(rainfallMeasureTier({ rainfall1hMm: 9.99 })).toBeNull();
  });

  it('주의: 10분 5 mm 또는 1h 20 mm', () => {
    expect(rainfallMeasureTier({ rainfall10mMm: 5, rainfall1hMm: 10 })).toBe('caution');
    expect(rainfallMeasureTier({ rainfall10mMm: 4.9, rainfall1hMm: 10 })).toBe('attention');
    expect(rainfallMeasureTier({ rainfall1hMm: 20 })).toBe('caution');
  });

  it('경계: 1h 30 mm 또는 3h 60 mm', () => {
    expect(rainfallMeasureTier({ rainfall1hMm: 30 })).toBe('alert');
    expect(rainfallMeasureTier({ rainfall1hMm: 25, rainfall3hMm: 60 })).toBe('alert');
    expect(rainfallMeasureTier({ rainfall1hMm: 29.9 })).toBe('caution');
  });

  it('심각: 1h 50 mm 또는 3h 90 mm', () => {
    expect(rainfallMeasureTier({ rainfall1hMm: 50 })).toBe('severe');
    expect(rainfallMeasureTier({ rainfall1hMm: 40, rainfall3hMm: 90 })).toBe('severe');
    expect(rainfallMeasureTier({ rainfall1hMm: 49.9 })).toBe('alert');
  });
});

describe('measureTierToLevel — 측정 4단계 → 표시 3단계', () => {
  it('관심·주의 → watch, 경계 → warning, 심각 → evacuate', () => {
    expect(measureTierToLevel('attention')).toBe('watch');
    expect(measureTierToLevel('caution')).toBe('watch');
    expect(measureTierToLevel('alert')).toBe('warning');
    expect(measureTierToLevel('severe')).toBe('evacuate');
  });
});

describe('evaluateAlert — S1 유역 안 우량계', () => {
  it('관심 이상이면 watch, source=gauge confidence=observed', () => {
    const alert = evaluateAlert({
      valleyId: VALLEY,
      now: T0,
      signals: [gauge({ rainfall1hMm: 10 })],
    });
    expect(alert?.level).toBe('watch');
    expect(alert?.source).toBe('gauge');
    expect(alert?.confidence).toBe('observed');
    expect(alert?.rainfall1hMm).toBe(10);
  });

  it('경계 이상이면 warning, 심각이면 evacuate', () => {
    expect(
      evaluateAlert({ valleyId: VALLEY, now: T0, signals: [gauge({ rainfall1hMm: 30 })] })?.level,
    ).toBe('warning');
    expect(
      evaluateAlert({ valleyId: VALLEY, now: T0, signals: [gauge({ rainfall1hMm: 50 })] })?.level,
    ).toBe('evacuate');
  });

  it('신호가 없으면 null(평시)', () => {
    expect(evaluateAlert({ valleyId: VALLEY, now: T0, signals: [] })).toBeNull();
  });
});

describe('evaluateAlert — S2 인접 우량계 상한', () => {
  it('격자(S3) corroboration 없이는 관심(watch) 까지만 — 경계 신호라도 승격하지 않는다', () => {
    const alert = evaluateAlert({
      valleyId: VALLEY,
      now: T0,
      signals: [{ source: 'adjacent-gauge', observedAt: T0, rainfall1hMm: 50 }],
    });
    expect(alert?.level).toBe('watch');
    expect(alert?.confidence).toBe('estimated');
  });

  it('격자가 관심 이상이면 인접 우량계 자기 등급까지 승격', () => {
    const alert = evaluateAlert({
      valleyId: VALLEY,
      now: T0,
      signals: [
        { source: 'adjacent-gauge', observedAt: T0, rainfall1hMm: 50 },
        { source: 'grid', observedAt: T0, basinRainMmPerH: 10 },
      ],
    });
    expect(alert?.level).toBe('evacuate');
  });
});

describe('evaluateAlert — S4 하류 수위', () => {
  it('수위만으로는 watch 를 만들지 않는다(지연 신호)', () => {
    const alert = evaluateAlert({
      valleyId: VALLEY,
      now: T0,
      signals: [{ source: 'waterlevel', observedAt: T0, waterLevelDeltaM: 0.05 }],
    });
    expect(alert).toBeNull();
  });

  it('10분 +10cm 이상이면 최소 warning', () => {
    const alert = evaluateAlert({
      valleyId: VALLEY,
      now: T0,
      signals: [{ source: 'waterlevel', observedAt: T0, waterLevelDeltaM: 0.1 }],
    });
    expect(alert?.level).toBe('warning');
    expect(alert?.source).toBe('waterlevel');
  });

  it('심각(severe) 도달이면 evacuate', () => {
    const alert = evaluateAlert({
      valleyId: VALLEY,
      now: T0,
      signals: [{ source: 'waterlevel', observedAt: T0, waterLevelStage: 'severe' }],
    });
    expect(alert?.level).toBe('evacuate');
  });

  it('수위와 강우가 함께 있으면 더 높은 쪽을 취한다', () => {
    const alert = evaluateAlert({
      valleyId: VALLEY,
      now: T0,
      signals: [
        gauge({ rainfall1hMm: 10 }),
        { source: 'waterlevel', observedAt: T0, waterLevelDeltaM: 0.1 },
      ],
    });
    expect(alert?.level).toBe('warning');
    expect(alert?.source).toBe('waterlevel');
  });
});

describe('evaluateAlert — S5 특보', () => {
  it('호우주의보 단독은 watch', () => {
    const alert = evaluateAlert({
      valleyId: VALLEY,
      now: T0,
      signals: [{ source: 'advisory', observedAt: T0, level: 'watch' }],
    });
    expect(alert?.level).toBe('watch');
    expect(alert?.confidence).toBe('regional');
  });

  it('호우경보 단독은 watch(격자 동의 없으면 warning 으로 올라가지 않는다)', () => {
    const alert = evaluateAlert({
      valleyId: VALLEY,
      now: T0,
      signals: [{ source: 'advisory', observedAt: T0, level: 'warning' }],
    });
    expect(alert?.level).toBe('watch');
  });

  it('호우경보 ∧ 격자 관심 이상이면 warning', () => {
    const alert = evaluateAlert({
      valleyId: VALLEY,
      now: T0,
      signals: [
        { source: 'advisory', observedAt: T0, level: 'warning' },
        { source: 'grid', observedAt: T0, basinRainMmPerH: 15 },
      ],
    });
    expect(alert?.level).toBe('warning');
  });
});

describe('evaluateAlert — 해제·단계 하강 (§1.2)', () => {
  const previous = new UpstreamAlert({
    valleyId: VALLEY,
    level: 'warning',
    source: 'gauge',
    confidence: 'observed',
    observedAt: '2026-08-01T02:00:00.000Z',
    issuedAt: '2026-08-01T01:30:00.000Z',
  });

  it('신호가 사라져도 해제 조건을 다 채우지 않으면 한 칸만 내린다', () => {
    const alert = evaluateAlert({
      valleyId: VALLEY,
      now: T0,
      signals: [],
      previous,
      clearance: {
        rainBelowAttentionFor30Min: true,
        rainfall3hSumMm: 25,
        waterLevelFallingFor60Min: true,
      },
    });
    expect(alert?.level).toBe('watch');
    expect(alert?.isActive).toBe(true);
  });

  it('세 조건(강우30분·3h<20mm·수위하강60분)을 다 채우면 해제(null)', () => {
    const clearance: AlertClearanceContext = {
      rainBelowAttentionFor30Min: true,
      rainfall3hSumMm: 19.9,
      waterLevelFallingFor60Min: true,
    };
    const alert = evaluateAlert({ valleyId: VALLEY, now: T0, signals: [], previous, clearance });
    expect(alert).toBeNull();
  });

  it('수위 하강을 확인할 수 없으면(신호 없음) 해제하지 않는다', () => {
    const clearance: AlertClearanceContext = {
      rainBelowAttentionFor30Min: true,
      rainfall3hSumMm: 5,
      waterLevelFallingFor60Min: false,
    };
    const alert = evaluateAlert({ valleyId: VALLEY, now: T0, signals: [], previous, clearance });
    expect(alert?.isActive).toBe(true);
  });

  it('비가 다시 오면 관심부터 즉시 재발령 — 단계 하강을 기다리지 않는다', () => {
    const clearedPrevious = new UpstreamAlert({ ...previous, clearedAt: T0 });
    const alert = evaluateAlert({
      valleyId: VALLEY,
      now: T0,
      signals: [gauge({ rainfall1hMm: 10 })],
      previous: clearedPrevious,
    });
    expect(alert?.level).toBe('watch');
  });

  it('활성 경보가 없으면(previous 없음) 신호 없이는 그냥 null', () => {
    expect(evaluateAlert({ valleyId: VALLEY, now: T0, signals: [] })).toBeNull();
  });
});

describe('isAlertDataStale — 신선도(15분)', () => {
  it('마지막 관측이 없으면 stale', () => {
    expect(isAlertDataStale(null, T0)).toBe(true);
  });

  it('15분 이내면 fresh, 15분 넘으면 stale', () => {
    expect(isAlertDataStale('2026-08-01T02:46:00.000Z', T0)).toBe(false);
    expect(isAlertDataStale('2026-08-01T02:44:59.000Z', T0)).toBe(true);
  });
});
