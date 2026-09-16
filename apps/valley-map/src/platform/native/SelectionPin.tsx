/**
 * 선택 핀 — 데모의 물방울 마커 (네이티브).
 *
 * SVG 경로·크기·테두리 두께는 web 어댑터의 `createPinElement` 와 같은 값이다.
 * web 은 `@keyframes mv-drop` 으로 떨어뜨리고 `filter: drop-shadow` 로
 * 그림자를 주는데, 둘 다 RN 스타일에 없다. 낙하는 같은 곡선
 * (`cubic-bezier(.2,1.5,.4,1)`)의 `Animated` 로, 그림자는 `shadow*` 근사로
 * 옮긴다.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { USE_NATIVE_DRIVER } from '@/animation/driver';

/** 데모 `animation: mv-drop .42s cubic-bezier(.2,1.5,.4,1)`. */
const DROP_DURATION_MS = 420;
const DROP_FROM_Y = -22;
const DROP_FROM_SCALE = 0.5;

const PIN_WIDTH = 34;
const PIN_HEIGHT = 46;

export type SelectionPinProps = {
  readonly color: string;
};

export function SelectionPin({ color }: SelectionPinProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DROP_DURATION_MS,
      // web 의 cubic-bezier(.2,1.5,.4,1) — 되튀는 오버슈트가 있는 곡선이다.
      easing: Easing.bezier(0.2, 1.5, 0.4, 1),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    animation.start();
    return () => animation.stop();
  }, [progress]);

  const dropStyle = {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [DROP_FROM_Y, 0],
        }),
      },
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [DROP_FROM_SCALE, 1],
        }),
      },
    ],
  };

  return (
    <View style={styles.frame}>
      <Animated.View style={[styles.shadow, dropStyle]}>
        <Svg width={PIN_WIDTH} height={PIN_HEIGHT} viewBox="0 0 34 46">
          <Path
            d="M17 45C17 45 32 27.5 32 16A15 15 0 1 0 2 16c0 11.5 15 29 15 29z"
            fill={color}
            stroke="rgba(255,255,255,.92)"
            strokeWidth={2.4}
          />
          <Circle cx={17} cy={16} r={5.4} fill="rgba(255,255,255,.95)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Marker 는 자식 하나를 요구한다. 크기를 확정해 앵커 계산이 흔들리지 않게 한다.
  frame: {
    width: PIN_WIDTH,
    height: PIN_HEIGHT,
  },
  shadow: {
    // web 의 `drop-shadow(0 4px 10px rgba(0,0,0,.6))` 근사.
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
