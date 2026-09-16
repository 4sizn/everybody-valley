/**
 * 좁은 컬럼에서 시트 위 오버레이(티커·그늘 트랙)가 컨트롤 열 위로 올라갈 때
 * 쓰는 자리 계산 — 순수 함수(X4).
 *
 * 고친 버그 — `MapScreen` 이 예전엔 "좁으면 한 행 위로" 를 티커와
 * `ShadeHourTrack` 양쪽에 **따로** 적용했다. 둘 다 같은 상수(컨트롤 행 높이 +
 * 행 간격)를 한 번 더해 같은 결과값을 냈고, 그늘 트랙이 켜지면(F4) 두 오버레이가
 * 정확히 같은 좌표에 겹쳤다 — 그늘 트랙이 나중에 그려져 티커를 완전히 덮었다
 * (390×844 실측, `[data-mv="valley-ticker"]`·`[data-mv="ctrl"]` 의
 * `getBoundingClientRect()` 가 한 픽셀도 다르지 않았다).
 *
 * 이 함수는 "몇 번째 행인가"를 세어 같은 행 높이를 곱한다 — 트랙이 그 자리를
 * 쓰고 있으면 티커는 그 위(두 번째) 행으로, 트랙이 없으면 티커는 첫 번째 행으로
 * 간다. 상수를 더 얹는 대신 이 함수 하나로 정리해 다음 오버레이가 늘어도
 * 같은 자리를 다시 만들지 않는다.
 *
 * festival(`/firework`)은 `trackVisible` 이 항상 `false`(그늘 트랙 자체가 없다)라
 * 넓은 화면과 같은 값(컨트롤 바로 위 `tickerGap`)이 그대로 나온다 — 파리티 불변.
 */

export type NarrowOverlayStackInput = {
  /** 원형 컨트롤 열의 bottom 오프셋 — 두 오버레이 모두 이 값을 기준으로 쌓는다. */
  readonly controlsBottom: number;
  /** 지금 스냅에서 남는 시트 높이 — 넓은 컬럼의 티커는 이 값에 `tickerGap` 만 더한다. */
  readonly visibleHeight: number;
  /** 컬럼이 데스크톱 폭(`SIZES.column`)보다 좁다. */
  readonly isNarrow: boolean;
  /** `ShadeHourTrack` 이 지금 실제로 그려지는가(그늘 보기 on). */
  readonly trackVisible: boolean;
  /** 좁은 화면에서 한 행의 높이 — `SIZES.reportHeight + CONTROL_ROW_GAP`. */
  readonly rowHeight: number;
  /** 넓은 컬럼에서 티커가 시트 위로 뜨는 기본 간격 — `SIZES.tickerGap`. */
  readonly tickerGap: number;
};

export type NarrowOverlayStack = {
  readonly trackBottom: number;
  readonly tickerBottom: number;
};

export function narrowOverlayStack(input: NarrowOverlayStackInput): NarrowOverlayStack {
  const { controlsBottom, visibleHeight, isNarrow, trackVisible, rowHeight, tickerGap } = input;

  if (!isNarrow) {
    // 데스크톱 — 데모 그대로. 트랙은 컨트롤과 같은 행(옆), 티커는 독립된 기본 간격.
    return { trackBottom: controlsBottom, tickerBottom: visibleHeight + tickerGap };
  }

  // 좁은 컬럼 — 트랙이 있으면 그 트랙이 첫 번째 행을 쓰고, 티커는 그 위(트랙이
  // 있으면 두 번째, 없으면 첫 번째) 행으로 올라간다. 같은 행을 두 번 내주지 않는다.
  const trackRows = trackVisible ? 1 : 0;
  const tickerRows = trackRows + 1;
  return {
    trackBottom: controlsBottom + trackRows * rowHeight,
    tickerBottom: controlsBottom + tickerRows * rowHeight,
  };
}
