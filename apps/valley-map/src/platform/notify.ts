/**
 * 데모 안내 알림.
 *
 * 원본은 동작하지 않는 버튼에 `alert('클론 예제입니다 — 동작하지 않습니다.')`
 * 를 띄운다. RNW 의 `Alert` 는 web 에서 동작하지 않으므로 플랫폼 분기를
 * 여기 한 곳에 둔다.
 */
import { Alert, Platform } from 'react-native';

export function showNotice(message: string): void {
  if (Platform.OS === 'web') {
    globalThis.alert(message);
    return;
  }
  Alert.alert(message);
}
