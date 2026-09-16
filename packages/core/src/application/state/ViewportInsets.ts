/**
 * 뷰포트 인셋 (C8) — 화면에서 지도가 아닌 고정 UI 가 가리는 여백.
 *
 * `valley-ds/docs/map-architecture.md` §5 의 "현재 시트 스냅과 상단 인셋을 실측해
 * '실제로 보이는 사각형'의 중심을 구한다" 가 참조하는 값이다. **이 PR(C8)은 이 값을
 * 정확히 `AppState` 에 실어 내보내는 것까지다** — 이 값을 읽어 카메라 중심을 옮기는
 * 것은 C6 의 일이고, 여기서는 그 코드를 쓰지 않는다(결정 (f)).
 */

export type ViewportInsets = {
  /** 위에서 가려지는 높이(px) — 상단바 + 안전 영역(top). */
  readonly top: number;
  /** 아래에서 가려지는 높이(px) — 지금 스냅의 시트 가시 높이. */
  readonly bottom: number;
};

/** 표현 계층이 아직 측정 전일 때의 값 — `camera: null` 과 같은 "모름" 자리. */
export const INITIAL_VIEWPORT_INSETS: ViewportInsets = { top: 0, bottom: 0 };

export type ViewportInsetInputs = {
  readonly topbarHeight: number;
  readonly safeAreaTop: number;
  readonly sheetVisibleHeight: number;
};

/** 순수 합산 — 인셋이 어디서 왔는지 한 곳에 모아 둔다. */
export function computeViewportInsets(inputs: ViewportInsetInputs): ViewportInsets {
  return {
    top: inputs.topbarHeight + inputs.safeAreaTop,
    bottom: inputs.sheetVisibleHeight,
  };
}
