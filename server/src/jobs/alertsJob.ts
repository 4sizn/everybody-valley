/**
 * 계곡별 경보 판정 잡(F3b). HTTP 를 부르지 않는다 — 이미 쌓인 관측값(`observations`·`latest`,
 * hrfco·aws 폴러가 채운다)에서 로스터(`alertSources.ts`)로 신호를 만들어 core `evaluateAlert`
 * 로 넘긴다. 판정 로직은 core 에만 있다(중복 금지).
 *
 * 갱신·해제 둘 다 있을 때만 DB 를 쓴다 — 이미 평시고 계속 평시인 계곡은 행을 만들지 않는다.
 * 매 틱 SSE `alert` 를 한 번 낸다(관측 채널과 같은 얇은 payload — 앱은 `/api/alerts` 를 다시 부른다).
 */
import { evaluateAlert, toValleyId } from '@modu-valley/core';
import { ALERT_SOURCES, type AlertSourceRoster } from '../alertSources';
import { alertToRecord, recordToAlert } from '../alerts/convert';
import { buildValleySignals } from '../alerts/signals';
import type { Repos } from '../db/repos';
import type { EventHub } from '../events/EventHub';
import type { JobRunResult } from './PollJob';

export interface AlertsJobDeps {
  readonly repos: Repos;
  readonly hub: EventHub;
  readonly now?: () => number;
}

/** 계곡 하나 판정 + upsert. 바뀐 게 있으면(발령·해제) `true`. */
function processValley(repos: Repos, roster: AlertSourceRoster, nowIso: string): boolean {
  const stored = repos.alerts.get(roster.valleyId);
  const previous = stored ? recordToAlert(stored) : undefined;
  const bundle = buildValleySignals(repos, roster, nowIso);
  const alert = evaluateAlert({
    valleyId: toValleyId(roster.valleyId),
    signals: bundle.signals,
    now: nowIso,
    previous: previous ?? null,
    clearance: bundle.clearance,
  });
  if (alert) {
    repos.alerts.upsert(alertToRecord(roster.valleyId, alert), nowIso);
    return true;
  }
  if (previous?.isActive && stored) {
    // 조건을 다 채워 해제됐다 — 행은 지우지 않고 clearedAt 만 채운다(다음 틱의 previous 재료).
    repos.alerts.upsert({ ...stored, clearedAt: nowIso }, nowIso);
    return true;
  }
  return false;
}

export function createAlertsRun(deps: AlertsJobDeps): () => Promise<JobRunResult> {
  const now = deps.now ?? Date.now;
  return async () => {
    const nowIso = new Date(now()).toISOString();
    let changed = 0;
    for (const roster of ALERT_SOURCES) {
      if (processValley(deps.repos, roster, nowIso)) changed += 1;
    }
    const active = deps.repos.alerts.all().filter((a) => a.clearedAt === null).length;
    deps.hub.publish('alert', { at: nowIso, changed, active });
    return { rows: ALERT_SOURCES.length, detail: { changed, active } };
  };
}
