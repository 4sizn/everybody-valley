/**
 * 비동기 키·값 저장 어댑터 (android/ios).
 *
 * 실제 구현체(`@react-native-async-storage/async-storage`)를 여기서 import
 * 하지 않고 **주입받는다**. 그 패키지는 react-native 네이티브 모듈이라
 * 들여오면 이 어댑터가 RN 타입에 묶이고, DOM·RN 어느 쪽도 켜지 않은
 * 이 패키지의 컴파일 경계(= 애플리케이션 계층이 플랫폼 API 에 새지 않았다는
 * 증거)가 무의미해진다. 필요한 세 메서드만 타입으로 적어 두면 AsyncStorage
 * 가 그대로 들어맞는다.
 *
 * 저장 실패를 삼키지 않는다는 점은 `WebStorage` 와 같다. 데모는
 * `try{}catch{}` 로 지워 버리지만, 여기서는 `Result` 로 올라와 호출부가
 * 기본값으로 계속 가면서 로그를 남길 수 있다.
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

/** AsyncStorage 가 만족하는 최소 계약. 테스트에서는 메모리 구현을 넣는다. */
export type AsyncKeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type AsyncKeyValueStorageOptions = {
  readonly store: AsyncKeyValueStore;
};

export class AsyncKeyValueStorage extends StoragePort {
  readonly #store: AsyncKeyValueStore;

  constructor(options: AsyncKeyValueStorageOptions) {
    super();
    this.#store = options.store;
  }

  override async read(key: string, token: CancellationToken): Promise<Result<string | null>> {
    const guard = token.checkpoint('storage-read');
    if (!guard.ok) return guard;
    try {
      return ok(await this.#store.getItem(key));
    } catch (thrown) {
      return err(
        new StorageError('storage/read-failed', '저장된 값을 읽지 못했습니다.', {
          cause: thrown,
          context: { key },
        }),
      );
    }
  }

  override async write(key: string, value: string, token: CancellationToken): Promise<VoidResult> {
    const guard = token.checkpoint('storage-write');
    if (!guard.ok) return guard;
    try {
      await this.#store.setItem(key, value);
      return ok();
    } catch (thrown) {
      return err(
        new StorageError('storage/write-failed', '값을 저장하지 못했습니다.', {
          cause: thrown,
          context: { key },
        }),
      );
    }
  }

  override async remove(key: string, token: CancellationToken): Promise<VoidResult> {
    const guard = token.checkpoint('storage-remove');
    if (!guard.ok) return guard;
    try {
      await this.#store.removeItem(key);
      return ok();
    } catch (thrown) {
      return err(
        new StorageError('storage/write-failed', '값을 지우지 못했습니다.', {
          cause: thrown,
          context: { key },
        }),
      );
    }
  }
}
