/**
 * 시트 플립 코디네이터 테스트.
 *
 * 데모의 2단계 전환(접힘 230ms → 내용 교체 → 펴짐 260ms)을 상태 시퀀스로
 * 재현한다. 특히 **잠금이 동기적인지**를 확인한다 — 비동기 잠금은 거부된
 * 조작이 상태를 먼저 바꾸는 창을 남긴다.
 */
import { describe, expect, it, vi } from 'vitest';
import { FLIP_TIMING, SheetFlipCoordinator } from '../src/application/SheetFlipCoordinator';
import type { FlipPhase, SheetFace } from '../src/application/state/AppState';
import { SessionStore } from '../src/application/state/SessionStore';
import { NoopLogger } from '../src/shared/logger/NoopLogger';

const logger = new NoopLogger();

function setup() {
  const store = new SessionStore(logger);
  const flip = new SheetFlipCoordinator({ store, logger });
  // 초기값으로 시작해야 "변화만" 기록된다.
  const phases: FlipPhase[] = [store.state.flipPhase];
  const faces: SheetFace[] = [store.state.sheetFace];
  store.subscribe(() => {
    const state = store.state;
    if (phases.at(-1) !== state.flipPhase) phases.push(state.flipPhase);
    if (faces.at(-1) !== state.sheetFace) faces.push(state.sheetFace);
  });
  return { store, flip, phases, faces };
}

describe('SheetFlipCoordinator', () => {
  it('접힘 → 교체 → 펴짐 → 대기 순서로 진행한다', async () => {
    const { store, flip, phases, faces } = setup();
    const onSwap = vi.fn();

    const pending = flip.flipTo('detail', onSwap);
    // 잠금과 첫 단계는 동기적으로 반영된다.
    expect(flip.busy).toBe(true);
    expect(store.state.flipPhase).toBe('folding');
    expect(store.state.sheetFace).toBe('list');
    expect(onSwap).not.toHaveBeenCalled();

    const result = await pending;
    expect(result.ok).toBe(true);
    expect(onSwap).toHaveBeenCalledOnce();
    expect(phases).toEqual(['idle', 'folding', 'unfolding', 'idle']);
    expect(faces).toEqual(['list', 'detail']);
    expect(store.state.flipPhase).toBe('idle');
    expect(flip.busy).toBe(false);
    flip.dispose();
  });

  it('전환 중 재진입은 상태를 건드리지 않고 버려진다', async () => {
    const { store, flip } = setup();
    const first = flip.flipTo('detail');
    const dropped = await flip.flipTo('list');

    expect(dropped.ok).toBe(false);
    if (!dropped.ok) expect(dropped.error.context['reason']).toBe('flip-busy');
    // 버려진 호출이 면을 바꾸지 못했다.
    expect(store.state.sheetFace).toBe('list');

    await first;
    expect(store.state.sheetFace).toBe('detail');
    flip.dispose();
  });

  it('전환이 끝나면 다시 뒤집을 수 있다', async () => {
    const { store, flip } = setup();
    await flip.flipTo('detail');
    await flip.flipTo('list');
    expect(store.state.sheetFace).toBe('list');
    expect(flip.busy).toBe(false);
    flip.dispose();
  });

  it('전환 시간은 데모와 같다 (230 + 260ms)', async () => {
    const { flip } = setup();
    const started = Date.now();
    await flip.flipTo('detail');
    const elapsed = Date.now() - started;
    const expected = FLIP_TIMING.foldMs + FLIP_TIMING.unfoldMs;
    expect(elapsed).toBeGreaterThanOrEqual(expected - 30);
    expect(elapsed).toBeLessThan(expected + 400);
    flip.dispose();
  });

  it('dispose 중이면 잠금이 남지 않는다', async () => {
    const { flip } = setup();
    const pending = flip.flipTo('detail');
    flip.dispose();
    await pending;
    expect(flip.busy).toBe(false);
  });
});
