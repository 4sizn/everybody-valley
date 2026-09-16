/**
 * 좌상단 10탭 제스처(OPS1) 순수 함수 테스트 — 창 안에서 누적, 창 밖이면 리셋, 10번째에 트리거.
 */
import { describe, expect, it } from 'vitest';
import {
  ADMIN_GESTURE_TAPS_REQUIRED,
  ADMIN_GESTURE_WINDOW_MS,
  type AdminGestureState,
  INITIAL_ADMIN_GESTURE_STATE,
  registerAdminGestureTap,
} from '../src/domain/admin/AdminGesture';

describe('registerAdminGestureTap', () => {
  it('창 안에서 연달아 누르면 누적되고, 10번째에 트리거된다', () => {
    let state = INITIAL_ADMIN_GESTURE_STATE;
    const t0 = 1_000_000;
    for (let i = 1; i < ADMIN_GESTURE_TAPS_REQUIRED; i++) {
      const result = registerAdminGestureTap(state, t0 + i * 100);
      expect(result.triggered).toBe(false);
      expect(result.state.count).toBe(i);
      state = result.state;
    }
    const tenth = registerAdminGestureTap(state, t0 + ADMIN_GESTURE_TAPS_REQUIRED * 100);
    expect(tenth.triggered).toBe(true);
    // 트리거 뒤에는 다시 처음부터 세야 한다.
    expect(tenth.state).toEqual(INITIAL_ADMIN_GESTURE_STATE);
  });

  it('창(3초)을 넘겨 다음 탭이 오면 1부터 새로 센다', () => {
    const t0 = 1_000_000;
    const afterThreeTaps = [1, 2, 3].reduce<AdminGestureState>(
      (state, i) => registerAdminGestureTap(state, t0 + i * 10).state,
      INITIAL_ADMIN_GESTURE_STATE,
    );
    expect(afterThreeTaps.count).toBe(3);

    const late = registerAdminGestureTap(afterThreeTaps, t0 + 30 + ADMIN_GESTURE_WINDOW_MS + 1);
    expect(late.triggered).toBe(false);
    expect(late.state.count).toBe(1);
    expect(late.state.firstTapAt).toBe(t0 + 30 + ADMIN_GESTURE_WINDOW_MS + 1);
  });

  it('창 경계(정확히 WINDOW_MS)는 아직 같은 연속으로 친다', () => {
    const t0 = 1_000_000;
    const first = registerAdminGestureTap(INITIAL_ADMIN_GESTURE_STATE, t0);
    const second = registerAdminGestureTap(first.state, t0 + ADMIN_GESTURE_WINDOW_MS);
    expect(second.state.count).toBe(2);
  });

  it('9번에서 멈추면 트리거되지 않는다', () => {
    let state = INITIAL_ADMIN_GESTURE_STATE;
    const t0 = 1_000_000;
    for (let i = 1; i < ADMIN_GESTURE_TAPS_REQUIRED; i++) {
      state = registerAdminGestureTap(state, t0 + i * 10).state;
    }
    expect(state.count).toBe(ADMIN_GESTURE_TAPS_REQUIRED - 1);
  });
});
