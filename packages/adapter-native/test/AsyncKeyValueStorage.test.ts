/**
 * 비동기 저장 어댑터.
 *
 * 데모가 `try{}catch{}` 로 지워 버리던 실패가 `Result` 로 올라오는지,
 * 취소 토큰이 저장을 막는지를 확인한다. 네이티브 모듈 없이 돌아간다 —
 * 어댑터가 세 메서드짜리 계약만 요구하기 때문이다.
 */
import { CancellationTokenSource, NONE_CANCELLATION_TOKEN } from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import { AsyncKeyValueStorage } from '../src/storage/AsyncKeyValueStorage';

function memoryStore(): {
  store: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
  };
  data: Map<string, string>;
} {
  const data = new Map<string, string>();
  return {
    data,
    store: {
      getItem: (key) => Promise.resolve(data.get(key) ?? null),
      setItem: (key, value) => {
        data.set(key, value);
        return Promise.resolve();
      },
      removeItem: (key) => {
        data.delete(key);
        return Promise.resolve();
      },
    },
  };
}

const REJECTING_STORE = {
  getItem: () => Promise.reject(new Error('storage full')),
  setItem: () => Promise.reject(new Error('storage full')),
  removeItem: () => Promise.reject(new Error('storage full')),
};

describe('AsyncKeyValueStorage', () => {
  it('쓰고 읽고 지운다', async () => {
    const { store } = memoryStore();
    const storage = new AsyncKeyValueStorage({ store });

    expect((await storage.read('layout', NONE_CANCELLATION_TOKEN)).ok).toBe(true);
    const missing = await storage.read('layout', NONE_CANCELLATION_TOKEN);
    expect(missing.ok && missing.value).toBeNull();

    expect((await storage.write('layout', 'tiles', NONE_CANCELLATION_TOKEN)).ok).toBe(true);
    const found = await storage.read('layout', NONE_CANCELLATION_TOKEN);
    expect(found.ok && found.value).toBe('tiles');

    expect((await storage.remove('layout', NONE_CANCELLATION_TOKEN)).ok).toBe(true);
    const gone = await storage.read('layout', NONE_CANCELLATION_TOKEN);
    expect(gone.ok && gone.value).toBeNull();
  });

  it('저장소가 던지면 Result 로 올라온다 — 삼키지 않는다', async () => {
    const storage = new AsyncKeyValueStorage({ store: REJECTING_STORE });

    const read = await storage.read('layout', NONE_CANCELLATION_TOKEN);
    expect(read.ok).toBe(false);
    expect(!read.ok && read.error.code).toBe('storage/read-failed');

    const write = await storage.write('layout', 'rows', NONE_CANCELLATION_TOKEN);
    expect(write.ok).toBe(false);
    expect(!write.ok && write.error.code).toBe('storage/write-failed');
  });

  it('취소된 토큰으로는 저장소를 건드리지 않는다', async () => {
    const { store, data } = memoryStore();
    const storage = new AsyncKeyValueStorage({ store });
    const lifetime = new CancellationTokenSource();
    lifetime.cancel('unmounted');

    const result = await storage.write('layout', 'tiles', lifetime.token);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('async/cancelled');
    expect(data.size).toBe(0);

    lifetime.dispose();
  });
});
