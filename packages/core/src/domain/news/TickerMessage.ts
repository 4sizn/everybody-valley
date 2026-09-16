/**
 * 실시간 소식 티커 문구. 데모의 `TICKS` 와 같은 순서·같은 문장.
 */
export type TickerMessage = {
  readonly headline: string;
  /** 문구 뒤에 작게 붙는 꼬리표. */
  readonly badge: string;
};

export const TICKER_HEADER = '실시간 소식';

export const TICKER_MESSAGES: readonly TickerMessage[] = [
  { headline: '지금 상황을 제보해 주세요', badge: '현장 제보' },
  { headline: '교통 통제·공지도 여기 모여요', badge: '공식 소식' },
  { headline: '소식이 들어오면 여기 먼저 떠요', badge: '실시간' },
];

/** 데모의 `setInterval(..., 3200)` 과 내부 `setTimeout(..., 350)`. */
export const TICKER_TIMING = {
  rotateMs: 3200,
  fadeMs: 350,
} as const;
