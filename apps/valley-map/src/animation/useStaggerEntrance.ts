/**
 * 면 전환 뒤 항목이 한 박자씩 늦게 세워지는 등장 연출.
 *
 * 데모의 `stagger(nodes)`:
 *   keyframes: rotateX(34deg) translateY(13px) opacity 0 → none / 1
 *   duration 380ms, delay 60 + i*55, easing cubic-bezier(.22,.9,.3,1)
 *   perspective 900px, 앞쪽 8개만
 */
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { USE_NATIVE_DRIVER } from './driver';
import { STAGGER } from './easings';

const DURATION_MS = 380;
const BASE_DELAY_MS = 60;
const STEP_DELAY_MS = 55;
/** 데모의 `.slice(0, 8)`. */
export const STAGGER_LIMIT = 8;

export type StaggerStyle = {
  readonly opacity: Animated.Value;
  readonly transform: readonly [
    { perspective: number },
    { rotateX: Animated.AnimatedInterpolation<string> },
    { translateY: Animated.AnimatedInterpolation<number> },
  ];
};

/**
 * @param index 면 안에서의 순서. `STAGGER_LIMIT` 이상이면 애니메이션 없이
 *              바로 보인다(데모와 동일).
 * @param generation 면이 바뀔 때마다 증가하는 값. 바뀌면 등장을 다시 재생한다.
 */
export function useStaggerEntrance(index: number, generation: number): StaggerStyle {
  const animated = index < STAGGER_LIMIT;
  const progress = useRef(new Animated.Value(animated ? 0 : 1)).current;

  // generation 은 이펙트 안에서 읽히지 않는 '재생 트리거' 다. 면이 바뀔 때
  // 등장을 다시 재생하려면 값이 아니라 변화 자체가 필요하다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 위 설명 참고
  useEffect(() => {
    if (!animated) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION_MS,
      delay: BASE_DELAY_MS + index * STEP_DELAY_MS,
      easing: STAGGER,
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    animation.start();
    return () => animation.stop();
  }, [animated, generation, index, progress]);

  return {
    opacity: progress as unknown as Animated.Value,
    transform: [
      { perspective: 900 },
      { rotateX: progress.interpolate({ inputRange: [0, 1], outputRange: ['34deg', '0deg'] }) },
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [13, 0] }) },
    ],
  };
}
