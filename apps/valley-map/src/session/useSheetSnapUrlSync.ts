/**
 * 시트 스냅 URL 동기화 (C8, 결정 (d)) — `?sheet=peek|half|full`.
 *
 * 상태(`AppState.sheetSnap`)가 진실이고 URL 은 그 투영이다.
 *   1. 진입 시 한 번만 URL → 상태로 씨앗을 심는다(딥링크로 `?sheet=full` 을 열면
 *      그 스냅으로 시작한다).
 *   2. 그 뒤로는 상태 → URL 로만 흐른다 — 손잡이 드래그·탭이 바꾼 스냅을 주소창에
 *      반영한다.
 *
 * 기본 스냅(`half`)이면 파라미터를 아예 지운다(해석 2, `sheetSnapToParam`) — 기존
 * 링크(파라미터 없음)가 그대로 동작한다. 두 라우트(`/`·`/firework`)가 각자의
 * `useLocalSearchParams` 를 통해 같은 훅을 쓴다 — expo-router 가 라우트별로 파라미터를
 * 나눠 주므로 여기서 라우트를 가릴 필요가 없다.
 */
import { parseSheetSnapParam, sheetSnapToParam } from '@modu-valley/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
// 배럴(`@/session`)이 아니라 원본에서 바로 가져온다 — 이 파일은 그 배럴이 재수출하는
// 훅이라, 배럴을 거치면 순환 참조가 생긴다(`session/index.ts` ↔ 이 파일).
import { useAppState, useSession } from '@/session/hooks';

export function useSheetSnapUrlSync(): void {
  const session = useSession();
  const snap = useAppState((state) => state.sheetSnap);
  const params = useLocalSearchParams<{ sheet?: string }>();
  const appliedDeepLink = useRef(false);

  useEffect(() => {
    if (!appliedDeepLink.current) {
      appliedDeepLink.current = true;
      const parsed = parseSheetSnapParam(params.sheet);
      if (parsed !== snap) {
        // 상태를 딥링크 값으로 맞춘다 — 이 effect 는 그 상태 변화로 한 번 더 돌고,
        // 그때 아래 setParams 로 넘어간다(URL 을 먼저 기본값으로 지웠다가 다시
        // 쓰는 깜빡임을 피한다).
        session.setSheetSnap(parsed);
        return;
      }
    }
    router.setParams({ sheet: sheetSnapToParam(snap) });
    // params.sheet 를 deps 에 넣으면 위 setParams 자신이 만든 변화로 한 번 더
    // 돌지만, `appliedDeepLink.current` 가 이미 참이라 같은 값을 다시 쓸 뿐이다
    // (idempotent) — 무한 루프는 아니다.
  }, [snap, session, params.sheet]);
}
