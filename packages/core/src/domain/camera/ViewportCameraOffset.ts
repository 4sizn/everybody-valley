/**
 * 시트 인셋 → 카메라 offset (C6).
 *
 * `CameraPresets.ts` 의 `VALLEY_DETAIL_OFFSET`·`VALLEY_OVERVIEW_OFFSET` 이 하드코딩해
 * 온 의도 — "시트에 가리지 않게 중심을 위로 밀기" — 를 실제 인셋(top·bottom, px)으로
 * 일반화한 것이다. 시트가 3단(C8)이 되면서 그 두 상수는 `half` 스냅 하나만 맞고
 * `peek`·`full` 에서는 어긋난다 — 그게 이 함수가 고치는 것이다.
 *
 * 원본 spotts.kr/firework 의 `measuredCenterOffsetPx`(valley-ds `src/use-map-camera.ts`)와
 * 같은 식이다 — "보이는 사각형"([top, H−bottom])의 중심이 화면 전체 중심(H/2)에서 얼마나
 * 떨어져 있는지를 구해 그만큼 반대로 밀어준다.
 *
 *   visibleCenter = top + (H − top − bottom) / 2
 *   offset        = visibleCenter − H/2 = (top − bottom) / 2
 *
 * 뷰포트 높이(H)는 상쇄되어 식에 남지 않는다 — 인셋 두 값의 차이만 있으면 된다.
 *
 * **옛 `VALLEY_DETAIL_OFFSET`(-90)과의 관계** — 이 식으로 거꾸로 풀면 top=0·bottom=180
 * 을 전제한 값이다. 다만 그 180px 은 실제 어떤 시트 치수(45vh 등)로도 나오지 않는다 —
 * -90 은 애초 이 식으로 계산된 값이 아니라 festival `focusSpot` 의 offset 을 그대로
 * 옮겨온 것이었다(`CameraPresets.ts` 의 옛 주석 "festival 과 같다"). 그래서 그 값 자체는
 * 실측 근거가 없고, 테스트(`ViewportCameraOffset.test.ts`)는 "이 식이 그 상태에서 정확히
 * -90 을 낸다"는 수학적 사실만 회귀로 고정해 둔다.
 */
export type CameraViewportInsets = {
  /** 위에서 가려지는 높이(px) — 상단바 + 안전 영역(top). */
  readonly top: number;
  /** 아래에서 가려지는 높이(px) — 지금 시트 스냅의 가시 높이. */
  readonly bottom: number;
};

/**
 * 인셋에서 카메라 `offset` 을 낸다. x 는 항상 0(계곡 화면은 좌우로 밀 이유가 없다).
 * 인셋이 둘 다 0(측정 전 초기값)이면 `[0, 0]` — 밀지 않을 뿐 크래시·NaN 은 없다.
 */
export function viewportCenterOffset(
  insets: CameraViewportInsets,
): readonly [x: number, y: number] {
  return [0, (insets.top - insets.bottom) / 2];
}
