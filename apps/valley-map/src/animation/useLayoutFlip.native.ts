/**
 * 목록 배치 전환 — 네이티브 자리표시자.
 *
 * FLIP 은 "바꾸기 전/후의 화면 좌표"를 재는 기법이다. web 에서는
 * `getBoundingClientRect` + Web Animations API 로 한 프레임 안에 끝나지만,
 * 네이티브에서는 `onLayout` 이 비동기라 같은 프레임에 First/Last 를 잴 수
 * 없다. Reanimated 의 layout animation(`LinearTransition`)이 그 역할을
 * 대신하므로, 네이티브 어댑터를 채울 때 그쪽으로 붙이는 것이 맞다.
 *
 * 지금은 배치가 즉시 바뀐다 — 애니메이션만 없고 결과 화면은 같다.
 */
import { useMemo } from 'react';
import type { LayoutFlipController } from './useLayoutFlip';

export function useLayoutFlip(): LayoutFlipController {
  return useMemo(
    () => ({
      registerItem: () => {},
      capture: () => {},
      play: () => {},
      cancel: () => {},
    }),
    [],
  );
}
