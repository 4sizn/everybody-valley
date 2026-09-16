/**
 * 계곡 티커 컨트롤러 테스트(F5c) — festival `NewsTickerController` 와 같은 회전 규약
 * (3200ms 회전 · 350ms 페이드)을 독립적으로 재현하는지, 문구를 매 회전마다 다시
 * 읽는지(피드가 바뀌면 반영), 숨김·dispose 로 회전이 멈추는지.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_APP_STATE } from '../src/application/state/AppState';
import { SessionStore } from '../src/application/state/SessionStore';
import {
  VALLEY_TICKER_TIMING,
  ValleyTickerController,
} from '../src/application/ValleyTickerController';
import { NoopLogger } from '../src/shared/logger/NoopLogger';

const logger = new NoopLogger();

function newStore(): SessionStore {
  return new SessionStore(logger, INITIAL_APP_STATE);
}

describe('ValleyTickerController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('festival 과 같은 주기(3200ms 회전 · 350ms 페이드)로 다음 문구로 넘어간다', () => {
    expect(VALLEY_TICKER_TIMING).toEqual({ rotateMs: 3200, fadeMs: 350 });

    const store = newStore();
    const messages = [
      { headline: 'a', badge: '1' },
      { headline: 'b', badge: '2' },
    ];
    const controller = new ValleyTickerController({ store, logger, getMessages: () => messages });
    controller.start();

    vi.advanceTimersByTime(3200);
    expect(store.state.valleyTickerVisible).toBe(false);
    expect(store.state.valleyTickerIndex).toBe(0);

    vi.advanceTimersByTime(350);
    expect(store.state.valleyTickerVisible).toBe(true);
    expect(store.state.valleyTickerIndex).toBe(1);

    vi.advanceTimersByTime(3200 + 350);
    expect(store.state.valleyTickerIndex).toBe(0); // 2 % 2 == 0, 한 바퀴 돌아왔다

    controller.dispose();
  });

  it('문구를 매 회전마다 다시 읽는다 — 피드가 SSE 로 바뀌면 반영된다', () => {
    const store = newStore();
    let messages = [{ headline: '초기 문구', badge: '기본' }];
    const controller = new ValleyTickerController({ store, logger, getMessages: () => messages });
    controller.start();

    // 피드가 갱신돼 문구가 두 개로 늘었다.
    messages = [
      { headline: '새 제보', badge: '쓰레기' },
      { headline: '또 다른 제보', badge: '계곡 새정보' },
    ];

    vi.advanceTimersByTime(3200 + 350);
    expect(store.state.valleyTickerIndex).toBe(1);

    controller.dispose();
  });

  it('상세가 열려 valleyTickerVisible 이 false 면 회전하지 않는다', () => {
    const store = newStore();
    store.setValleyTickerVisible(false);
    const controller = new ValleyTickerController({
      store,
      logger,
      getMessages: () => [{ headline: 'a', badge: '1' }],
    });
    controller.start();

    vi.advanceTimersByTime(3200 * 3);
    expect(store.state.valleyTickerIndex).toBe(0);
    expect(store.state.valleyTickerVisible).toBe(false);

    controller.dispose();
  });

  it('dispose 뒤에는 더 돌지 않는다', () => {
    const store = newStore();
    const controller = new ValleyTickerController({
      store,
      logger,
      getMessages: () => [
        { headline: 'a', badge: '1' },
        { headline: 'b', badge: '2' },
      ],
    });
    controller.start();
    controller.dispose();

    vi.advanceTimersByTime(10_000);
    expect(store.state.valleyTickerIndex).toBe(0);
    expect(store.state.valleyTickerVisible).toBe(true);
  });

  it('메시지가 없으면(빈 배열) 회전을 건너뛴다', () => {
    const store = newStore();
    const controller = new ValleyTickerController({ store, logger, getMessages: () => [] });
    controller.start();

    vi.advanceTimersByTime(3200 + 350);
    expect(store.state.valleyTickerIndex).toBe(0);
    expect(store.state.valleyTickerVisible).toBe(true);

    controller.dispose();
  });
});
