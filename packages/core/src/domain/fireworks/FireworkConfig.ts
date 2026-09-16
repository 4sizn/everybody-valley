/**
 * 불꽃 시뮬레이션 상수 — 전부 원본 데모에서 옮긴 값이다.
 *
 * 파리티 검증의 기준이 되는 파일이므로 어느 것도 "적당히" 바꾸지 않는다.
 * 데모의 어느 표현에서 왔는지 주석에 남겨 두었다.
 */

/** RGB 0~1. 데모의 `PALETTE`. */
export type Rgb = readonly [r: number, g: number, b: number];

export const FIREWORK_PALETTE: readonly Rgb[] = [
  [1, 0.42, 0.21],
  [1, 0.85, 0.32],
  [0.45, 0.82, 1],
  [1, 0.45, 0.72],
  [0.65, 1, 0.55],
  [1, 1, 0.95],
];

export type FireworkConfig = {
  /** 버스트 하나의 파티클 수. 데모 `P_PER_BURST = 320`. */
  readonly particlesPerBurst: number;
  /** 동시 유지 버스트 수. 넘치면 가장 오래된 것을 버린다. 데모 `MAX_BURSTS = 6`. */
  readonly maxBursts: number;
  /** 폭발 고도(m) 하한. 데모 `300 + random*260`. */
  readonly minAltitudeMeters: number;
  readonly altitudeSpreadMeters: number;
  /** 초기 속도(m/s). 데모 `95 + random*135` → 직경 200~300m 셸. */
  readonly minSpeedMps: number;
  readonly speedSpreadMps: number;
  /** 파티클 수명(s). 데모 `1.7 + random*1.5`. */
  readonly minLifeSeconds: number;
  readonly lifeSpreadSeconds: number;
  /** 발사 지점 흔들기(도). 데모 `jitter = 0.0035`. */
  readonly originJitterDegrees: number;
  /** 공기 저항 계수. 데모 `Math.exp(-0.55*t)`. */
  readonly dragCoefficient: number;
  /** 중력 가속도. 데모 `0.5 * 9.8 * t*t`. */
  readonly gravityMps2: number;
};

export const DEFAULT_FIREWORK_CONFIG: FireworkConfig = {
  particlesPerBurst: 320,
  maxBursts: 6,
  minAltitudeMeters: 300,
  altitudeSpreadMeters: 260,
  minSpeedMps: 95,
  speedSpreadMps: 135,
  minLifeSeconds: 1.7,
  lifeSpreadSeconds: 1.5,
  originJitterDegrees: 0.0035,
  dragCoefficient: 0.55,
  gravityMps2: 9.8,
};

/**
 * 발사 간격. 데모는 `onAdd` 에서 즉시 한 번, 700ms·1400ms 뒤 한 번씩 쏘고
 * 이후 620ms 주기로 반복한다.
 */
export const BURST_SCHEDULE = {
  primingDelaysMs: [0, 700, 1400] as readonly number[],
  intervalMs: 620,
} as const;
