/**
 * `ApiPort` 가짜(F3b `MapSession` 경보 배선 · F5c 제보 피드 배선 테스트용). `alerts()`·
 * `reports()`·`subscribeEvents()` 만 진짜로 움직인다 — 나머지 추상 메서드는 이 테스트가
 * 부르지 않는다.
 */
import type {
  ApiAlert,
  ApiBasinLookup,
  ApiEvent,
  ApiEventChannel,
  ApiHealth,
  ApiLatest,
  ApiReportPage,
  ApiReportsQuery,
  ApiResult,
  ApiStation,
  ApiStationsQuery,
} from '../../src/application/ports/ApiPort';
import { ApiPort } from '../../src/application/ports/ApiPort';
import type { LngLat } from '../../src/domain/geo/LngLat';
import type { StationCode } from '../../src/domain/valley/ids';
import { type Disposable, toDisposable } from '../../src/shared/disposable';
import { ok } from '../../src/shared/result';

export class FakeApiPort extends ApiPort {
  /** 매 `alerts()` 호출에 순서대로 돌려줄 값. 바닥나면 마지막 것을 반복한다. */
  responses: (readonly ApiAlert[])[] = [[]];
  calls = 0;
  /** 매 `reports()` 호출에 순서대로 돌려줄 값(F5c). 바닥나면 마지막 것을 반복한다. */
  reportResponses: ApiReportPage[] = [{ reports: [], nextCursor: null }];
  reportCalls = 0;
  #handlers: ((event: ApiEvent) => void)[] = [];

  alerts(): ApiResult<readonly ApiAlert[]> {
    const index = Math.min(this.calls, this.responses.length - 1);
    this.calls += 1;
    return Promise.resolve(ok(this.responses[index] ?? []));
  }

  override reports(_query: ApiReportsQuery = {}): ApiResult<ApiReportPage> {
    const index = Math.min(this.reportCalls, this.reportResponses.length - 1);
    this.reportCalls += 1;
    return Promise.resolve(ok(this.reportResponses[index] ?? { reports: [], nextCursor: null }));
  }

  subscribeEvents(
    _channels: readonly ApiEventChannel[],
    handler: (event: ApiEvent) => void,
  ): Disposable {
    this.#handlers.push(handler);
    return toDisposable(() => {
      this.#handlers = this.#handlers.filter((h) => h !== handler);
    });
  }

  /** 테스트가 SSE `alert` 이벤트를 흉내낸다. */
  emit(event: ApiEvent): void {
    for (const handler of this.#handlers) handler(event);
  }

  get subscriberCount(): number {
    return this.#handlers.length;
  }

  health(): ApiResult<ApiHealth> {
    return Promise.reject(new Error('FakeApiPort.health 은 이 테스트에서 쓰지 않는다'));
  }

  hydroStations(_query?: ApiStationsQuery): ApiResult<readonly ApiStation[]> {
    return Promise.reject(new Error('FakeApiPort.hydroStations 은 이 테스트에서 쓰지 않는다'));
  }

  hydroLatest(_codes: readonly StationCode[]): ApiResult<ApiLatest> {
    return Promise.reject(new Error('FakeApiPort.hydroLatest 는 이 테스트에서 쓰지 않는다'));
  }

  awsLatest(_codes: readonly StationCode[]): ApiResult<ApiLatest> {
    return Promise.reject(new Error('FakeApiPort.awsLatest 는 이 테스트에서 쓰지 않는다'));
  }

  basinAt(_point: LngLat): ApiResult<ApiBasinLookup | null> {
    return Promise.reject(new Error('FakeApiPort.basinAt 은 이 테스트에서 쓰지 않는다'));
  }
}
