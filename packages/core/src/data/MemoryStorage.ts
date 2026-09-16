/**
 * 메모리 저장소.
 *
 * 테스트의 기본 구현이자, 아직 영속 저장이 붙지 않은 플랫폼의 임시 채움.
 * 프로세스가 끝나면 사라진다 — 그래서 "저장이 안 된다"가 조용한 버그가
 * 아니라 명시적인 선택이 된다.
 */

import { StoragePort } from '../application/ports/StoragePort';
import type { CancellationToken } from '../shared/async/cancellation';
import { ok, type Result, type VoidResult } from '../shared/result';

export class MemoryStorage extends StoragePort {
  readonly #entries = new Map<string, string>();

  override read(key: string, token: CancellationToken): Promise<Result<string | null>> {
    const guard = token.checkpoint('storage-read');
    if (!guard.ok) return Promise.resolve(guard);
    return Promise.resolve(ok(this.#entries.get(key) ?? null));
  }

  override write(key: string, value: string, token: CancellationToken): Promise<VoidResult> {
    const guard = token.checkpoint('storage-write');
    if (!guard.ok) return Promise.resolve(guard);
    this.#entries.set(key, value);
    return Promise.resolve(ok());
  }

  override remove(key: string, token: CancellationToken): Promise<VoidResult> {
    const guard = token.checkpoint('storage-remove');
    if (!guard.ok) return Promise.resolve(guard);
    this.#entries.delete(key);
    return Promise.resolve(ok());
  }
}
