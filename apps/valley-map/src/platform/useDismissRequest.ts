/**
 * "지금 열린 것을 닫아라"는 플랫폼별 제스처를 하나로 모은다.
 *
 *   web       Esc 키          — 데모의 `addEventListener('keydown', ...)`
 *   android   하드웨어 뒤로가기 — OS 규약. 처리하지 않으면 앱이 종료된다.
 *   ios       (없음)          — 시트 바깥 탭·지도 탭으로 닫는다
 *
 * android 의 뒤로가기를 잡지 않으면 상세가 열린 상태에서 뒤로가기를 눌렀을 때
 * 화면이 닫히는 게 아니라 **앱이 나가 버린다**. 안드로이드 사용자에게는
 * 그것이 가장 먼저 눈에 걸리는 결함이므로 여기서 처리한다.
 *
 * `handled` 로 "지금 닫을 것이 있는지"를 받는다. 닫을 것이 없으면 뒤로가기를
 * OS 에 넘겨 기본 동작(앱 종료·이전 화면)이 유지된다.
 */
import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

export type DismissRequestOptions = {
  /** 지금 닫을 것이 있는가. false 면 뒤로가기를 OS 에 넘긴다. */
  readonly active: boolean;
  readonly onDismiss: () => void;
};

export function useDismissRequest({ active, onDismiss }: DismissRequestOptions): void {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  useEffect(() => {
    // `BackHandler` 는 react-native-web 에도 있지만(무동작 stub) android
    // 에서만 의미가 있다. ios 에는 하드웨어 뒤로가기가 없다.
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!active) return false;
      onDismiss();
      return true;
    });
    return () => subscription.remove();
  }, [active, onDismiss]);
}
