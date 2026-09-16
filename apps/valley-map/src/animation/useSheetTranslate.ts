/**
 * 시트 스냅 이동 (C8 — 3단 `peek`/`half`/`full`).
 *
 * 데모 CSS:
 *   .sheet      { transition: transform .32s cubic-bezier(.32,.72,0,1) }
 *   .sheet.down { transform: translateX(-50%) translateY(calc(100% - 68px)) }
 *
 * **컨테이너 높이는 정지 상태에서 스냅마다 다르다**(`sheetContainerHeight`) — `peek`/`half`
 * 는 `half` 컨테이너를 빌려 쓰고(옛 2단 시스템·`main` 과 정확히 같은 값, `translateY` 도
 * `half` 에서 정확히 0), `full` 만 자기 컨테이너(85vh)를 쓴다. 컨테이너를 "가장 큰 스냅
 * 기준으로 고정"했던 첫 구현은 `half`/`peek` 에서도 항상 0 이 아닌 `translateY` 를
 * 만들어, 그 소수점 `transform` 이 걸린 합성 레이어가 시트 텍스트를 서브픽셀로
 * 재샘플링했다 — `/firework` 다크 픽셀 diff 에서 시트 텍스트 영역에만 몰린 차이로
 * 드러났다(지도는 별도 레이어라 0px). `half` 를 `main` 과 **완전히 같은 기하**
 * (컨테이너=45vh, translateY=0)로 되돌려 회귀를 고친다.
 *
 * 컨테이너가 스냅마다 다르니 `full` ↔ `peek`/`half` 사이를 오갈 때는 컨테이너 자체가
 * 커지거나 줄어야 한다. `height` 는 애니메이션할 수 없는 값이라(레이아웃을 매 프레임
 * 다시 재는 것과 같다) 대신 순간 전환 + 위치 보정으로 처리한다:
 *   1. **`full` 로 진입** — 애니메이션을 시작하기 전에 컨테이너를 먼저 `full` 로 키우고,
 *      화면 위치가 그대로 있도록 `translateY` 를 순간 보정한다(사용자 눈에는 아무 일도
 *      없다). 그 다음 `translateY` 만 목표(0)로 애니메이션한다.
 *   2. **`full` 에서 이탈** — 컨테이너를 `full` 로 유지한 채(드래그 좌표계,
 *      `sheetDragTranslateY`) `translateY` 를 목표 스냅 자리로 애니메이션하고, 끝난
 *      뒤에 컨테이너를 목표 스냅의 정지 컨테이너로 줄이며 `translateY` 를 그 정지
 *      값으로 순간 보정한다 — 두 표현이 같은 화면 위치라 눈에 띄지 않는다.
 *   3. **`peek` ↔ `half`** — 둘 다 이미 `half` 컨테이너라 컨테이너는 바뀌지 않는다(옛
 *      2단 시스템 그대로).
 *
 * 드래그(`sheetPanResponder`)는 손잡이를 잡는 순간 `beginDrag()` 로 컨테이너를 `full`
 * 로 강제하고(세 스냅을 자유롭게 오가려면 컨테이너가 가장 커야 한다) 그 순간의 드래그
 * 좌표계 값을 동기로 돌려받는다 — effect 를 기다리지 않아 한 프레임의 어긋남도 없다.
 * 놓으면 `endDrag(committedSnap)` 이 위 1~3 을 그대로 적용해 정착시킨다.
 */
import {
  type SheetSnap,
  type SheetSnapMetrics,
  sheetContainerHeight,
  sheetDragTranslateY,
  sheetTranslateY,
} from '@modu-valley/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { USE_NATIVE_DRIVER } from './driver';
import { SHEET } from './easings';

const DURATION_MS = 320;

export type SheetTranslate = {
  /** `BottomSheet` 의 `height` prop — 지금 실제로 적용 중인 컨테이너 높이. */
  readonly containerHeight: number;
  readonly translateY: Animated.Value;
  /** 손잡이를 잡는 순간 호출 — 컨테이너를 `full` 로 강제하고 드래그 시작값을 동기로 돌려준다. */
  readonly beginDrag: () => number;
  /** 손잡이를 놓는 순간 호출 — 커밋된 스냅으로 정착시킨다(컨테이너 축소 포함). */
  readonly endDrag: (committedSnap: SheetSnap) => void;
};

export function useSheetTranslate(
  snap: SheetSnap,
  windowHeight: number,
  metrics: SheetSnapMetrics,
): SheetTranslate {
  const [containerHeight, setContainerHeight] = useState(() =>
    sheetContainerHeight(snap, windowHeight, metrics),
  );
  const translateY = useRef(
    new Animated.Value(sheetTranslateY(snap, windowHeight, metrics)),
  ).current;
  const containerHeightRef = useRef(containerHeight);
  containerHeightRef.current = containerHeight;
  const draggingRef = useRef(false);

  /** 목표 스냅으로 정착시킨다 — 컨테이너 전환이 필요하면 위 1/2, 아니면 3. */
  const settleTo = useCallback(
    (target: SheetSnap) => {
      const currentContainer = containerHeightRef.current;
      const fullContainer = sheetContainerHeight('full', windowHeight, metrics);

      if (target === 'full' && currentContainer !== fullContainer) {
        translateY.stopAnimation((current) => {
          translateY.setValue(current + (fullContainer - currentContainer));
          setContainerHeight(fullContainer);
          Animated.timing(translateY, {
            toValue: sheetTranslateY('full', windowHeight, metrics),
            duration: DURATION_MS,
            easing: SHEET,
            useNativeDriver: USE_NATIVE_DRIVER,
          }).start();
        });
        return;
      }

      if (target !== 'full' && currentContainer === fullContainer) {
        const dragTarget = sheetDragTranslateY(target, windowHeight, metrics);
        Animated.timing(translateY, {
          toValue: dragTarget,
          duration: DURATION_MS,
          easing: SHEET,
          useNativeDriver: USE_NATIVE_DRIVER,
        }).start(({ finished }) => {
          if (!finished) return;
          translateY.setValue(sheetTranslateY(target, windowHeight, metrics));
          setContainerHeight(sheetContainerHeight(target, windowHeight, metrics));
        });
        return;
      }

      Animated.timing(translateY, {
        toValue: sheetTranslateY(target, windowHeight, metrics),
        duration: DURATION_MS,
        easing: SHEET,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    },
    [windowHeight, metrics, translateY],
  );

  useEffect(() => {
    if (draggingRef.current) return; // 드래그 중엔 panResponder 가 translateY 를 직접 민다.
    settleTo(snap);
  }, [snap, settleTo]);

  const beginDrag = useCallback((): number => {
    draggingRef.current = true;
    const fullContainer = sheetContainerHeight('full', windowHeight, metrics);
    const dragValue = sheetDragTranslateY(snap, windowHeight, metrics);
    setContainerHeight(fullContainer);
    translateY.setValue(dragValue);
    return dragValue;
  }, [snap, windowHeight, metrics, translateY]);

  const endDrag = useCallback(
    (committedSnap: SheetSnap) => {
      draggingRef.current = false;
      settleTo(committedSnap);
    },
    [settleTo],
  );

  return { containerHeight, translateY, beginDrag, endDrag };
}
