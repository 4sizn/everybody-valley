/**
 * 시트 인셋 → 카메라 offset (C6).
 *
 * `viewportCenterOffset` 는 `focusSegment`·`focusValley` 가 쓰는 순수 함수 하나다.
 * 여기서 검사하는 것: 시트 3단(접힘·중간·펼침) 각각에서 어떤 offset 이 나오는지,
 * 옛 `VALLEY_DETAIL_OFFSET`(-90)이 전제한 상태를 역산해 고정하는 회귀, 인셋이 아직
 * 측정되지 않은 초기값(0/0)에서 안전한지.
 */
import { describe, expect, it } from 'vitest';
import { SHEET_SNAP_METRICS, sheetVisibleHeight } from '../src/application/state/SheetSnap';
import {
  computeViewportInsets,
  INITIAL_VIEWPORT_INSETS,
} from '../src/application/state/ViewportInsets';
import { viewportCenterOffset } from '../src/domain/camera/ViewportCameraOffset';

/** apps/valley-map `SIZES.topbarHeight` 와 같은 값 — 재계산이 아니라 문서화를 위해 복제. */
const TOPBAR_HEIGHT = 48;
/** F1b 가 계곡 카메라 수치를 눈으로 잡을 때 쓴 참조 뷰포트(web 1440×757)의 높이. */
const REFERENCE_HEIGHT = 757;

describe('viewportCenterOffset — 시트 3단 각각의 offset', () => {
  const metrics = SHEET_SNAP_METRICS.valley;

  it.each([
    ['peek', 68] as const,
    ['half', REFERENCE_HEIGHT * metrics.halfRatio] as const,
    ['full', REFERENCE_HEIGHT * metrics.fullRatio] as const,
  ])('%s 스냅 — 가시 높이 %dpx', (snap, expectedVisibleHeight) => {
    const bottom = sheetVisibleHeight(snap, REFERENCE_HEIGHT, metrics);
    expect(bottom).toBeCloseTo(expectedVisibleHeight, 5);

    const insets = computeViewportInsets({
      topbarHeight: TOPBAR_HEIGHT,
      safeAreaTop: 0,
      sheetVisibleHeight: bottom,
    });
    expect(viewportCenterOffset(insets)).toEqual([0, (TOPBAR_HEIGHT - bottom) / 2]);
  });

  it('시트가 커질수록(접힘→중간→펼침) 더 위로 민다 — offset 은 단조 감소', () => {
    const offsets = (['peek', 'half', 'full'] as const).map((snap) => {
      const bottom = sheetVisibleHeight(snap, REFERENCE_HEIGHT, metrics);
      const insets = computeViewportInsets({
        topbarHeight: TOPBAR_HEIGHT,
        safeAreaTop: 0,
        sheetVisibleHeight: bottom,
      });
      return viewportCenterOffset(insets)[1];
    });
    expect(offsets[0]).toBeGreaterThan(offsets[1] as number);
    expect(offsets[1]).toBeGreaterThan(offsets[2] as number);
  });
});

describe('viewportCenterOffset — 옛 VALLEY_DETAIL_OFFSET(-90)과의 관계', () => {
  it('top=0·bottom=180 인 상태에서 정확히 -90 을 낸다', () => {
    // -90 은 이 식으로 계산된 값이 아니라 festival focusSpot 의 offset 을 그대로
    // 옮겨온 것이었다(CameraPresets.ts 의 옛 VALLEY_DETAIL_OFFSET 주석 "festival 과
    // 같다"). 그래서 실제 시트 치수(45vh 등)로는 재현되지 않는다 — 역산한 이 상태
    // (top 없음·bottom 180px)에서만 정확히 나온다. 이 테스트는 그 수학적 사실을
    // 고정해 둔다 — 식이 바뀌면 -90 이 뜻하던 상태도 같이 바뀐다는 신호다.
    expect(viewportCenterOffset({ top: 0, bottom: 180 })).toEqual([0, -90]);
  });
});

describe('viewportCenterOffset — 초기값(측정 전)', () => {
  it('인셋이 0/0(INITIAL_VIEWPORT_INSETS)이면 offset 도 0 — 크래시·NaN 없이 안전', () => {
    expect(viewportCenterOffset(INITIAL_VIEWPORT_INSETS)).toEqual([0, 0]);
  });
});
