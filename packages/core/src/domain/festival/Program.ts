/** 행사 프로그램 카드 한 장. 데모의 '전야제' / '메인 불꽃쇼'. */
export type Program = {
  readonly id: string;
  readonly title: string;
  /** '2026년 9월 4일 (금) · 20:00–20:20' */
  readonly schedule: string;
  /** '시민 불꽃쇼 · 드론쇼' */
  readonly summary: string;
};
