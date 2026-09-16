/**
 * `ShellBanner` 의 순수 로직 — react-native 를 import 하지 않는다. 그래야 vitest(순수 node,
 * `apps/valley-map/vitest.config.mts`)가 RN 목 없이 이 파일을 테스트할 수 있다.
 */
import type { AlertLevel, UpstreamAlert, ValleyId } from '@modu-valley/core';

/** 슬롯에 놓일 수 있는 배너. */
export type ShellBannerItem =
  | { readonly kind: 'alert'; readonly level: AlertLevel; readonly message: string }
  | { readonly kind: 'health' };

const LEVEL_RANK: Readonly<Record<AlertLevel, number>> = { watch: 1, warning: 2, evacuate: 3 };

/**
 * 활성 경보 중 `warning` 이상만 후보. 여럿이면 등급이 높은 쪽, 같으면 먼저 발령된(더 오래
 * 지속된) 쪽 — 이미 벌어지고 있는 상황이 새 관심보다 급하다.
 */
export function worstActiveAlert(
  alerts: ReadonlyMap<ValleyId, { readonly alert: UpstreamAlert | null }> | null,
): { readonly valleyId: ValleyId; readonly alert: UpstreamAlert } | null {
  if (alerts === null) return null;
  let worst: { valleyId: ValleyId; alert: UpstreamAlert } | undefined;
  for (const [valleyId, state] of alerts) {
    const alert = state.alert;
    if (alert === null || !alert.isActive || LEVEL_RANK[alert.level] < LEVEL_RANK.warning) continue;
    if (
      worst === undefined ||
      LEVEL_RANK[alert.level] > LEVEL_RANK[worst.alert.level] ||
      (LEVEL_RANK[alert.level] === LEVEL_RANK[worst.alert.level] &&
        alert.issuedAt < worst.alert.issuedAt)
    ) {
      worst = { valleyId, alert };
    }
  }
  return worst ?? null;
}

/**
 * 우선순위 — 경보 > 헬스. 둘 다 없으면 `null`(렌더 없음).
 * 순수 함수로 떼어 둔 이유: 슬롯이 하나라는 규칙을 테스트할 수 있다.
 */
export function pickBanner(
  alert: ShellBannerItem | null,
  healthOutage: boolean,
): ShellBannerItem | null {
  if (alert !== null) return alert;
  return healthOutage ? { kind: 'health' } : null;
}
