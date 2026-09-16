/**
 * 좌상단 10탭 → 관리자 모드 진입 제스처(OPS1, 임시 — 계정 플로우가 생기면 제거).
 *
 * **이 제스처는 입구일 뿐 권한을 주지 않는다**(사용자 결정 2026-09-08, 메인 세션 판단).
 * 10번째 탭은 토큰 입력 화면을 여는 신호일 뿐이고, 실제 권한은 서버가 `Authorization:
 * Bearer` 토큰으로 매 요청 확인한다 — 그래서 이 파일은 탭을 세는 것만 한다.
 *
 * 탭 사이 간격이 `ADMIN_GESTURE_WINDOW_MS` 를 넘으면 이번 탭부터 새로 센다(느리게 10번
 * 누르는 것은 트리거가 아니다 — 실수로 여러 번 건드리는 것과 구분).
 */

export const ADMIN_GESTURE_TAPS_REQUIRED = 10;
export const ADMIN_GESTURE_WINDOW_MS = 3000;

export type AdminGestureState = {
  readonly count: number;
  /** 이번 연속 탭의 첫 탭 시각(ms). 탭이 하나도 없으면 `null`. */
  readonly firstTapAt: number | null;
};

export const INITIAL_ADMIN_GESTURE_STATE: AdminGestureState = { count: 0, firstTapAt: null };

export type AdminGestureTapResult = {
  /** 다음에 들고 있을 상태 — 트리거됐으면 항상 초기 상태로 되돌아간다. */
  readonly state: AdminGestureState;
  /** 이번 탭으로 10번째에 닿았는가. */
  readonly triggered: boolean;
};

/**
 * 탭 하나를 반영한다. `now` 는 호출부의 시계(ms, 테스트가 고정할 수 있게 주입).
 * 창을 벗어났으면 이번 탭이 새 연속의 시작이다.
 */
export function registerAdminGestureTap(
  state: AdminGestureState,
  now: number,
): AdminGestureTapResult {
  const withinWindow =
    state.firstTapAt !== null && now - state.firstTapAt <= ADMIN_GESTURE_WINDOW_MS;
  const count = withinWindow ? state.count + 1 : 1;
  const firstTapAt = withinWindow ? state.firstTapAt : now;
  if (count >= ADMIN_GESTURE_TAPS_REQUIRED) {
    return { state: INITIAL_ADMIN_GESTURE_STATE, triggered: true };
  }
  return { state: { count, firstTapAt }, triggered: false };
}
