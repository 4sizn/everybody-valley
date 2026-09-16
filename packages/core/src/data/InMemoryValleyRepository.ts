/**
 * 메모리 계곡 저장소 — 이미 만들어진 데이터셋을 그대로 돌려준다.
 *
 * 코어는 파일도 네트워크도 모른다. 정적 GeoJSON 을 읽는 쪽(앱)이
 * `loadValleyDataset(segmentsRaw, facilitiesRaw)` 로 검증·변환한 값을 여기에
 * 담아 세션에 넘긴다. 같은 참조를 매번 돌려주므로 `SessionStore` 의 참조 비교가
 * 불필요한 재렌더를 만들지 않는다(`StaticFestivalRepository` 와 같은 이유).
 */

import { ValleyRepositoryPort } from '../application/ports/ValleyRepositoryPort';
import type { ValleyDataset } from '../domain/valley/ValleyDataset';
import type { CancellationToken } from '../shared/async/cancellation';
import { ok, type Result } from '../shared/result';

export class InMemoryValleyRepository extends ValleyRepositoryPort {
  readonly #dataset: ValleyDataset;

  constructor(dataset: ValleyDataset) {
    super();
    this.#dataset = dataset;
  }

  override load(token: CancellationToken): Promise<Result<ValleyDataset>> {
    const guard = token.checkpoint('valley-load');
    if (!guard.ok) return Promise.resolve(guard);
    return Promise.resolve(ok(this.#dataset));
  }
}
