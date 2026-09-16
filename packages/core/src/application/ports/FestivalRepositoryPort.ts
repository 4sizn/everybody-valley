/**
 * 축제 데이터 조회 포트.
 *
 * 데모는 `SPOTS` 배열을 스크립트에 박아 둔다. 지금은 정적 구현으로 같은
 * 데이터를 돌려주지만, 서버 API 로 바뀌어도 이 경계 안쪽만 갈아끼우면 된다.
 */

import type { Festival } from '../../domain/festival/Festival';
import type { CancellationToken } from '../../shared/async/cancellation';
import type { Result } from '../../shared/result';

export abstract class FestivalRepositoryPort {
  abstract load(token: CancellationToken): Promise<Result<Festival>>;
}
