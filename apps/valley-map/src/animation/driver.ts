/**
 * Animated 드라이버 선택.
 *
 * react-native-web 에는 네이티브 애니메이션 모듈이 없어 `useNativeDriver: true`
 * 를 주면 경고를 남기고 JS 드라이버로 떨어진다. 결과는 같지만 콘솔이 시끄럽고,
 * "네이티브 드라이버를 쓰고 있다"는 착각을 준다. 플랫폼에 맞게 명시한다.
 */
import { Platform } from 'react-native';

export const USE_NATIVE_DRIVER = Platform.OS !== 'web';
