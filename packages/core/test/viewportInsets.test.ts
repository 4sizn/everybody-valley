/**
 * 뷰포트 인셋 순수 합산 (C8) — C6 이 소비할 값을 여기서 정확히 만든다(결정 (f),
 * 카메라 이동은 이 PR 의 범위 밖).
 */
import { describe, expect, it } from 'vitest';
import {
  computeViewportInsets,
  INITIAL_VIEWPORT_INSETS,
} from '../src/application/state/ViewportInsets';

describe('computeViewportInsets', () => {
  it('top 은 상단바 + 안전 영역, bottom 은 지금 스냅의 시트 가시 높이', () => {
    const insets = computeViewportInsets({
      topbarHeight: 48,
      safeAreaTop: 44,
      sheetVisibleHeight: 380,
    });
    expect(insets).toEqual({ top: 92, bottom: 380 });
  });

  it('안전 영역이 0 이면(web) top 은 상단바 높이 그대로', () => {
    const insets = computeViewportInsets({
      topbarHeight: 48,
      safeAreaTop: 0,
      sheetVisibleHeight: 68,
    });
    expect(insets).toEqual({ top: 48, bottom: 68 });
  });

  it('측정 전 초깃값은 0/0', () => {
    expect(INITIAL_VIEWPORT_INSETS).toEqual({ top: 0, bottom: 0 });
  });
});
