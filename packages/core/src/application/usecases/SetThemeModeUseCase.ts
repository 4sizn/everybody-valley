/**
 * 테마 선택 변경 (C9) — 라이트 · 다크 · 시스템.
 *
 * 순서: 저장 → 상태. `SetSpotLayoutUseCase` 와 반대인데 이유가 있다 — 테마가 바뀌면
 * 표현 계층이 세션을 **다시 만들고**(지도 스타일은 엔진 생성 시 고정, 결정 (d)) 새 세션의
 * `LoadSessionUseCase` 가 저장값을 읽는다. 상태를 먼저 바꾸면 그 재생성이 저장보다 먼저
 * 달릴 수 있어 새 세션이 옛 값을 읽는다. 저장 실패는 화면을 막지 않는다 — 이번 실행에서는
 * 바뀌고, 다음 실행에서 기본값으로 뜬다(경고만 남긴다).
 */
import type { CancellationToken } from '../../shared/async/cancellation';
import type { Logger } from '../../shared/logger/Logger';
import { ok, type VoidResult } from '../../shared/result';
import { STORAGE_KEYS, type StoragePort } from '../ports/StoragePort';
import type { ThemeMode } from '../state/AppState';
import type { SessionStore } from '../state/SessionStore';

export type SetThemeModeDeps = {
  readonly storage: StoragePort;
  readonly store: SessionStore;
  readonly logger: Logger;
};

export class SetThemeModeUseCase {
  readonly #deps: SetThemeModeDeps;
  readonly #logger: Logger;

  constructor(deps: SetThemeModeDeps) {
    this.#deps = deps;
    this.#logger = deps.logger.child('set-theme-mode');
  }

  async execute(mode: ThemeMode, token: CancellationToken): Promise<VoidResult> {
    const { store, storage } = this.#deps;
    if (store.state.themeMode === mode) return ok();

    const written = await storage.write(STORAGE_KEYS.themeMode, mode, token);
    if (!written.ok) {
      this.#logger.warn('테마 선택을 저장하지 못했다', { code: written.error.code, mode });
    }

    const guard = token.checkpoint('set-theme-mode');
    if (!guard.ok) return guard;

    store.setThemeMode(mode);
    return ok();
  }
}
