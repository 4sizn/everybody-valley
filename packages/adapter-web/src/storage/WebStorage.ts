/**
 * `localStorage` 어댑터.
 *
 * 포트가 비동기인 이유는 네이티브의 AsyncStorage 를 같은 모양으로 담기
 * 위해서다. web 은 동기지만 `Promise.resolve` 로 감싸 계약을 맞춘다.
 *
 * 데모는 `try{}catch{}` 로 실패를 완전히 삼킨다(사파리 프라이빗 모드,
 * 저장 용량 초과, 서드파티 쿠키 차단에서 실제로 던진다). 여기서는 실패가
 * `Result` 로 나와 호출부가 기본값으로 계속 가면서 로그를 남길 수 있다.
 */
import {
  type CancellationToken,
  err,
  ok,
  type Result,
  StorageError,
  StoragePort,
  type VoidResult,
} from '@modu-valley/core';

export class WebStorage extends StoragePort {
  override read(key: string, token: CancellationToken): Promise<Result<string | null>> {
    const guard = token.checkpoint('storage-read');
    if (!guard.ok) return Promise.resolve(guard);
    try {
      const store = requireStorage();
      return Promise.resolve(ok(store.getItem(key)));
    } catch (thrown) {
      return Promise.resolve(
        err(
          new StorageError('storage/read-failed', '저장된 값을 읽지 못했습니다.', {
            cause: thrown,
            context: { key },
          }),
        ),
      );
    }
  }

  override write(key: string, value: string, token: CancellationToken): Promise<VoidResult> {
    const guard = token.checkpoint('storage-write');
    if (!guard.ok) return Promise.resolve(guard);
    try {
      requireStorage().setItem(key, value);
      return Promise.resolve(ok());
    } catch (thrown) {
      return Promise.resolve(
        err(
          new StorageError('storage/write-failed', '값을 저장하지 못했습니다.', {
            cause: thrown,
            context: { key },
          }),
        ),
      );
    }
  }

  override remove(key: string, token: CancellationToken): Promise<VoidResult> {
    const guard = token.checkpoint('storage-remove');
    if (!guard.ok) return Promise.resolve(guard);
    try {
      requireStorage().removeItem(key);
      return Promise.resolve(ok());
    } catch (thrown) {
      return Promise.resolve(
        err(
          new StorageError('storage/write-failed', '값을 지우지 못했습니다.', {
            cause: thrown,
            context: { key },
          }),
        ),
      );
    }
  }
}

function requireStorage(): Storage {
  // SSR(expo-router 의 static rendering)에서는 window 가 없다.
  if (typeof window === 'undefined' || window.localStorage === undefined) {
    throw new StorageError('storage/unavailable', '이 환경에는 localStorage 가 없습니다.');
  }
  return window.localStorage;
}
