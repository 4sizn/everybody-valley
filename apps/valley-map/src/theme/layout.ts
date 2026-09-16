/**
 * 절대 위치 채움 스타일.
 *
 * `StyleSheet.absoluteFillObject` 는 react-native 0.86 의 타입에서 사라졌고,
 * `StyleSheet.absoluteFill` 은 등록된 스타일 ID 라 다른 스타일과 펼쳐 합칠 수
 * 없다. 값이 하나뿐인 상수라 직접 둔다.
 */
import type { ViewStyle } from 'react-native';

export const ABSOLUTE_FILL: ViewStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
