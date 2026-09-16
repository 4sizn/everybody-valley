/**
 * 시트 플립 애니메이션.
 *
 * 데모의 CSS:
 *   .flip      { transform-origin:50% 45%;
 *                transition: transform .22s cubic-bezier(.55,0,1,.45),
 *                            opacity   .22s ease-in }
 *   .flip.turn { transform: perspective(1400px) rotateY(90deg) scale(.94);
 *                opacity:.08 }
 *   .flip.back { transition: transform .24s cubic-bezier(0,.55,.45,1),
 *                            opacity   .24s ease-out }
 *
 * 회전과 투명도의 이징이 서로 다르므로 Animated 값을 둘로 나눠 병렬로 굴린다.
 * `transformOrigin` 은 RN 0.76+ 에 있어 web·네이티브 모두 같은 값을 쓴다.
 */
import type { FlipPhase } from '@modu-valley/core';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { USE_NATIVE_DRIVER } from './driver';
import { EASE_IN, EASE_OUT, FOLD_IN, FOLD_OUT } from './easings';

/** 데모의 transition 시간 (플립 단계 길이 230/260ms 와는 별개다). */
const FOLD_MS = 220;
const UNFOLD_MS = 240;

/** `.turn` 상태의 목표값. */
const TURNED = { progress: 1, opacity: 0.08 } as const;
const FLAT = { progress: 0, opacity: 1 } as const;

export type FlipTransform = {
  readonly opacity: Animated.Value;
  readonly transform: readonly [
    { perspective: number },
    { rotateY: Animated.AnimatedInterpolation<string> },
    { scale: Animated.AnimatedInterpolation<number> },
  ];
};

export function useFlipTransform(phase: FlipPhase): FlipTransform {
  const progress = useRef(new Animated.Value(FLAT.progress)).current;
  const opacity = useRef(new Animated.Value(FLAT.opacity)).current;

  useEffect(() => {
    const folding = phase === 'folding';
    const animation = Animated.parallel([
      Animated.timing(progress, {
        toValue: folding ? TURNED.progress : FLAT.progress,
        duration: folding ? FOLD_MS : UNFOLD_MS,
        easing: folding ? FOLD_IN : FOLD_OUT,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(opacity, {
        toValue: folding ? TURNED.opacity : FLAT.opacity,
        duration: folding ? FOLD_MS : UNFOLD_MS,
        easing: folding ? EASE_IN : EASE_OUT,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);
    animation.start();
    // 다음 단계가 오면 진행 중인 보간을 반드시 끊는다 — 끊지 않으면 접힘과
    // 펴짐이 겹쳐 중간 각도에서 멈춘 면이 남는다.
    return () => animation.stop();
  }, [phase, progress, opacity]);

  return {
    opacity,
    transform: [
      { perspective: 1400 },
      {
        rotateY: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }),
      },
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) },
    ],
  };
}
