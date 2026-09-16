/**
 * 그늘 태그 — 구간 카드·상세 시트가 "한눈에 읽는 요약"으로 쓰는 3단계 태그(N5).
 *
 * `Shade.ts` 의 `canopyLevel` 이 나무 밀도(`canopyCover`, 시각 무관 한 값)를 3단계로
 * 나누는 것과 달리, 이 태그는 **하루 동안 실제로 얼마나 그늘지는지**(`shadeByHour`
 * 9값의 종일 평균)를 3단계로 나눈다. 임계값·분포는 `docs/TODO.md` N5 절의 실측
 * (SD1 30구간 중 많음 8 · 보통 12 · 적음 10)에서 나왔다 — 다르게 나오면 계산이 틀렸다.
 *
 * 늦은 오후 급증(`lateAfternoon`)도 같은 자리에서 계산한다 — 18시 그늘이 정오보다
 * 크게 늘어나는 계곡(30구간 중 15개)이 있다는 실측 때문에 만든 축이지만, 사용자
 * 결정 (a) 로 화면에는 배지를 그리지 않기로 했다. 나중에 배지를 켜려면 이 값을
 * 읽는 한 줄만 더하면 된다 — 그래서 계산은 남기고 렌더만 뺐다.
 *
 * N1 조건 필터가 착수 시 같은 함수를 재사용한다(결정 (f)) — 그래서 `Segment` 전체가
 * 아니라 필요한 두 필드만 받는다. `Segment` 인스턴스를 그대로 넘겨도 구조적으로
 * 맞는다.
 */
import type { Segment } from './Segment';
import { SHADE_HOUR_COUNT, SHADE_NOON_INDEX } from './Segment';

/** 그늘 양 3단계. 많음 / 보통 / 적음. */
export const SHADE_AMOUNTS = ['many', 'moderate', 'few'] as const;
export type ShadeAmount = (typeof SHADE_AMOUNTS)[number];

/**
 * 그늘 양 3단계 경계(결정 (b)) — `shadeByHour` 종일 평균 기준.
 * 적음 `< 0.2` ≤ 보통 `< 0.5` ≤ 많음.
 */
export const SHADE_AMOUNT_MODERATE_MIN = 0.2;
export const SHADE_AMOUNT_MANY_MIN = 0.5;

/**
 * 늦은 오후 급증 경계(결정 (c)) — `shadeByHour` 마지막 시각(18시) − 정오 ≥ 이 값.
 * `shadeTags` 가 계산은 하지만 (a) 에 따라 어떤 화면도 이 값을 읽지 않는다 — 상수와
 * 테스트만 남겨 둔다.
 */
export const SHADE_LATE_AFTERNOON_SURGE_MIN = 0.2;

/** `shadeTags` 입력 — `Segment` 를 통째로 넘겨도, 이 두 필드만 있는 객체를 넘겨도 된다. */
export type ShadeTagsInput = Pick<Segment, 'canopyCover' | 'shadeByHour'>;

export type ShadeTags = {
  readonly amount: ShadeAmount;
  /** 계산만 한다 — 어떤 화면도 렌더하지 않는다(결정 (c), (a) 와의 상충 처리). */
  readonly lateAfternoon: boolean;
};

/** 종일 평균 그늘 비율(0~1) → 3단계. */
export function shadeAmountOf(dayAverage: number): ShadeAmount {
  if (dayAverage >= SHADE_AMOUNT_MANY_MIN) return 'many';
  if (dayAverage >= SHADE_AMOUNT_MODERATE_MIN) return 'moderate';
  return 'few';
}

const SHADE_AMOUNT_LABELS: Readonly<Record<ShadeAmount, string>> = {
  many: '나무 그늘 많음',
  moderate: '나무 그늘 보통',
  few: '나무 그늘 적음',
};

export function shadeAmountLabel(amount: ShadeAmount): string {
  return SHADE_AMOUNT_LABELS[amount];
}

/** 부동소수점 합산 오차(예: `1.8/9` → `0.19999999999999998`)가 경계 판정을 흔들지 않게 자른다. */
function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * `shadeByHour` 가 없는 구간(P1 미산출 계곡)은 `null` — 카드·시트가 태그를 그리지 않는다.
 */
export function shadeTags(input: ShadeTagsInput): ShadeTags | null {
  const byHour = input.shadeByHour;
  if (byHour === undefined || byHour.length === 0) return null;
  const dayAverage = round6(byHour.reduce((sum, value) => sum + value, 0) / byHour.length);
  const noon = byHour[SHADE_NOON_INDEX] ?? 0;
  const lastHour = byHour[SHADE_HOUR_COUNT - 1] ?? noon;
  return {
    amount: shadeAmountOf(dayAverage),
    lateAfternoon: round6(lastHour - noon) >= SHADE_LATE_AFTERNOON_SURGE_MIN,
  };
}
