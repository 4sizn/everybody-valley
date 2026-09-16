/**
 * 정리 프로토콜 테스트.
 *
 * 데모가 회수하지 않던 자원들(타이머·리스너·GL 버퍼·마커)을 이 프로토콜이
 * 대신 책임진다. 그러니 "몇 번 불려도 안전", "하나가 던져도 나머지는 정리",
 * "이미 정리된 store 에 넣으면 즉시 정리" 세 가지가 무너지면 안 된다.
 */
import { describe, expect, it, vi } from 'vitest';
import { DisposableStore, MutableDisposable, toDisposable } from '../src/shared/disposable';
import { NoopLogger } from '../src/shared/logger/NoopLogger';

describe('toDisposable', () => {
  it('여러 번 불려도 한 번만 실행된다', () => {
    const fn = vi.fn();
    const d = toDisposable(fn);
    d.dispose();
    d.dispose();
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe('DisposableStore', () => {
  it('역순으로 정리한다', () => {
    const order: number[] = [];
    const store = new DisposableStore();
    store.addFn(() => order.push(1));
    store.addFn(() => order.push(2));
    store.addFn(() => order.push(3));
    store.dispose();
    expect(order).toEqual([3, 2, 1]);
  });

  it('하나가 던져도 나머지는 정리된다', () => {
    const after = vi.fn();
    const store = new DisposableStore(new NoopLogger());
    store.addFn(after);
    store.addFn(() => {
      throw new Error('정리 실패');
    });
    expect(() => store.dispose()).not.toThrow();
    expect(after).toHaveBeenCalledOnce();
  });

  it('이미 정리된 store 에 등록하면 즉시 정리된다', () => {
    const store = new DisposableStore(new NoopLogger());
    store.dispose();
    const fn = vi.fn();
    store.addFn(fn);
    expect(fn).toHaveBeenCalledOnce();
    expect(store.size).toBe(0);
  });

  it('clear() 는 비우되 계속 쓸 수 있다', () => {
    const store = new DisposableStore();
    const fn = vi.fn();
    store.addFn(fn);
    store.clear();
    expect(fn).toHaveBeenCalledOnce();
    expect(store.disposed).toBe(false);
    store.addFn(() => {});
    expect(store.size).toBe(1);
  });
});

describe('MutableDisposable', () => {
  it('새 값을 넣으면 이전 값을 정리한다', () => {
    const first = vi.fn();
    const second = vi.fn();
    const slot = new MutableDisposable();
    slot.value = toDisposable(first);
    slot.value = toDisposable(second);
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    slot.dispose();
    expect(second).toHaveBeenCalledOnce();
  });

  it('정리된 뒤에 넣은 값은 즉시 정리된다', () => {
    const slot = new MutableDisposable();
    slot.dispose();
    const fn = vi.fn();
    slot.value = toDisposable(fn);
    expect(fn).toHaveBeenCalledOnce();
    expect(slot.value).toBeUndefined();
  });
});
