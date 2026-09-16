/**
 * 비동기 프로토콜 테스트.
 *
 * 데모가 `busy` 불리언과 `map.stop()` 으로 해결하던 겹침 문제를 큐가 실제로
 * 막는지, 그리고 **어떤 경로로도 큐가 잠기지 않는지**를 확인한다.
 */
import { describe, expect, it, vi } from 'vitest';
import { CancellationTokenSource, NONE_CANCELLATION_TOKEN } from '../src/shared/async/cancellation';
import { AsyncOnce } from '../src/shared/async/lifecycle';
import { SerialTaskQueue } from '../src/shared/async/SerialTaskQueue';
import { delay } from '../src/shared/async/timers';
import { isCancelled, UnexpectedError } from '../src/shared/errors';
import { NoopLogger } from '../src/shared/logger/NoopLogger';
import { err, ok } from '../src/shared/result';

const logger = new NoopLogger();

const createQueue = (name = 'test') => new SerialTaskQueue({ name, logger });

describe('CancellationToken', () => {
  it('취소되면 checkpoint 가 err 를 돌려준다', () => {
    const source = new CancellationTokenSource();
    expect(source.token.checkpoint('x').ok).toBe(true);
    source.cancel('why');
    const result = source.token.checkpoint('x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.operation).toBe('why');
  });

  it('이미 취소된 토큰에 붙은 리스너는 즉시 호출된다', () => {
    const source = new CancellationTokenSource();
    source.cancel('early');
    const listener = vi.fn();
    source.token.onCancel(listener);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('부모가 취소되면 자식도 취소된다', () => {
    const parent = new CancellationTokenSource();
    const child = new CancellationTokenSource(parent.token);
    parent.cancel('parent-gone');
    expect(child.token.cancelled).toBe(true);
  });

  it('NONE 토큰은 절대 취소되지 않는다', () => {
    expect(NONE_CANCELLATION_TOKEN.cancelled).toBe(false);
    expect(NONE_CANCELLATION_TOKEN.checkpoint('x').ok).toBe(true);
  });

  it('delay 는 취소되면 남은 시간을 기다리지 않는다', async () => {
    const source = new CancellationTokenSource();
    const started = Date.now();
    const pending = delay(5000, source.token);
    source.cancel('nope');
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe('SerialTaskQueue', () => {
  it('queue 모드는 순서를 지킨다', async () => {
    const queue = createQueue();
    const order: number[] = [];
    const task = (n: number) => async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push(n);
      return ok();
    };
    await Promise.all([
      queue.run('a', task(1), 'queue'),
      queue.run('b', task(2), 'queue'),
      queue.run('c', task(3), 'queue'),
    ]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('preempt 는 진행 중인 작업의 토큰을 취소한다', async () => {
    const queue = createQueue();
    let cancelledInside = false;

    const first = queue.run(
      'slow',
      async (token) => {
        const result = await delay(3000, token);
        if (!result.ok) cancelledInside = true;
        return result;
      },
      'preempt',
    );
    await new Promise((r) => setTimeout(r, 20));
    const second = queue.run('fast', () => Promise.resolve(ok()), 'preempt');

    const [a, b] = await Promise.all([first, second]);
    expect(cancelledInside).toBe(true);
    expect(a.ok).toBe(false);
    if (!a.ok) expect(isCancelled(a.error)).toBe(true);
    expect(b.ok).toBe(true);
  });

  it('drop-if-busy 는 바쁠 때 새 작업을 버린다', async () => {
    const queue = createQueue();
    const first = queue.run(
      'busy',
      async (token) => {
        await delay(100, token);
        return ok();
      },
      'drop-if-busy',
    );
    const dropped = await queue.run('dropped', () => Promise.resolve(ok()), 'drop-if-busy');
    expect(dropped.ok).toBe(false);
    if (!dropped.ok) expect(dropped.error.context['reason']).toBe('queue-busy');
    await first;
    expect(queue.busy).toBe(false);
  });

  it('작업이 예외를 던져도 큐가 잠기지 않는다', async () => {
    const queue = createQueue();
    const thrown = await queue.run('boom', () => {
      throw new Error('터졌다');
    });
    expect(thrown.ok).toBe(false);
    expect(queue.busy).toBe(false);

    const after = await queue.run('after', () => Promise.resolve(ok()));
    expect(after.ok).toBe(true);
  });

  it('작업이 err 를 돌려줘도 다음 작업이 실행된다', async () => {
    const queue = createQueue();
    const failed = await queue.run('fail', () => Promise.resolve(err(new UnexpectedError('실패'))));
    expect(failed.ok).toBe(false);
    const after = await queue.run('after', () => Promise.resolve(ok()));
    expect(after.ok).toBe(true);
  });

  it('dispose 후에는 새 작업을 받지 않는다', async () => {
    const queue = createQueue();
    queue.dispose();
    const result = await queue.run('after-dispose', () => Promise.resolve(ok()));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.context['reason']).toBe('queue-disposed');
  });

  it('부모 토큰이 취소되면 큐가 정리된다', () => {
    const source = new CancellationTokenSource();
    const queue = new SerialTaskQueue({ name: 'child', logger, parentToken: source.token });
    source.cancel('screen-left');
    expect(queue.disposed).toBe(true);
  });
});

describe('AsyncOnce', () => {
  it('동시에 여러 번 불려도 한 번만 실행된다', async () => {
    const factory = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return ok(1);
    });
    const once = new AsyncOnce(factory);
    const results = await Promise.all([
      once.get(NONE_CANCELLATION_TOKEN),
      once.get(NONE_CANCELLATION_TOKEN),
      once.get(NONE_CANCELLATION_TOKEN),
    ]);
    expect(factory).toHaveBeenCalledOnce();
    for (const r of results) expect(r).toEqual(ok(1));
  });

  it('reset 후에는 다시 실행된다', async () => {
    const factory = vi.fn(() => Promise.resolve(ok(1)));
    const once = new AsyncOnce(factory);
    await once.get(NONE_CANCELLATION_TOKEN);
    once.reset();
    await once.get(NONE_CANCELLATION_TOKEN);
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
