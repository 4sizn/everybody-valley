/**
 * 계곡 하나의 경보 상태(F3b) — `AppState.alerts` 의 값. 서버 `GET /api/alerts` 를 옮긴
 * `data/valley/parseAlert.ts` 가 채운다.
 */
import type { UpstreamAlert } from '../../domain/valley/UpstreamAlert';

export type ValleyAlertState = {
  /** 활성 경보. `null` 이면 평시 — 배지·배너에 아무것도 그리지 않는다. */
  readonly alert: UpstreamAlert | null;
  /** 로스터가 있는 계곡의 마지막 관측이 15분을 넘었다. 로스터가 없으면 늘 `false`. */
  readonly stale: boolean;
  readonly lastObservedAt: string | null;
};
