/**
 * 목록 요약 — "계곡 1 · 구간 3 · 시설 4 · 정오 그늘 평균 58%" 의 재료 (V1 (e)).
 *
 * F1 은 목록 헤더 아래에 데이터셋 `description`(샘플 고지)을 두었다. 안내문이 카드보다
 * 먼저 오는 자리에는 **화면이 무엇을 담고 있는지**가 와야 하므로 수치 요약으로 바꾸고,
 * 고지는 footer 로 내렸다. 수치는 순수 계산이라 도메인에 둔다 — 문장은 표현 계층의 copy.
 *
 * 정오 그늘 평균은 그늘 데이터가 있는 구간만으로 낸다(`noonShadeRatio`). 하나도 없으면
 * `null` — copy 가 그늘 조각을 생략한다.
 */
import { noonShadeRatio } from './segmentSubtitle';
import type { Valley } from './Valley';

export type ValleySummary = {
  readonly valleys: number;
  readonly segments: number;
  readonly facilities: number;
  /** 정오 그늘 비율 평균 0~1. 그늘 데이터가 있는 구간이 없으면 `null`. */
  readonly noonShadeAverage: number | null;
};

export function summarizeValleys(valleys: readonly Valley[]): ValleySummary {
  let segments = 0;
  let facilities = 0;
  let shadeSum = 0;
  let shadeCount = 0;
  for (const valley of valleys) {
    segments += valley.segments.length;
    facilities += valley.facilities.length;
    for (const segment of valley.segments) {
      const ratio = noonShadeRatio(segment);
      if (ratio === undefined) continue;
      shadeSum += ratio;
      shadeCount += 1;
    }
  }
  return {
    valleys: valleys.length,
    segments,
    facilities,
    noonShadeAverage: shadeCount === 0 ? null : shadeSum / shadeCount,
  };
}
