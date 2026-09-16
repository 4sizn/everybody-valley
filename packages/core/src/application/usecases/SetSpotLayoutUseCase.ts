/**
 * 명당 목록 배치 변경 (행 ↔ 타일) + 영속화.
 *
 * 데모는 `setLayout` 이 상태를 바꾸고, **별도의** 클릭 리스너가
 * `localStorage` 에 쓴다. 리스너 등록 순서에 결과가 달려 있고 저장 실패는
 * `try{}catch{}` 로 사라진다. 한 절차로 합치고 실패를 로그에 남긴다.
 */
import type { CancellationToken } from '../../shared/async/cancellation';
import type { Logger } from '../../shared/logger/Logger';
import { ok, type VoidResult } from '../../shared/result';
import { STORAGE_KEYS, type StoragePort } from '../ports/StoragePort';
import type { SpotLayout } from '../state/AppState';
import type { SessionStore } from '../state/SessionStore';

export type SetSpotLayoutDeps = {
  readonly storage: StoragePort;
  readonly store: SessionStore;
  readonly logger: Logger;
};

export class SetSpotLayoutUseCase {
  readonly #deps: SetSpotLayoutDeps;
  readonly #logger: Logger;

  constructor(deps: SetSpotLayoutDeps) {
    this.#deps = deps;
    this.#logger = deps.logger.child('set-spot-layout');
  }

  async execute(layout: SpotLayout, token: CancellationToken): Promise<VoidResult> {
    const { store, storage } = this.#deps;
    if (store.state.spotLayout === layout) return ok();

    store.setSpotLayout(layout);

    const written = await storage.write(STORAGE_KEYS.spotLayout, layout, token);
    if (!written.ok) {
      // 저장 실패는 화면을 되돌릴 이유가 아니다. 다음 실행에서 기본값으로 뜬다.
      this.#logger.warn('배치를 저장하지 못했다', { code: written.error.code, layout });
    }
    return ok();
  }
}
