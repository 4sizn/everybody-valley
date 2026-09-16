/**
 * 세션 접근 훅.
 *
 * 표현 계층이 상태를 읽는 유일한 경로다. `useSyncExternalStore` 를 쓰므로
 * 상태 관리 라이브러리가 없고, 코어는 React 를 모른다.
 *
 * 선택자(selector)는 **원시값이나 안정된 참조**를 돌려줘야 한다. 매번 새
 * 객체를 만들면 React 가 `Object.is` 비교에 실패해 무한 재렌더가 된다.
 */
import type { AppState, MapSession } from '@modu-valley/core';
import { INITIAL_APP_STATE } from '@modu-valley/core';
import { useContext, useSyncExternalStore } from 'react';
import { SessionContext, SessionRestartContext } from './SessionProvider';

export function useSession(): MapSession {
  const session = useContext(SessionContext);
  if (session === null) {
    throw new Error('SessionProvider 안에서만 useSession 을 쓸 수 있습니다.');
  }
  return session;
}

/** 세션 재생성(C7) — 스타일 실패 전면 화면의 "다시 시도". */
export function useSessionRestart(): () => void {
  return useContext(SessionRestartContext);
}

export function useAppState<T>(selector: (state: AppState) => T): T {
  const session = useSession();
  return useSyncExternalStore(
    session.store.subscribeRaw,
    () => selector(session.store.getSnapshot()),
    // 정적 렌더링(expo-router static output)에서 쓰이는 초기 스냅샷.
    () => selector(INITIAL_APP_STATE),
  );
}
