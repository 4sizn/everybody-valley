/**
 * 중앙 컬럼. 데모의 `.col`.
 *
 * 시트와 우측 원형 컨트롤이 같은 축에 정렬되도록 하는 기준 폭이다.
 *   width: min(560px, 100% - 32px)
 * 데모는 `left:50% + translateX(-50%)` 로 가운데를 잡지만, RN 에서는
 * 부모가 `alignItems:'center'` 로 같은 결과를 만든다 — 네이티브에서도 동작한다.
 *
 * `pointer-events:none` 이 걸려 있어 컬럼 자체는 지도 조작을 가로막지 않고,
 * 안쪽 컨트롤만 `auto` 로 되살린다(데모와 동일).
 */
import {
  SHEET_SNAP_METRICS,
  type SheetSnap,
  type SheetSnapMetrics,
  sheetVisibleHeight,
} from '@modu-valley/core';
import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSession } from '@/session';
import { ABSOLUTE_FILL } from '@/theme/layout';
import { SIZES } from '@/theme/tokens';

/**
 * 계곡 화면 · 좁은 컬럼(폰)의 `half` 스냅 비율 — V1 (i). 폰에서는 45% 시트 위 지도 띠에
 * 컨트롤 4 + 트랙 + 제보가 다 들어와 지도가 보이지 않았다(V1 문제 ⑤). 데스크톱은
 * core `SHEET_SNAP_METRICS.halfRatio`(0.45) 그대로고 festival(`/firework`)은 어느
 * 폭에서도 바뀌지 않는다 — 데모 파리티(CLAUDE.md). `peek`·`full` 은 이 오버라이드가
 * 없다(C8 결정 (a)(b) 는 폭에 따른 예외를 두지 않았다).
 */
const VALLEY_PHONE_HALF_RATIO = 0.4;

export function useColumnWidth(): number {
  const { width } = useWindowDimensions();
  return Math.min(SIZES.column, width - SIZES.gutter * 2);
}

/** 컬럼이 온전한 폭(560)을 못 쓰는 화면 — `MapScreen` 의 티커·트랙 규칙과 같은 판정. */
export function useIsNarrowColumn(): boolean {
  return useColumnWidth() < SIZES.column;
}

/** 지금 장면·컬럼 폭에 적용할 스냅 치수(C8) — `half` 만 좁은 계곡 컬럼에서 낮아진다. */
export function useSheetSnapMetrics(): SheetSnapMetrics {
  const narrow = useIsNarrowColumn();
  const scene = useSession().scene;
  const base = SHEET_SNAP_METRICS[scene];
  return scene === 'valley' && narrow ? { ...base, halfRatio: VALLEY_PHONE_HALF_RATIO } : base;
}

/**
 * 지금 스냅에서 화면에 남는 시트 높이(C8) — 컨트롤·티커·트랙의 bottom 오프셋과
 * `viewportInsets.bottom` 의 재료다. `peek`/`half` 값은 예전(2단) 그대로다.
 */
export function useSheetVisibleHeight(snap: SheetSnap): number {
  const { height } = useWindowDimensions();
  const metrics = useSheetSnapMetrics();
  return sheetVisibleHeight(snap, height, metrics);
}

export type CenterColumnProps = {
  readonly children: ReactNode;
};

export function CenterColumn({ children }: CenterColumnProps) {
  const width = useColumnWidth();
  return (
    <View style={styles.frame}>
      <View style={[styles.column, { width }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    ...ABSOLUTE_FILL,
    alignItems: 'center',
    zIndex: 5,
    // 데모 `.col{pointer-events:none}` — 컬럼 자체는 지도 조작을 가로막지 않고
    // 안쪽 컨트롤만 되살린다. RN 0.86 부터 prop 이 아니라 style 로 준다.
    pointerEvents: 'box-none',
  },
  column: {
    flex: 1,
    pointerEvents: 'box-none',
  },
});
