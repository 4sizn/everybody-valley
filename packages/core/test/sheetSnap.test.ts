/**
 * 시트 스냅 순수 함수 (C8) — 순환·픽셀 변환·URL 왕복·라우트별 상수를 고정한다.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHEET_SNAP,
  isSheetSnap,
  nearestSheetSnap,
  nextSheetSnap,
  parseSheetSnapParam,
  SHEET_SNAP_METRICS,
  type SheetSnapMetrics,
  sheetContainerHeight,
  sheetDragTranslateY,
  sheetSnapToParam,
  sheetTranslateY,
  sheetVisibleHeight,
} from '../src/application/state/SheetSnap';

const METRICS: SheetSnapMetrics = { peekPx: 68, halfRatio: 0.45, fullRatio: 0.85 };
const WINDOW_HEIGHT = 844; // docs/TODO.md C8 실측 뷰포트(390×844)

describe('스냅 순환 (결정 (e) 해석 1)', () => {
  it('peek → half → full → peek 순서로 3칸을 왕복한다', () => {
    expect(nextSheetSnap('peek')).toBe('half');
    expect(nextSheetSnap('half')).toBe('full');
    expect(nextSheetSnap('full')).toBe('peek');
  });

  it('기본 스냅은 half 다', () => {
    expect(DEFAULT_SHEET_SNAP).toBe('half');
  });

  it('isSheetSnap 은 세 값만 참이다', () => {
    expect(isSheetSnap('peek')).toBe(true);
    expect(isSheetSnap('half')).toBe(true);
    expect(isSheetSnap('full')).toBe(true);
    expect(isSheetSnap('down')).toBe(false);
    expect(isSheetSnap(undefined)).toBe(false);
    expect(isSheetSnap(null)).toBe(false);
  });
});

describe('라우트별 상수 (결정 (a)(b))', () => {
  it('festival · valley 모두 접힘 68px · 중간 45vh · 펼침 85vh 다', () => {
    expect(SHEET_SNAP_METRICS.festival).toEqual({ peekPx: 68, halfRatio: 0.45, fullRatio: 0.85 });
    expect(SHEET_SNAP_METRICS.valley).toEqual({ peekPx: 68, halfRatio: 0.45, fullRatio: 0.85 });
  });
});

describe('픽셀 변환 — 회귀 고정 (결정 (a), "지금 두 값 그대로")', () => {
  it('peek 은 창 높이와 무관하게 68px', () => {
    expect(sheetVisibleHeight('peek', WINDOW_HEIGHT, METRICS)).toBe(68);
    expect(sheetVisibleHeight('peek', 1200, METRICS)).toBe(68);
  });

  it('half 는 390×844 에서 380px — 지금 값과 같다', () => {
    expect(sheetVisibleHeight('half', WINDOW_HEIGHT, METRICS)).toBeCloseTo(379.8, 5);
  });

  it('full(신설)은 390×844 에서 85vh', () => {
    expect(sheetVisibleHeight('full', WINDOW_HEIGHT, METRICS)).toBeCloseTo(717.4, 5);
  });

  it('정지 상태 컨테이너 — peek/half 는 half 컨테이너를 빌리고(main 회귀), full 만 자기 컨테이너', () => {
    expect(sheetContainerHeight('peek', WINDOW_HEIGHT, METRICS)).toBeCloseTo(379.8, 5);
    expect(sheetContainerHeight('half', WINDOW_HEIGHT, METRICS)).toBeCloseTo(379.8, 5);
    expect(sheetContainerHeight('full', WINDOW_HEIGHT, METRICS)).toBeCloseTo(717.4, 5);
  });

  it('정지 상태 translateY — half·full 은 0(main 의 translateY(0) 과 정확히 같다), peek 만 0 이 아니다', () => {
    expect(sheetTranslateY('half', WINDOW_HEIGHT, METRICS)).toBe(0);
    expect(sheetTranslateY('full', WINDOW_HEIGHT, METRICS)).toBe(0);
    expect(sheetTranslateY('peek', WINDOW_HEIGHT, METRICS)).toBeCloseTo(379.8 - 68, 5);
  });

  it('드래그 좌표계는 항상 full 컨테이너 기준 — 세 스냅을 오갈 수 있는 값이다', () => {
    const container = sheetContainerHeight('full', WINDOW_HEIGHT, METRICS);
    expect(sheetDragTranslateY('full', WINDOW_HEIGHT, METRICS)).toBe(0);
    expect(sheetDragTranslateY('half', WINDOW_HEIGHT, METRICS)).toBeCloseTo(container - 379.8, 5);
    expect(sheetDragTranslateY('peek', WINDOW_HEIGHT, METRICS)).toBeCloseTo(container - 68, 5);
  });
});

describe('드래그 커밋 (결정 (e), 손잡이 드래그)', () => {
  it('translateY 가 각 스냅의 정확한 값이면 그 스냅을 고른다', () => {
    for (const snap of ['peek', 'half', 'full'] as const) {
      const target = sheetDragTranslateY(snap, WINDOW_HEIGHT, METRICS);
      expect(nearestSheetSnap(target, WINDOW_HEIGHT, METRICS)).toBe(snap);
    }
  });

  it('두 스냅 사이면 더 가까운 쪽을 고른다', () => {
    const half = sheetDragTranslateY('half', WINDOW_HEIGHT, METRICS);
    const full = sheetDragTranslateY('full', WINDOW_HEIGHT, METRICS);
    const closeToFull = full + (half - full) * 0.1;
    const closeToHalf = full + (half - full) * 0.9;
    expect(nearestSheetSnap(closeToFull, WINDOW_HEIGHT, METRICS)).toBe('full');
    expect(nearestSheetSnap(closeToHalf, WINDOW_HEIGHT, METRICS)).toBe('half');
  });
});

describe('URL 왕복 (결정 (d), "기본 스냅일 때는 파라미터를 쓰지 않는다")', () => {
  it('기본 스냅(half)은 파라미터가 없다', () => {
    expect(sheetSnapToParam('half')).toBeUndefined();
  });

  it('peek·full 은 그 값 그대로', () => {
    expect(sheetSnapToParam('peek')).toBe('peek');
    expect(sheetSnapToParam('full')).toBe('full');
  });

  it('파라미터가 없거나 잘못됐으면 기본 스냅으로 파싱한다', () => {
    expect(parseSheetSnapParam(undefined)).toBe('half');
    expect(parseSheetSnapParam(null)).toBe('half');
    expect(parseSheetSnapParam('')).toBe('half');
    expect(parseSheetSnapParam('down')).toBe('half');
  });

  it('유효한 값은 그대로 파싱한다', () => {
    expect(parseSheetSnapParam('peek')).toBe('peek');
    expect(parseSheetSnapParam('full')).toBe('full');
  });

  it('왕복 — 값 → 파라미터 → 값이 같다(기본 제외 세 값 모두)', () => {
    for (const snap of ['peek', 'half', 'full'] as const) {
      const param = sheetSnapToParam(snap);
      expect(parseSheetSnapParam(param)).toBe(snap);
    }
  });
});
