/**
 * 계곡 데이터 조회 포트.
 *
 * `FestivalRepositoryPort` 의 계곡판. 지금은 앱이 정적 GeoJSON 을 읽어
 * `loadValleyDataset` 으로 만든 값을 `InMemoryValleyRepository` 에 담아 넘기지만
 * (코어는 파일을 읽지 못한다), 서버(S1)가 생기면 이 경계 안쪽만 HTTP 구현으로
 * 갈아끼운다. 돌려주는 값은 검증이 끝난 도메인 객체다 — 원시 JSON 은 여기를
 * 넘어오지 않는다.
 */

import type { ValleyDataset } from '../../domain/valley/ValleyDataset';
import type { CancellationToken } from '../../shared/async/cancellation';
import type { Result } from '../../shared/result';

export abstract class ValleyRepositoryPort {
  abstract load(token: CancellationToken): Promise<Result<ValleyDataset>>;
}
