/**
 * 정적 저장소 구현.
 *
 * 데모처럼 코드에 박힌 데이터를 돌려주지만, 포트를 거치므로 나중에 HTTP
 * 저장소로 바꿔도 유즈케이스는 그대로다. 애그리게이트를 한 번만 만들어
 * 재사용한다 — 재호출마다 새 인스턴스를 주면 `SessionStore` 의 참조 비교가
 * 매번 재렌더를 유발한다.
 */

import { FestivalRepositoryPort } from '../application/ports/FestivalRepositoryPort';
import type { Festival } from '../domain/festival/Festival';
import type { CancellationToken } from '../shared/async/cancellation';
import { ok, type Result } from '../shared/result';
import { createSeoulFireworks2026 } from './seoulFireworks2026';

export class StaticFestivalRepository extends FestivalRepositoryPort {
  #cached: Festival | undefined;

  override load(token: CancellationToken): Promise<Result<Festival>> {
    const guard = token.checkpoint('festival-load');
    if (!guard.ok) return Promise.resolve(guard);
    this.#cached ??= createSeoulFireworks2026();
    return Promise.resolve(ok(this.#cached));
  }
}
