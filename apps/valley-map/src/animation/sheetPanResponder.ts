/**
 * 시트 손잡이 제스처 (C8, 결정 (e)) — 드래그 + 탭.
 *
 * 하나의 `PanResponder` 가 둘 다 맡는다. 손잡이만 잡는다(호출부가 이 함수가 돌려주는
 * `panHandlers` 를 손잡이 `View` 에만 건다) — 목록 `ScrollView` 의 스크롤 제스처와
 * 겹치지 않는다.
 *
 *   · 이동이 `TAP_SLOP_PX` 이내면 탭 — 다음 칸으로 순환한다(해석 1,
 *     `peek → half → full → peek`). festival 의 옛 2단 토글도 이 순환을 탄다.
 *   · 그 밖에는 드래그 — 잡는 순간 `beginDrag()` 로 컨테이너를 `full` 로 강제하고
 *     그 순간의 드래그 좌표계 시작값을 받는다(세 스냅을 자유롭게 오가려면 컨테이너가
 *     가장 커야 한다 — `useSheetTranslate` 참고). 놓으면 가장 가까운 스냅을 골라
 *     `endDrag` 로 정착시키고 세션에 알린다.
 *
 * 데모는 `onclick` 토글과 pointerdown/up 드래그 판정을 동시에 걸어 두 동작이
 * 서로 상쇄됐다("손잡이를 누르면 토글" 만 보였다) — 스냅이 셋으로 늘면서 그
 * 우연한 결과에 기댈 수 없어 탭/드래그를 명시적으로 가른다.
 *
 * 훅이 아니다 — 순수 팩토리다. 호출부(`BottomSheet`)가 `useMemo` 로 감싸 입력이
 * 바뀔 때만 새로 만든다.
 */
import {
  type MapSession,
  nearestSheetSnap,
  type SheetSnap,
  type SheetSnapMetrics,
  sheetDragTranslateY,
} from '@modu-valley/core';
import { type Animated, PanResponder, type PanResponderInstance } from 'react-native';

/** 이 이하로 움직이면 드래그가 아니라 탭이다. */
const TAP_SLOP_PX = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export type SheetPanResponderOptions = {
  readonly session: MapSession;
  readonly translateY: Animated.Value;
  readonly windowHeight: number;
  readonly metrics: SheetSnapMetrics;
  readonly beginDrag: () => number;
  readonly endDrag: (committedSnap: SheetSnap) => void;
};

export function createSheetPanResponder({
  session,
  translateY,
  windowHeight,
  metrics,
  beginDrag,
  endDrag,
}: SheetPanResponderOptions): PanResponderInstance {
  // 드래그 좌표계(항상 full 컨테이너 기준) 의 한계 — full 은 0, peek 이 가장 아래.
  const minTranslateY = sheetDragTranslateY('full', windowHeight, metrics);
  const maxTranslateY = sheetDragTranslateY('peek', windowHeight, metrics);
  let dragStart = 0;

  const commit = (dy: number): void => {
    if (Math.abs(dy) <= TAP_SLOP_PX) {
      // 탭 — beginDrag 가 이미 컨테이너를 full 로 바꿔 놨으므로(드래그일지 아직 모른다),
      // 지금 있던 스냅으로 먼저 되돌린 뒤(움직임이 없었으니 눈에 띄지 않는다) 다음 칸으로.
      endDrag(nearestSheetSnap(dragStart, windowHeight, metrics));
      session.cycleSheetSnap();
      return;
    }
    const finalValue = clamp(dragStart + dy, minTranslateY, maxTranslateY);
    const snap: SheetSnap = nearestSheetSnap(finalValue, windowHeight, metrics);
    endDrag(snap);
    session.setSheetSnap(snap);
  };

  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      dragStart = beginDrag();
    },
    onPanResponderMove: (_event, gestureState) => {
      translateY.setValue(clamp(dragStart + gestureState.dy, minTranslateY, maxTranslateY));
    },
    onPanResponderRelease: (_event, gestureState) => commit(gestureState.dy),
    onPanResponderTerminate: (_event, gestureState) => commit(gestureState.dy),
  });
}
