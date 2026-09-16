/**
 * 혼잡도. 데모에서는 카드 안의 자유 문자열이지만, 색·필터·정렬이 붙을 자리라
 * 도메인 값으로 올려 둔다. 표시 문구는 데모와 동일하다.
 */
export const CROWD_LEVELS = ['relaxed', 'moderate', 'busy', 'severe'] as const;
export type CrowdLevel = (typeof CROWD_LEVELS)[number];

const CROWD_LABELS: Readonly<Record<CrowdLevel, string>> = {
  relaxed: '여유',
  moderate: '보통',
  busy: '혼잡',
  severe: '극심한 혼잡 예상',
};

export function crowdLabel(level: CrowdLevel): string {
  return CROWD_LABELS[level];
}
